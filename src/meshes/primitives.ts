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
 * Builds the 2D (Z=0) boundary points of a "stadium/D" outline: a circle of
 * radius `radius` centered at `(centerX, 0)`, cut off on the left by a
 * vertical straight edge at `x = straightEdgeX` (so `straightEdgeX - centerX`
 * must be within `[-radius, radius]`). This is the outline of a capital "D" —
 * flat edge on the left, circular bulge on the right — and, with
 * `straightEdgeX === centerX`, degenerates to an exact half-circle.
 *
 * Returns `2 + numArcSamples` points ordered so walking through them (and
 * wrapping back to the first) traces the boundary exactly once, without
 * self-crossing: the top corner (where the straight edge meets the arc), the
 * bottom corner, then `numArcSamples` interior arc points swept in increasing
 * angle from just above the bottom corner to just below the top corner. The
 * loop is wound counter-clockwise in the standard X/Y sense (positive
 * signed area) when `radius > 0`.
 */
export function stadiumLoop(
  centerX: number,
  straightEdgeX: number,
  radius: number,
  numArcSamples: number,
): Vector3[] {
  const dx = straightEdgeX - centerX
  const halfAngle = Math.acos(dx / radius) // radians, in (0, PI]
  const halfHeight = radius * Math.sin(halfAngle)
  const top = new Vector3(straightEdgeX, halfHeight, 0)
  const bottom = new Vector3(straightEdgeX, -halfHeight, 0)
  const points: Vector3[] = [top, bottom]
  for (let i = 1; i <= numArcSamples; i++) {
    const theta = -halfAngle + (2 * halfAngle * i) / (numArcSamples + 1)
    points.push(new Vector3(centerX + radius * Math.cos(theta), radius * Math.sin(theta), 0))
  }
  return points
}

/**
 * Extrudes a closed ring cross-section — an `outer` loop and an `inner` loop
 * of matching length, with `outer[i]` and `inner[i]` corresponding to the
 * same position around the ring — along Z from `zMin` to `zMax`. Produces a
 * hollow prism with wall thickness (a "stroke" shape, like a flattened
 * letter), not a filled solid: the front/back faces are annular (outer minus
 * inner), and there are separate outer and inner side walls.
 *
 * Both loops must be wound counter-clockwise in the standard X/Y sense (see
 * `stadiumLoop`), and `inner[i]` must sit strictly inside `outer[i]`'s loop
 * at every index, or the winding relationships this function relies on won't
 * hold and normals will come out inconsistent.
 *
 * Per boundary index `i` (wrapping to 0 after the last), this emits:
 *  - a front-cap quad (z = zMin, outward normal -Z) and a back-cap quad
 *    (z = zMax, outward normal +Z) — mirror-image windings of each other —
 *    each spanning the strip between `outer[i]..outer[i+1]` and
 *    `inner[i]..inner[i+1]`
 *  - an outer-wall quad facing outward, away from the ring
 *  - an inner-wall quad facing inward, into the hollow interior
 *
 * This is the complete boundary of the solid: no redundant internal faces.
 */
export function extrudeRingProfile(
  outer: readonly Vector3[],
  inner: readonly Vector3[],
  zMin: number,
  zMax: number,
): Vector3[] {
  if (outer.length !== inner.length) {
    throw new Error('extrudeRingProfile: outer and inner loops must have the same length')
  }
  if (outer.length < 3) {
    throw new Error('extrudeRingProfile: loops must have at least 3 points')
  }

  const n = outer.length
  const front = (p: Vector3) => new Vector3(p.x, p.y, zMin)
  const back = (p: Vector3) => new Vector3(p.x, p.y, zMax)
  const out: Vector3[] = []

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const oA = outer[i]
    const oB = outer[j]
    const iA = inner[i]
    const iB = inner[j]

    // Back cap (z = zMax): outer forward, inner backward — outward normal +Z.
    pushQuad(out, back(oA), back(oB), back(iB), back(iA))
    // Front cap (z = zMin): exact mirror of the back cap — outward normal -Z.
    pushQuad(out, front(iA), front(iB), front(oB), front(oA))

    // Outer wall: faces outward, away from the ring's center.
    pushQuad(out, front(oA), front(oB), back(oB), back(oA))
    // Inner wall: faces inward, toward the hollow interior (opposite winding from outer).
    pushQuad(out, front(iA), back(iA), back(iB), front(iB))
  }

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
