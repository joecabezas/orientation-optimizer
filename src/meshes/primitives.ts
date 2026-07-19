import { Quaternion, Vector3 } from 'three'

/** Appends the two triangles making up a quad (a,b,c,d in order) to the output list. */
export function pushQuad(
  out: Vector3[],
  a: Vector3,
  b: Vector3,
  c: Vector3,
  d: Vector3,
): void {
  out.push(a, b, c)
  out.push(a, c, d)
}

/**
 * Builds an axis-aligned box's 12 triangles (6 faces x 2), corners at min/max.
 * Winding is counter-clockwise when viewed from outside, so normals point outward.
 */
export function boxTriangles(min: Vector3, max: Vector3): Vector3[] {
  const v = (x: number, y: number, z: number) => new Vector3(x, y, z)
  const out: Vector3[] = []

  // -Y (bottom) and +Y (top)
  pushQuad(out, v(min.x, min.y, min.z), v(max.x, min.y, min.z), v(max.x, min.y, max.z), v(min.x, min.y, max.z))
  pushQuad(out, v(min.x, max.y, min.z), v(min.x, max.y, max.z), v(max.x, max.y, max.z), v(max.x, max.y, min.z))

  // -Z (front) and +Z (back)
  pushQuad(out, v(min.x, min.y, min.z), v(min.x, max.y, min.z), v(max.x, max.y, min.z), v(max.x, min.y, min.z))
  pushQuad(out, v(max.x, min.y, max.z), v(max.x, max.y, max.z), v(min.x, max.y, max.z), v(min.x, min.y, max.z))

  // -X (left) and +X (right)
  pushQuad(out, v(min.x, min.y, max.z), v(min.x, max.y, max.z), v(min.x, max.y, min.z), v(min.x, min.y, min.z))
  pushQuad(out, v(max.x, min.y, min.z), v(max.x, max.y, min.z), v(max.x, max.y, max.z), v(max.x, min.y, max.z))

  return out
}

/**
 * Builds a triangular prism (wedge): a triangular cross-section (in the X/Y
 * plane, given as three points) extruded along Z from `zMin` to `zMax`.
 * Unlike a box, none of its faces are parallel to another, so no single
 * axis-aligned rotation can land more than one face flat — useful for
 * building test meshes whose optimal orientation is genuinely oblique.
 */
export function wedgeTriangles(
  crossSection: readonly [Vector3, Vector3, Vector3],
  zMin: number,
  zMax: number,
): Vector3[] {
  const [p0, p1, p2] = crossSection
  const front = (p: Vector3) => new Vector3(p.x, p.y, zMin)
  const back = (p: Vector3) => new Vector3(p.x, p.y, zMax)
  const out: Vector3[] = []

  // Front and back triangular caps (wound outward).
  out.push(front(p0), front(p2), front(p1))
  out.push(back(p0), back(p1), back(p2))

  // Three rectangular side faces, one per edge of the cross-section.
  pushQuad(out, front(p0), front(p1), back(p1), back(p0))
  pushQuad(out, front(p1), front(p2), back(p2), back(p1))
  pushQuad(out, front(p2), front(p0), back(p0), back(p2))

  return out
}

/**
 * Rotates a list of vertices about `axis` by `angleDeg`, then translates by
 * `pivot` (rotate first, then move to position). Useful for building mesh
 * features that jut out at a deliberately non-axis-aligned angle, so the
 * optimizer's best orientation isn't trivially one of the seeded directions.
 */
export function rotateAndTranslate(
  vertices: readonly Vector3[],
  axis: Vector3,
  angleDeg: number,
  pivot: Vector3,
): Vector3[] {
  const q = new Quaternion().setFromAxisAngle(axis.clone().normalize(), (angleDeg * Math.PI) / 180)
  return vertices.map((v) => v.clone().applyQuaternion(q).add(pivot))
}
