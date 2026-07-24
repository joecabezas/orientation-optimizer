import { Quaternion, Vector3 } from 'three'
import { makeMesh, Mesh } from '../../domain/mesh'
import { makeGenome } from '../../domain/genome'

export function identityGenome() {
  return makeGenome(new Quaternion(), 0)
}

export function rotatedGenome(axis: Vector3, angleDeg: number) {
  return makeGenome(new Quaternion().setFromAxisAngle(axis.clone().normalize(), (angleDeg * Math.PI) / 180), 0)
}

/**
 * A downward-tilted normal at the given angle from vertical (0deg = vertical
 * wall, 90deg = straight down), matching the fitness strategies' own
 * convention: fromVerticalDeg = 90 - acos(-normal.y), i.e. normal.y = -sin(fromVerticalDeg).
 */
export function normalAtAngleFromVertical(fromVerticalDeg: number): Vector3 {
  const rad = (fromVerticalDeg * Math.PI) / 180
  return new Vector3(0, -Math.sin(rad), Math.cos(rad))
}

/** Builds a mesh from explicit (normal, area) pairs, placed as tiny triangles far apart so areas don't overlap. */
export function meshFromFaces(faces: readonly { normal: Vector3; area: number }[]): Mesh {
  const tris: Vector3[] = []
  faces.forEach((f, i) => {
    // Build a right triangle whose normal is f.normal and area is f.area, offset per-face.
    const n = f.normal.clone().normalize()
    // Pick an arbitrary vector not parallel to n.
    const helper = Math.abs(n.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0)
    const u = helper.clone().cross(n).normalize()
    const v = n.clone().cross(u).normalize()
    const legLength = Math.sqrt(2 * f.area)
    const offset = new Vector3(i * 1000, 0, 0) // keep faces from interacting
    const a = offset.clone()
    const b = offset.clone().add(u.clone().multiplyScalar(legLength))
    const c = offset.clone().add(v.clone().multiplyScalar(legLength))
    tris.push(a, b, c)
  })
  return makeMesh('synthetic', tris)
}
