import { Vector3 } from 'three'
import { Mesh } from '../../domain/mesh'
import { Genome } from '../../domain/genome'
import { FitnessStrategy } from './FitnessStrategy'

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
 */
export class ProjectedAreaFitnessStrategy implements FitnessStrategy {
  readonly name = 'projected-area'

  score(mesh: Mesh, genome: Genome): number {
    let weightedScore = 0
    let totalArea = 0
    const rotated = new Vector3()

    for (const tri of mesh.triangles) {
      if (tri.area <= 0) continue
      rotated.copy(tri.normal).applyQuaternion(genome.rotation)

      const downwardSeverity = Math.max(0, -rotated.y)
      weightedScore += downwardSeverity * tri.area
      totalArea += tri.area
    }

    return totalArea > 0 ? weightedScore / totalArea : 0
  }
}
