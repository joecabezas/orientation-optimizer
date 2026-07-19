import { Vector3 } from 'three'

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
