import { Quaternion, Vector3 } from 'three'
import { Mesh } from '../domain/mesh'

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

/**
 * Directions that, passed to rotationPointingUp, rest each of the `count`
 * largest triangles flat on the bed (i.e. the negated normal of each face,
 * since rotationPointingUp points the given direction up and it's the
 * opposite face that ends up touching down). Ranked by area because the
 * biggest fitness gains typically come from landing a large flat face on the
 * plate — small triangles are far less likely to be the mesh's dominant
 * resting surface, so ranking (rather than deduplicating by direction first)
 * keeps this cheap and lets the largest faces dominate the seed list
 * regardless of how many triangles share a mesh.
 */
export function topFaceDirections(mesh: Mesh, count: number): Vector3[] {
  return [...mesh.triangles]
    .filter((t) => t.area > 0)
    .sort((a, b) => b.area - a.area)
    .slice(0, count)
    .map((t) => t.normal.clone().negate())
}
