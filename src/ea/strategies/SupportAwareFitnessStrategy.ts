import { Vector3 } from 'three'
import { Mesh, Triangle } from '../../domain/mesh'
import { Genome } from '../../domain/genome'
import { FitnessExplanation, FitnessStrategy } from './FitnessStrategy'
import { DEFAULT_OVERHANG_ANGLE_CONFIG, OverhangAngleConfig, overhangSeverity } from './overhangSeverity'

export interface SupportAwareFitnessConfig extends OverhangAngleConfig {
  /**
   * Number of cells along each axis of the XZ occlusion grid (resolution x
   * resolution total cells). Higher values resolve finer geometry at the
   * cost of an extra O(resolution^2) array, independent of triangle count.
   */
  readonly gridResolution: number
  /**
   * Multiplier applied to a downward face's severity when the nearest
   * surface below it is other mesh geometry rather than the bed: the
   * resulting support touches the model at both ends instead of once
   * (harder to remove, worse surface finish on two faces instead of one).
   */
  readonly modelOnModelPenalty: number
}

export const DEFAULT_SUPPORT_AWARE_CONFIG: SupportAwareFitnessConfig = {
  ...DEFAULT_OVERHANG_ANGLE_CONFIG,
  gridResolution: 48,
  modelOnModelPenalty: 1.75,
}

/** A triangle with its vertices rotated into world space for the current genome. */
interface RotatedTriangle {
  readonly a: Vector3
  readonly b: Vector3
  readonly c: Vector3
  readonly normal: Vector3
  readonly area: number
  readonly minY: number
  readonly maxY: number
  readonly centroidX: number
  readonly centroidZ: number
}

