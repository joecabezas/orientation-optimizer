import { Vector3 } from 'three'
import { Triangle } from '../../domain/mesh'
import { Genome } from '../../domain/genome'

/**
 * A triangle's vertices rotated into world space for the current genome,
 * flattened to plain numbers rather than Vector3 instances: nothing
 * downstream calls a Vector3 method on these, only reads .x/.y/.z, and at
 * high triangle counts (real STL imports run 200k+ triangles, evaluated once
 * per genome per generation) the 4 Vector3 allocations rotateTriangle used to
 * do per call (a, b, c, normal) dominated scoring time far more than the
 * occlusion grid itself did.
 */
export interface RotatedTriangle {
  readonly ax: number
  readonly ay: number
  readonly az: number
  readonly bx: number
  readonly by: number
  readonly bz: number
  readonly cx: number
  readonly cy: number
  readonly cz: number
  /** Only the Y component of the rotated normal is ever read (severity/flatness checks), so that's all that's computed. */
  readonly normalY: number
  readonly area: number
  readonly minY: number
  readonly maxY: number
  readonly centroidX: number
  readonly centroidZ: number
}

const scratch = new Vector3()

export function rotateTriangle(tri: Triangle, rotation: Genome['rotation']): RotatedTriangle {
  scratch.copy(tri.a).applyQuaternion(rotation)
  const ax = scratch.x,
    ay = scratch.y,
    az = scratch.z
  scratch.copy(tri.b).applyQuaternion(rotation)
  const bx = scratch.x,
    by = scratch.y,
    bz = scratch.z
  scratch.copy(tri.c).applyQuaternion(rotation)
  const cx = scratch.x,
    cy = scratch.y,
    cz = scratch.z
  const normalY = scratch.copy(tri.normal).applyQuaternion(rotation).y

  return {
    ax,
    ay,
    az,
    bx,
    by,
    bz,
    cx,
    cy,
    cz,
    normalY,
    area: tri.area,
    minY: Math.min(ay, by, cy),
    maxY: Math.max(ay, by, cy),
    centroidX: (ax + bx + cx) / 3,
    centroidZ: (az + bz + cz) / 3,
  }
}

/**
 * True if (px, pz) lies inside (or on the boundary of) the 2D triangle
 * (ax,az)-(bx,bz)-(cx,cz), via the standard same-sign-of-cross-product test.
 */
function pointInTriangle2D(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  cx: number,
  cz: number,
): boolean {
  const sign = (x1: number, z1: number, x2: number, z2: number, x3: number, z3: number) =>
    (x1 - x3) * (z2 - z3) - (x2 - x3) * (z1 - z3)
  const d1 = sign(px, pz, ax, az, bx, bz)
  const d2 = sign(px, pz, bx, bz, cx, cz)
  const d3 = sign(px, pz, cx, cz, ax, az)
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0
  return !(hasNeg && hasPos)
}

/**
 * A coarse XZ grid recording, per cell, the lowest downward-facing triangle
 * height seen there — used to tell whether a given downward face is the
 * lowest one along its column (needs support down to the bed) or one of
 * possibly several higher ones stacked above it (needs support, but landing
 * on the model itself, not the bed).
 *
 * For a closed, manifold mesh, a vertical line through any point crosses the
 * surface an even number of times, alternating upward/downward-facing as it
 * goes: the bottom-most downward crossing is where the model actually
 * touches the bed, and every downward crossing above that necessarily rests
 * on some upward-facing surface below it (it's still inside the solid).
 * Rather than tracking every crossing's exact height and searching for the
 * nearest one below a query point (the old design), this only needs "is this
 * the lowest downward face in this column, yes or no" — a single running
 * minimum per cell answers that in O(1) per query, with no per-cell list to
 * scan. This intentionally can't tell a flush-contact face from one with a
 * real air gap to whatever's below it (both just read "not the lowest, so
 * penalize as model-on-model") — for a comparative fitness signal used to
 * rank thousands of candidate orientations, that coarser, faster
 * classification is preferred over slicer-grade precision (see
 * SupportAwareFitnessStrategy / ProjectedAreaFitnessStrategy).
 *
 * Each triangle is rasterized into every grid cell whose center falls inside
 * it (not just the cell containing its centroid): a large, obliquely-cut
 * triangle — e.g. one half of a box's flat top face, split diagonally —
 * covers many cells whose centers sit far from its own centroid, and a
 * downward face resting anywhere on that footprint needs to find it. This
 * costs up to O(resolution^2) work for a single triangle spanning the whole
 * grid, but real (finely tessellated) STL meshes have triangles that each
 * cover only a handful of cells, so the practical cost stays close to linear
 * in triangle count; only synthetic low-poly test geometry (a handful of
 * large box faces) hits the worst case, and cheaply at that.
 */
