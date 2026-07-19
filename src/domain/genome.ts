import { Euler, Quaternion } from 'three'

/**
 * The genome is a rotation and nothing else. Quaternion is the sole in-memory
 * representation — Euler angles are derived only for UI display, never stored.
 */
export interface Genome {
  readonly id: string
  readonly rotation: Quaternion
}

let nextGenomeSeq = 0

export function makeGenomeId(): string {
  nextGenomeSeq += 1
  return `g${nextGenomeSeq}-${Math.random().toString(36).slice(2, 8)}`
}

export function makeGenome(rotation: Quaternion): Genome {
  return { id: makeGenomeId(), rotation: rotation.clone().normalize() }
}

/** UI-only helper: derive Euler XYZ degrees from a genome's quaternion for display. */
export function genomeToEulerDegrees(genome: Genome): { x: number; y: number; z: number } {
  const euler = new Euler().setFromQuaternion(genome.rotation, 'XYZ')
  const toDeg = (rad: number) => (rad * 180) / Math.PI
  return { x: toDeg(euler.x), y: toDeg(euler.y), z: toDeg(euler.z) }
}