function rotateTriangle(tri: Triangle, rotation: Genome['rotation']): RotatedTriangle {
  const a = tri.a.clone().applyQuaternion(rotation)
  const b = tri.b.clone().applyQuaternion(rotation)
  const c = tri.c.clone().applyQuaternion(rotation)
  const normal = tri.normal.clone().applyQuaternion(rotation)
  return {
    a,
    b,
    c,
    normal,
    area: tri.area,
    minY: Math.min(a.y, b.y, c.y),
    maxY: Math.max(a.y, b.y, c.y),
    centroidX: (a.x + b.x + c.x) / 3,
    centroidZ: (a.z + b.z + c.z) / 3,
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
 * A coarse XZ heightmap used to tell, for a given downward-facing triangle,
 * whether the nearest surface beneath it is the build plate or other mesh
 * geometry. Built once per genome in a single pass over triangles, then
 * queried once per triangle — avoids O(n^2) ray-triangle intersection while
 * still capturing "is this printed over open air down to the bed, or does it
 * land on top of an earlier part of the print."
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
interface HeightmapEntry {
  readonly height: number
  /** Index of the source triangle in the `rotated` array, so a query can exclude its own entry. */
  readonly index: number
}

class OcclusionHeightmap {
  private readonly cells: HeightmapEntry[][]
  private readonly minX: number
  private readonly minZ: number
  private readonly cellWidth: number
  private readonly cellDepth: number

  constructor(
    triangles: readonly RotatedTriangle[],
    private readonly resolution: number,
  ) {
    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
    for (const tri of triangles) {
      for (const v of [tri.a, tri.b, tri.c]) {
        minX = Math.min(minX, v.x)
        maxX = Math.max(maxX, v.x)
        minZ = Math.min(minZ, v.z)
        maxZ = Math.max(maxZ, v.z)
      }
    }
    // Guard against a degenerate (zero-extent) footprint, e.g. a single point mesh.
    const spanX = Math.max(maxX - minX, 1e-9)
    const spanZ = Math.max(maxZ - minZ, 1e-9)

    this.minX = minX
    this.minZ = minZ
    this.cellWidth = spanX / resolution
    this.cellDepth = spanZ / resolution
    this.cells = Array.from({ length: resolution * resolution }, () => [])

    for (let index = 0; index < triangles.length; index++) {
      this.recordTriangle(triangles[index], index)
    }
  }

  private cellOf(x: number, z: number): { cx: number; cz: number } {
    const cx = Math.min(this.resolution - 1, Math.max(0, Math.floor((x - this.minX) / this.cellWidth)))
    const cz = Math.min(this.resolution - 1, Math.max(0, Math.floor((z - this.minZ) / this.cellDepth)))
    return { cx, cz }
  }

  /** Records `tri`'s height into every cell its footprint actually covers. */
  private recordTriangle(tri: RotatedTriangle, index: number): void {
    const triMinX = Math.min(tri.a.x, tri.b.x, tri.c.x)
    const triMaxX = Math.max(tri.a.x, tri.b.x, tri.c.x)
    const triMinZ = Math.min(tri.a.z, tri.b.z, tri.c.z)
    const triMaxZ = Math.max(tri.a.z, tri.b.z, tri.c.z)
    const { cx: cxMin, cz: czMin } = this.cellOf(triMinX, triMinZ)
    const { cx: cxMax, cz: czMax } = this.cellOf(triMaxX, triMaxZ)

    let recordedAny = false
    for (let cz = czMin; cz <= czMax; cz++) {
      for (let cx = cxMin; cx <= cxMax; cx++) {
        const px = this.minX + (cx + 0.5) * this.cellWidth
        const pz = this.minZ + (cz + 0.5) * this.cellDepth
        if (pointInTriangle2D(px, pz, tri.a.x, tri.a.z, tri.b.x, tri.b.z, tri.c.x, tri.c.z)) {
          this.cells[cz * this.resolution + cx].push({ height: tri.maxY, index })
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
      this.cells[cz * this.resolution + cx].push({ height: tri.maxY, index })
    }
  }

  /**
   * Highest recorded surface at or below `belowY` (within `epsilon`, so a
   * surface flush/coincident with the queried height counts as "there")
   * at (x, z), or undefined if none. `excludeIndex` is the querying
   * triangle's own index, so a face never detects its own recorded height
   * as support beneath itself.
   */
  highestSurfaceBelow(x: number, z: number, belowY: number, epsilon: number, excludeIndex: number): number | undefined {
    const { cx, cz } = this.cellOf(x, z)
    const entries = this.cells[cz * this.resolution + cx]
    let best: number | undefined
    for (const entry of entries) {
      if (entry.index === excludeIndex) continue
      if (entry.height <= belowY + epsilon && (best === undefined || entry.height > best)) {
        best = entry.height
      }
    }
    return best
  }
}

/**
 * Scores downward-facing area like OverhangFitnessStrategy, but weights each
 * face by two additional factors that plain angle-based scoring ignores:
 *
 * 1. Height above the bed: a support column reaching further up costs more
 *    material and is more prone to failure than a low one, so severity scales
 *    with (face height - bed height) normalized by the mesh's rotated extent.
 * 2. Model-on-model contact: if the nearest surface beneath a downward face
 *    is other mesh geometry rather than the bed, the resulting support
 *    touches the model at both ends (worse to remove, worse finish on two
 *    faces) and is penalized above and beyond a same-angle, same-height face
 *    that would print straight onto the plate. A face resting flush (zero
 *    real gap) on top of other mesh geometry needs no support at all,
 *    exactly like resting flush on the bed — the penalty only applies when
 *    there's a genuine gap for a support column to fill.
 *
 * Occlusion is approximated with a coarse XZ heightmap (see
 * OcclusionHeightmap) rather than true ray-triangle intersection.
 */
export class SupportAwareFitnessStrategy implements FitnessStrategy {
  readonly name = 'support-aware'

  constructor(private readonly config: SupportAwareFitnessConfig = DEFAULT_SUPPORT_AWARE_CONFIG) {}

  score(mesh: Mesh, genome: Genome): number {
    return this.evaluate(mesh, genome, false).totalScore
  }

  /**
   * Same computation as score(), but also records each triangle's raw
   * contribution (before the final divide-by-totalArea normalization) so the
   * UI can show which triangles are driving the number. Kept as a separate
   * entry point rather than folding into score() so the evolutionary
   * algorithm's hot loop never pays for the extra `contributions` array.
   */
  explain(mesh: Mesh, genome: Genome): FitnessExplanation {
    const { totalScore, contributions } = this.evaluate(mesh, genome, true)
    return { totalScore, strategyName: this.name, triangleContributions: contributions ?? [] }
  }

  private evaluate(
    mesh: Mesh,
    genome: Genome,
    collectContributions: boolean,
  ): { totalScore: number; contributions?: number[] } {
    const { gridResolution, modelOnModelPenalty } = this.config

    const rotated: RotatedTriangle[] = []
    const rotatedOriginalIndex: number[] = []
    for (let i = 0; i < mesh.triangles.length; i++) {
      const tri = mesh.triangles[i]
      if (tri.area <= 0) continue
      rotated.push(rotateTriangle(tri, genome.rotation))
      if (collectContributions) rotatedOriginalIndex.push(i)
    }
    if (rotated.length === 0) {
      return { totalScore: 0, contributions: collectContributions ? new Array(mesh.triangles.length).fill(0) : undefined }
    }

    let minY = Infinity
    let maxY = -Infinity
    for (const tri of rotated) {
      minY = Math.min(minY, tri.minY)
      maxY = Math.max(maxY, tri.maxY)
    }
    const verticalExtent = Math.max(maxY - minY, 1e-9)
    const epsilon = verticalExtent * 1e-4

    const heightmap = new OcclusionHeightmap(rotated, gridResolution)

    let weightedScore = 0
    let totalArea = 0
    const contributions = collectContributions ? new Array<number>(mesh.triangles.length).fill(0) : undefined

    for (let r = 0; r < rotated.length; r++) {
      const tri = rotated[r]
      // A flat face whose lowest vertex sits at the mesh's own minY is
      // physically resting on the build plate, not floating above it — it
      // needs no support regardless of how steep its angle is, so it's
      // excluded before angle severity even applies.
      const isFlat = tri.normal.y <= -1 + 1e-6
      const touchesBed = tri.minY <= minY + epsilon
      if (isFlat && touchesBed) {
        totalArea += tri.area
        continue
      }

      const angleSeverity = overhangSeverity(tri.normal.y, this.config)

      if (angleSeverity <= 0) {
        totalArea += tri.area
        continue
      }

      const faceY = tri.minY

      // A recorded surface at or below this face (excluding this triangle's
      // own entry, so a face never "detects" itself) means a support column
      // reaching down from here would touch other mesh geometry rather than
      // open air. When that surface sits flush against the face (within
      // epsilon — zero real air gap) the face is already resting on solid
      // printed material and needs no support at all, regardless of its
      // angle, exactly like resting on the bed. Only a genuine gap (the
      // surface meaningfully lower, beyond epsilon) still needs a support
      // column, and that column lands on model geometry instead of the bed —
      // the case modelOnModelPenalty accounts for.
      const surfaceBelow = heightmap.highestSurfaceBelow(tri.centroidX, tri.centroidZ, faceY, epsilon, r)
      const restsFlushOnModel = surfaceBelow !== undefined && surfaceBelow >= faceY - epsilon
      if (restsFlushOnModel) {
        totalArea += tri.area
        continue
      }

      const heightWeight = 1 + (faceY - minY) / verticalExtent
      const restsOnModelWithGap = surfaceBelow !== undefined
      const occlusionMultiplier = restsOnModelWithGap ? modelOnModelPenalty : 1

      const contribution = angleSeverity * heightWeight * occlusionMultiplier * tri.area
      weightedScore += contribution
      totalArea += tri.area
      if (contributions) contributions[rotatedOriginalIndex[r]] = contribution
    }

    const totalScore = totalArea > 0 ? weightedScore / totalArea : 0
    if (contributions && totalArea > 0) {
      for (let k = 0; k < contributions.length; k++) contributions[k] /= totalArea
    }
    return { totalScore, contributions }
  }
}
