export interface OverhangAngleConfig {
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

export const DEFAULT_OVERHANG_ANGLE_CONFIG: OverhangAngleConfig = {
  criticalOverhangAngleDeg: 45,
  transitionWidthDeg: 20,
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/**
 * Angle of a rotated face normal from vertical: 0deg = vertical wall (normal
 * perpendicular to up, fine unsupported), 90deg = horizontal ceiling facing
 * straight down (worst case, definitely needs support). Only downward-facing
 * normals (negative Y component) can be overhangs; upward-facing normals are
 * clamped to 0deg (never need support).
 */
export function angleFromVerticalDeg(rotatedNormalY: number): number {
  const downY = Math.min(0, rotatedNormalY)
  const angleFromUpDeg = (Math.acos(Math.min(1, Math.max(-1, -downY))) * 180) / Math.PI
  return 90 - angleFromUpDeg
}

/**
 * How severely a rotated face normal needs support, in [0, 1], via a
 * smoothstep centered on the critical overhang angle: faces printable
 * without support (steep walls, upward faces) score ~0 and faces well past
 * the critical angle (flat downward ceilings) score ~1.
 */
export function overhangSeverity(rotatedNormalY: number, config: OverhangAngleConfig): number {
  const halfWidth = config.transitionWidthDeg / 2
  const lowDeg = config.criticalOverhangAngleDeg - halfWidth
  const highDeg = config.criticalOverhangAngleDeg + halfWidth
  return smoothstep(lowDeg, highDeg, angleFromVerticalDeg(rotatedNormalY))
}
