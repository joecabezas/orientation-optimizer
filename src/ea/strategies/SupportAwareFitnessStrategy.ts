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
 * A coarse XZ heightmap used to tell, for a given downward-facing triangle,
 * whether the nearest surface beneath it is the build plate or other mesh
 * geometry. Built once per genome in a single O(n) pass over triangles, then
 * queried once per triangle — avoids O(n^2) ray-triangle intersection while
 * still capturing "is this printed over open air down to the bed, or does it
 * land on top of an earlier part of the print."
 */
class OcclusionHeightmap {
  private readonly cells: number[][]
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

    for (const tri of triangles) {
      const { cx, cz } = this.cellOf(tri.centroidX, tri.centroidZ)
      this.cells[cz * resolution + cx].push(tri.maxY)
    }
  }

  private cellOf(x: number, z: number): { cx: number; cz: number } {
    const cx = Math.min(this.resolution - 1, Math.max(0, Math.floor((x - this.minX) / this.cellWidth)))
    const cz = Math.min(this.resolution - 1, Math.max(0, Math.floor((z - this.minZ) / this.cellDepth)))
    return { cx, cz }
  }

  /** Highest recorded surface strictly below `belowY` at (x, z), or undefined if none. */
  highestSurfaceBelow(x: number, z: number, belowY: number, epsilon: number): number | undefined {
    const { cx, cz } = this.cellOf(x, z)
    const heights = this.cells[cz * this.resolution + cx]
    let best: number | undefined
    for (const h of heights) {
      if (h < belowY - epsilon && (best === undefined || h > best)) {
        best = h
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
 *    that would print straight onto the plate.
 *
 * Occlusion is approximated with a coarse XZ heightmap (see
 * OcclusionHeightmap) rather than true ray-triangle intersection, keeping
 * the whole pass O(n) in triangle count instead of O(n^2).
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
      const heightWeight = 1 + (faceY - minY) / verticalExtent

      // Any recorded surface strictly below this face (other than the bed
      // itself, which lies at minY) means the support column touches mesh
      // geometry, not just the plate.
      const surfaceBelow = heightmap.highestSurfaceBelow(tri.centroidX, tri.centroidZ, faceY, epsilon)
      const restsOnModel = surfaceBelow !== undefined
      const occlusionMultiplier = restsOnModel ? modelOnModelPenalty : 1

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
