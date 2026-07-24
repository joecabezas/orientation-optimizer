import { Vector3 } from 'three'
import { Mesh } from '../../domain/mesh'
import { Genome } from '../../domain/genome'
import { FitnessExplanation, FitnessStrategy } from './FitnessStrategy'

/**
 * Scores each triangle by its downward-facing projected area alone: a face
 * pointing straight down (normal.y = -1) contributes its full area, straight
 * up (normal.y = 1) contributes 0, and angles in between scale linearly with
 * -normal.y. No critical-angle threshold and no model-on-model occlusion
 * detection (unlike ProjectedAreaFitnessStrategy) — just one O(n) pass over
 * triangles with no auxiliary grid to build, so this stays fast even at very
 * high triangle counts (e.g. large imported STLs) where the occlusion grid's
 * per-triangle rasterization cost becomes noticeable across a whole
 * population every generation. Prefer ProjectedAreaFitnessStrategy when the
 * occlusion signal is worth the extra cost; prefer this when it isn't.
 */
export class SimpleAreaFitnessStrategy implements FitnessStrategy {
  readonly name = 'simple-area'

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

  explain(mesh: Mesh, genome: Genome): FitnessExplanation {
    const rotated = new Vector3()
    const raw = new Array<number>(mesh.triangles.length).fill(0)
    let weightedScore = 0
    let totalArea = 0

    for (let i = 0; i < mesh.triangles.length; i++) {
      const tri = mesh.triangles[i]
      if (tri.area <= 0) continue
      rotated.copy(tri.normal).applyQuaternion(genome.rotation)

      const contribution = Math.max(0, -rotated.y) * tri.area
      raw[i] = contribution
      weightedScore += contribution
      totalArea += tri.area
    }

    const totalScore = totalArea > 0 ? weightedScore / totalArea : 0
    const triangleContributions = totalArea > 0 ? raw.map((c) => c / totalArea) : raw
    return { totalScore, strategyName: this.name, triangleContributions }
  }
}
