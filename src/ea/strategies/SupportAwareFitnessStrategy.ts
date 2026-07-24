import { Mesh } from '../../domain/mesh'
import { Genome } from '../../domain/genome'
import { FitnessExplanation, FitnessStrategy } from './FitnessStrategy'
import { DEFAULT_OVERHANG_ANGLE_CONFIG, OverhangAngleConfig, overhangSeverity } from './overhangSeverity'
import { BedContactGrid, RotatedTriangle, rotateTriangle } from './bedContactGrid'

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

/**
 * Scores downward-facing area like OverhangFitnessStrategy, but weights each
 * face by two additional factors that plain angle-based scoring ignores:
 *
 * 1. Height above the bed: a support column reaching further up costs more
 *    material and is more prone to failure than a low one, so severity scales
 *    with (face height - bed height) normalized by the mesh's rotated extent.
 * 2. Model-on-model contact: for a closed, manifold mesh, only the lowest
 *    downward-facing crossing in a given XZ column actually touches the bed —
 *    any other downward-facing crossing above it necessarily rests on the
 *    model itself (see BedContactGrid), and its support column touches the
 *    model at both ends (worse to remove, worse finish on two faces) so it's
 *    penalized above and beyond a same-angle, same-height face that lands on
 *    the plate. This intentionally doesn't distinguish a flush (zero-gap)
 *    model contact from a face with real air beneath it down to that
 *    surface — both are simply "not the lowest, so penalize" — trading that
 *    precision for a much cheaper per-triangle check, since this is a
 *    comparative signal for ranking thousands of candidate orientations, not
 *    a slicer computing exact support geometry.
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

    const downwardFacing = rotated.filter((tri) => tri.normalY < 0)
    const grid = new BedContactGrid(downwardFacing, gridResolution)

    let weightedScore = 0
    let totalArea = 0
    const contributions = collectContributions ? new Array<number>(mesh.triangles.length).fill(0) : undefined

    for (let r = 0; r < rotated.length; r++) {
      const tri = rotated[r]
      // A flat face whose lowest vertex sits at the mesh's own minY is
      // physically resting on the build plate, not floating above it — it
      // needs no support regardless of how steep its angle is, so it's
      // excluded before angle severity even applies.
      const isFlat = tri.normalY <= -1 + 1e-6
      const touchesBed = tri.minY <= minY + epsilon
      if (isFlat && touchesBed) {
        totalArea += tri.area
        continue
      }

      const angleSeverity = overhangSeverity(tri.normalY, this.config)

      if (angleSeverity <= 0) {
        totalArea += tri.area
        continue
      }

      const faceY = tri.minY
      const isLowestInColumn = grid.isLowestAt(tri.centroidX, tri.centroidZ, faceY, epsilon)
      const heightWeight = 1 + (faceY - minY) / verticalExtent
      const occlusionMultiplier = isLowestInColumn ? 1 : modelOnModelPenalty

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
