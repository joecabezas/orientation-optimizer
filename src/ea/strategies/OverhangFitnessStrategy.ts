import { Vector3 } from 'three'
import { Mesh } from '../../domain/mesh'
import { Genome } from '../../domain/genome'
import { FitnessStrategy } from './FitnessStrategy'

export interface OverhangFitnessConfig {
  /**
   * Overhang angle beyond which a slicer would place support, measured from
   * vertical (0deg = wall, 90deg = fully horizontal ceiling facing down).
   * Common slicer defaults are 45deg.
   */
  readonly criticalOverhangAngleDeg: number
  /**
   * Width (in degrees) of the smoothstep transition centered on the critical
   * angle. Keeps the fitness landscape smooth instead of a hard step, which
   * helps the EA climb gradients instead of hitting flat plateaus.
   */
  readonly transitionWidthDeg: number
}

export const DEFAULT_OVERHANG_CONFIG: OverhangFitnessConfig = {
  criticalOverhangAngleDeg: 45,
  transitionWidthDeg: 20,
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

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
    const { criticalOverhangAngleDeg, transitionWidthDeg } = this.config
    const halfWidth = transitionWidthDeg / 2
    const lowDeg = criticalOverhangAngleDeg - halfWidth
    const highDeg = criticalOverhangAngleDeg + halfWidth

    let weightedScore = 0
    let totalArea = 0
    const rotated = new Vector3()

    for (const tri of mesh.triangles) {
      if (tri.area <= 0) continue
      rotated.copy(tri.normal).applyQuaternion(genome.rotation)

      // Angle of the face normal from vertical: 0deg = vertical wall (normal
      // perpendicular to up, fine unsupported), 90deg = horizontal ceiling
      // facing straight down (worst case, definitely needs support). Only
      // downward-facing normals (negative Y component) can be overhangs;
      // upward-facing normals are clamped to 0deg (never need support).
      const downY = Math.min(0, rotated.y)
      const angleFromUpDeg = (Math.acos(Math.min(1, Math.max(-1, -downY))) * 180) / Math.PI
      const fromVerticalDeg = 90 - angleFromUpDeg
      const overhangSeverity = smoothstep(lowDeg, highDeg, fromVerticalDeg)

      weightedScore += overhangSeverity * tri.area
      totalArea += tri.area
    }

    return totalArea > 0 ? weightedScore / totalArea : 0
  }
}
