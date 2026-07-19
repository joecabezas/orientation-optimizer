import { Quaternion, Vector3 } from 'three'

const UP = new Vector3(0, 1, 0)

/** Builds the rotation that takes `direction` (in mesh-local space) and points it at +Y (up). */
export function rotationPointingUp(direction: Vector3): Quaternion {
  const dir = direction.clone().normalize()
  return new Quaternion().setFromUnitVectors(dir, UP)
}

/** The 6 face-normal directions of a cube (+-X, +-Y, +-Z). */
export function sixAxisDirections(): Vector3[] {
  return [
    new Vector3(1, 0, 0),
    new Vector3(-1, 0, 0),
    new Vector3(0, 1, 0),
    new Vector3(0, -1, 0),
    new Vector3(0, 0, 1),
    new Vector3(0, 0, -1),
  ]
}

/** The 8 corner (diagonal) directions of a cube. */
export function eightDiagonalDirections(): Vector3[] {
  const dirs: Vector3[] = []
  for (const sx of [1, -1]) {
    for (const sy of [1, -1]) {
      for (const sz of [1, -1]) {
        dirs.push(new Vector3(sx, sy, sz).normalize())
      }
    }
  }
  return dirs
}

/** The 12 edge-midpoint directions of a cube. */
export function twelveEdgeDirections(): Vector3[] {
  const dirs: Vector3[] = []
  for (const s1 of [1, -1]) {
    for (const s2 of [1, -1]) {
      dirs.push(new Vector3(s1, s2, 0).normalize())
      dirs.push(new Vector3(s1, 0, s2).normalize())
      dirs.push(new Vector3(0, s1, s2).normalize())
    }
  }
  return dirs
}

export type ShellLevel = 6 | 14 | 26

/**
 * Builds up to `level` directions, layered as concentric "shells":
 * 6 = face normals only; 14 = faces + 8 corners; 26 = faces + corners + 12 edges.
 * This mirrors the user's "test 6 axes, then 8 diagonals, then..." exploration idea.
 */
export function directionShell(level: ShellLevel): Vector3[] {
  const dirs = [...sixAxisDirections()]
  if (level >= 14) dirs.push(...eightDiagonalDirections())
  if (level >= 26) dirs.push(...twelveEdgeDirections())
  return dirs
}
