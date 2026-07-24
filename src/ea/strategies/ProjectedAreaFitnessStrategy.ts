import { Mesh } from '../../domain/mesh'
import { Genome } from '../../domain/genome'
import { FitnessExplanation, FitnessStrategy } from './FitnessStrategy'
import { BedContactGrid, RotatedTriangle, rotateTriangle } from './bedContactGrid'

/** Resolution of the XZ occlusion grid used to detect model-on-model contact. See SupportAwareFitnessStrategy. */
const GRID_RESOLUTION = 48
/**
 * Multiplier applied to a downward face's severity when the nearest surface
 * below it is other mesh geometry rather than the bed — same rationale as
 * SupportAwareFitnessStrategy's modelOnModelPenalty, but fixed rather than
 * configurable: unlike support-aware, projected-area's whole identity is
 * being the threshold-free, zero-config strategy, so this stays a constant
 * rather than growing into another exposed parameter.
 */
const MODEL_ON_MODEL_PENALTY = 1.75

/**
 * Scores each triangle by its downward-facing projected area, with no
 * critical-angle threshold. A face pointing straight down (normal.y = -1)
 * contributes its full area; a vertical wall (normal.y = 0) or any
 * upward-facing normal contributes 0; angles in between scale linearly with
 * -normal.y (equivalently, with the cosine of the angle from straight down).
 *
 * Because severity is a threshold-free, monotonic function of angle, the
 * ranking of two orientations under this metric cannot flip based on a
 * printer's critical overhang angle — unlike OverhangFitnessStrategy, whose
 * smoothstep cutoff can rank orientations differently depending on where
 * that cutoff sits. This makes it a reasonable default when optimizing for
 * "generally less support," independent of which printer will print it.
 *
 * A downward face that projects onto other mesh geometry rather than empty
 * space down to the bed is otherwise indistinguishable, by angle alone, from
 * one that projects straight to the plate — but the former's support column
 * touches the model at both ends (harder to remove, worse finish on two
 * faces instead of one) and is penalized above and beyond a same-angle face
 * that would print straight onto the bed. Detected via the same coarse XZ
 * BedContactGrid SupportAwareFitnessStrategy uses: for a closed, manifold
 * mesh, only the lowest downward-facing crossing in a given column actually
 * touches the bed, so any other downward crossing above it necessarily rests
 * on the model. This doesn't distinguish flush (zero-gap) model contact from
 * a real air gap down to that surface — both simply aren't the lowest, so
 * both get the penalty — trading that precision for a much cheaper
 * per-triangle check (see BedContactGrid for why).
 */
export class ProjectedAreaFitnessStrategy implements FitnessStrategy {
  readonly name = 'projected-area'

  score(mesh: Mesh, genome: Genome): number {
    return this.evaluate(mesh, genome, false).totalScore
  }

  explain(mesh: Mesh, genome: Genome): FitnessExplanation {
    const { totalScore, contributions } = this.evaluate(mesh, genome, true)
    return { totalScore, strategyName: this.name, triangleContributions: contributions ?? [] }
  }

  private evaluate(
    mesh: Mesh,
    genome: Genome,
    collectContributions: boolean,
  ): { totalScore: number; contributions?: number[] } {
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
    const epsilon = Math.max(maxY - minY, 1e-9) * 1e-4

    const downwardFacing = rotated.filter((tri) => tri.normalY < 0)
    const grid = new BedContactGrid(downwardFacing, GRID_RESOLUTION)

    let weightedScore = 0
    let totalArea = 0
    const contributions = collectContributions ? new Array<number>(mesh.triangles.length).fill(0) : undefined

    for (let r = 0; r < rotated.length; r++) {
      const tri = rotated[r]
      const downwardSeverity = Math.max(0, -tri.normalY)
      totalArea += tri.area
      if (downwardSeverity <= 0) continue

      // The lowest downward-facing crossing in this column touches the bed;
      // any other one above it necessarily rests on the model instead (see
      // BedContactGrid) — that support column touches the model at both
      // ends, hence the penalty multiplier. This strategy has no
      // bed-contact severity exclusion at all (unlike
      // SupportAwareFitnessStrategy — even a bed-touching face still gets
      // its plain angle severity), so the multiplier is the only thing
      // BedContactGrid decides here.
      const isLowestInColumn = grid.isLowestAt(tri.centroidX, tri.centroidZ, tri.minY, epsilon)
      const occlusionMultiplier = isLowestInColumn ? 1 : MODEL_ON_MODEL_PENALTY

      const contribution = downwardSeverity * occlusionMultiplier * tri.area
      weightedScore += contribution
      if (contributions) contributions[rotatedOriginalIndex[r]] = contribution
    }

    const totalScore = totalArea > 0 ? weightedScore / totalArea : 0
    if (contributions && totalArea > 0) {
      for (let k = 0; k < contributions.length; k++) contributions[k] /= totalArea
    }
    return { totalScore, contributions }
  }
}
