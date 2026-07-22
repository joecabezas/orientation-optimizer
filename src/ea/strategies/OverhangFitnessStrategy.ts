import { Vector3 } from 'three'
import { Mesh } from '../../domain/mesh'
import { Genome } from '../../domain/genome'
import { FitnessExplanation, FitnessStrategy } from './FitnessStrategy'
import { DEFAULT_OVERHANG_ANGLE_CONFIG, OverhangAngleConfig, overhangSeverity } from './overhangSeverity'

export type OverhangFitnessConfig = OverhangAngleConfig

export const DEFAULT_OVERHANG_CONFIG = DEFAULT_OVERHANG_ANGLE_CONFIG

/**
 * Scores each triangle by how downward-facing its rotated normal is, weighted
 * by area, with a smoothstep centered on the critical overhang angle so faces
 * printable without support (steep walls, upward faces) contribute ~0 and
 * faces well past the critical angle (flat downward ceilings) contribute ~1.
 *
 * This is a single O(n) pass over triangles, identical in cost to a naive
 * "dot product against up" scorer — the difference is purely which function
 * is applied per triangle, not the traversal strategy.
 */
export class OverhangFitnessStrategy implements FitnessStrategy {
  readonly name = 'overhang-angle'

  constructor(private readonly config: OverhangFitnessConfig = DEFAULT_OVERHANG_CONFIG) {}

  score(mesh: Mesh, genome: Genome): number {
    let weightedScore = 0
    let totalArea = 0
    const rotated = new Vector3()

    for (const tri of mesh.triangles) {
      if (tri.area <= 0) continue
      rotated.copy(tri.normal).applyQuaternion(genome.rotation)

      const severity = overhangSeverity(rotated.y, this.config)

      weightedScore += severity * tri.area
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

      const severity = overhangSeverity(rotated.y, this.config)
      const contribution = severity * tri.area
      raw[i] = contribution
      weightedScore += contribution
      totalArea += tri.area
    }

    const totalScore = totalArea > 0 ? weightedScore / totalArea : 0
    const triangleContributions = totalArea > 0 ? raw.map((c) => c / totalArea) : raw
    return { totalScore, strategyName: this.name, triangleContributions }
  }
}