export class BedContactGrid {
  private readonly cellMinY: Float64Array
  private readonly minX: number
  private readonly minZ: number
  private readonly cellWidth: number
  private readonly cellDepth: number

  constructor(
    downwardFacingTriangles: readonly RotatedTriangle[],
    private readonly resolution: number,
  ) {
    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
    for (const tri of downwardFacingTriangles) {
      minX = Math.min(minX, tri.ax, tri.bx, tri.cx)
      maxX = Math.max(maxX, tri.ax, tri.bx, tri.cx)
      minZ = Math.min(minZ, tri.az, tri.bz, tri.cz)
      maxZ = Math.max(maxZ, tri.az, tri.bz, tri.cz)
    }
    // Guard against a degenerate (zero-extent) footprint, e.g. a single point mesh.
    const spanX = Math.max(maxX - minX, 1e-9)
    const spanZ = Math.max(maxZ - minZ, 1e-9)

    this.minX = minX
    this.minZ = minZ
    this.cellWidth = spanX / resolution
    this.cellDepth = spanZ / resolution
    this.cellMinY = new Float64Array(resolution * resolution).fill(Infinity)

    for (const tri of downwardFacingTriangles) {
      this.recordTriangle(tri)
    }
  }

  private cellOf(x: number, z: number): { cx: number; cz: number } {
    const cx = Math.min(this.resolution - 1, Math.max(0, Math.floor((x - this.minX) / this.cellWidth)))
    const cz = Math.min(this.resolution - 1, Math.max(0, Math.floor((z - this.minZ) / this.cellDepth)))
    return { cx, cz }
  }

  /** Lowers every grid cell `tri`'s footprint covers to `tri.minY`, if that's lower than what's already recorded. */
  private recordTriangle(tri: RotatedTriangle): void {
    const triMinX = Math.min(tri.ax, tri.bx, tri.cx)
    const triMaxX = Math.max(tri.ax, tri.bx, tri.cx)
    const triMinZ = Math.min(tri.az, tri.bz, tri.cz)
    const triMaxZ = Math.max(tri.az, tri.bz, tri.cz)
    const { cx: cxMin, cz: czMin } = this.cellOf(triMinX, triMinZ)
    const { cx: cxMax, cz: czMax } = this.cellOf(triMaxX, triMaxZ)

    let recordedAny = false
    for (let cz = czMin; cz <= czMax; cz++) {
      for (let cx = cxMin; cx <= cxMax; cx++) {
        const px = this.minX + (cx + 0.5) * this.cellWidth
        const pz = this.minZ + (cz + 0.5) * this.cellDepth
        if (pointInTriangle2D(px, pz, tri.ax, tri.az, tri.bx, tri.bz, tri.cx, tri.cz)) {
          const idx = cz * this.resolution + cx
          if (tri.minY < this.cellMinY[idx]) this.cellMinY[idx] = tri.minY
          recordedAny = true
        }
      }
    }

    // A triangle thinner than a single cell (or one that straddles cell
    // boundaries such that no cell center happens to land inside it) would
    // otherwise never get recorded anywhere. Fall back to its centroid's
    // cell, which is always inside the triangle.
    if (!recordedAny) {
      const { cx, cz } = this.cellOf(tri.centroidX, tri.centroidZ)
      const idx = cz * this.resolution + cx
      if (tri.minY < this.cellMinY[idx]) this.cellMinY[idx] = tri.minY
    }
  }

  /**
   * True if `faceY` (within `epsilon`) is the lowest downward-facing height
   * recorded at (x, z) — i.e. this face is the one actually touching the
   * bed, not resting on other mesh geometry above it.
   */
  isLowestAt(x: number, z: number, faceY: number, epsilon: number): boolean {
    const { cx, cz } = this.cellOf(x, z)
    const recorded = this.cellMinY[cz * this.resolution + cx]
    return faceY <= recorded + epsilon
  }
}
