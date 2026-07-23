import { Vector3 } from 'three'
import { makeMesh, Mesh } from '../domain/mesh'
import { boxTriangles, extrudeRingProfile, rotateAndTranslate, stadiumLoop, wedgeTriangles } from './primitives'

/** A plain cube. Every orientation is roughly equivalent — useful as a sanity baseline. */
export function makeCubeMesh(size = 10): Mesh {
  const h = size / 2
  const tris = boxTriangles(new Vector3(-h, -h, -h), new Vector3(h, h, h))
  return makeMesh('Cube', tris)
}

/**
 * An L-shaped bracket: a vertical post with a horizontal arm sticking out partway up.
 * Printed as-is (arm pointing sideways, resting on its own weight), the underside of the
 * arm is a large overhang. The optimizer should find a rotation that lands the arm's flat
 * face on the print bed instead (i.e. rotate ~90 degrees onto one side).
 */
export function makeLBracketMesh(): Mesh {
  const tris: Vector3[] = []

  // Vertical post: 6x6 cross-section, 30 tall, centered at origin in X/Z.
  tris.push(...boxTriangles(new Vector3(-3, -15, -3), new Vector3(3, 15, 3)))

  // Horizontal arm: sticks out in +X from partway up the post, overhanging below.
  tris.push(...boxTriangles(new Vector3(3, 5, -3), new Vector3(20, 11, 3)))

  return makeMesh('L-Bracket', tris)
}

/**
 * A pyramid-like shape with a base and an off-center apex, plus a small overhanging
 * shelf on one side. Deliberately asymmetric so the best orientation isn't simply
 * axis-aligned — exercises the EA's ability to find a non-obvious rotation.
 */
export function makeAsymmetricPyramidMesh(): Mesh {
  const tris: Vector3[] = []

  const baseY = -10
  const apex = new Vector3(4, 15, -2) // off-center apex
  const corners = [
    new Vector3(-10, baseY, -10),
    new Vector3(10, baseY, -10),
    new Vector3(10, baseY, 10),
    new Vector3(-10, baseY, 10),
  ]

  // Base (two triangles, facing down: -Y).
  tris.push(corners[0], corners[1], corners[2])
  tris.push(corners[0], corners[2], corners[3])

  // Four side faces, apex offset so faces have varying slopes.
  for (let i = 0; i < 4; i++) {
    const cA = corners[i]
    const cB = corners[(i + 1) % 4]
    tris.push(cA, apex, cB)
  }

  // A small overhanging shelf partway up one side (a thin box sticking out),
  // which only avoids support if the pyramid is tipped onto a specific face.
  tris.push(...boxTriangles(new Vector3(-10, -2, -10), new Vector3(-6, 0, -2)))

  return makeMesh('Asymmetric Pyramid', tris)
}

/**
 * A single rectangular slab, built axis-aligned and then rotated as a whole
 * by a fixed oblique tilt (37deg about Z, 23deg about X) before being
 * exported. Because the entire mesh shares one tilt with no untilted anchor
 * competing against it, resting flat in its own local frame (identity
 * rotation) is guaranteed sub-optimal — the true optimum is exactly the
 * inverse of the baked-in tilt, a known non-axis-aligned rotation, which
 * makes this a good regression check that the optimizer can actually climb
 * out of an off-axis starting point instead of just picking a seeded axis.
 */
export function makeTiltedSlabMesh(): Mesh {
  const local = boxTriangles(new Vector3(-12, -2, -6), new Vector3(12, 2, 6))
  const tiltedZ = rotateAndTranslate(local, new Vector3(0, 0, 1), 37, new Vector3(0, 0, 0))
  const tiltedX = rotateAndTranslate(tiltedZ, new Vector3(1, 0, 0), 23, new Vector3(0, 0, 0))
  return makeMesh('Tilted Slab', tiltedX)
}

/**
 * A wedge: a long triangular prism with a scalene cross-section (no two of
 * its three side faces are parallel, equal in size, or mirror-symmetric),
 * tilted 25deg about Z and 15deg about X as a unit before export. Unlike a
 * box, a scalene prism has no pair of opposite parallel faces, so no
 * axis-aligned rotation can flatten a face "for free" the way it can for a
 * box — the three side faces sit at three different, non-orthogonal angles,
 * and the optimizer must actually search among (and between) them for the
 * lowest-overhang orientation instead of snapping to a seeded axis.
 */
export function makeAngledWedgeMesh(): Mesh {
  const crossSection: [Vector3, Vector3, Vector3] = [
    new Vector3(-9, -5, 0),
    new Vector3(11, -3, 0),
    new Vector3(-2, 8, 0),
  ]
  const local = wedgeTriangles(crossSection, -9, 9)
  const tiltedZ = rotateAndTranslate(local, new Vector3(0, 0, 1), 25, new Vector3(0, 0, 0))
  const tiltedX = rotateAndTranslate(tiltedZ, new Vector3(1, 0, 0), 15, new Vector3(0, 0, 0))
  return makeMesh('Angled Wedge', tiltedX)
}

/**
 * A block letter "U": two parallel vertical legs joined at the bottom by a
 * horizontal base bar. Printed with the open end up, the underside of the
 * base bar is a wide flat overhang spanning the full gap between the legs.
 * The optimizer should find that resting the U on one of its flat outer
 * faces (its back, or a leg's outer side) avoids that overhang entirely.
 */
export function makeLetterUMesh(): Mesh {
  const tris: Vector3[] = []

  // Left and right legs: 5x5 cross-section, 25 tall.
  tris.push(...boxTriangles(new Vector3(-12.5, -8, -2.5), new Vector3(-7.5, 17, 2.5)))
  tris.push(...boxTriangles(new Vector3(7.5, -8, -2.5), new Vector3(12.5, 17, 2.5)))

  // Base bar: spans the gap between the legs, 5 tall, overhanging when U-up.
  tris.push(...boxTriangles(new Vector3(-12.5, -13, -2.5), new Vector3(12.5, -8, 2.5)))

  return makeMesh('Letter U', tris)
}

/**
 * A block letter "N": two full-height vertical strokes plus a diagonal
 * stroke connecting bottom-left to top-right, the diagonal built as a
 * straight box rotated into place (like `makeAngledWedgeMesh`'s tilt). The
 * diagonal sits at a genuinely oblique ~26.6deg angle relative to the two
 * vertical strokes, so no single axis-aligned rotation can land all three
 * strokes overhang-free at once — a real oblique-search case.
 */
export function makeLetterNMesh(): Mesh {
  const tris: Vector3[] = []

  // Left and right strokes: 5x5 cross-section, full 30-tall height.
  tris.push(...boxTriangles(new Vector3(-10, -15, -2.5), new Vector3(-5, 15, 2.5)))
  tris.push(...boxTriangles(new Vector3(5, -15, -2.5), new Vector3(10, 15, 2.5)))

  // Diagonal stroke, built straight (5x5 cross-section, running along Y)
  // then rotated about Z so it runs from bottom-left to top-right.
  const diagonalLocal = boxTriangles(new Vector3(-2.5, -16.7705, -2.5), new Vector3(2.5, 16.7705, 2.5))
  const diagonal = rotateAndTranslate(diagonalLocal, new Vector3(0, 0, 1), -26.565, new Vector3(0, 0, 0))
  tris.push(...diagonal)

  return makeMesh('Letter N', tris)
}

/**
 * A block letter "R": a full-height left stroke, a squared-off "bowl" on
 * the upper half (top bar + upper-half right bar + middle bar closing the
 * loop back to the left stroke), plus a diagonal leg running from the
 * bowl's middle down to the bottom-right, built the same way as the N's
 * diagonal. Combines a flat-overhang challenge (the bowl's underside bars)
 * with an oblique-angle challenge (the diagonal leg) in one asymmetric
 * shape, similar in spirit to how the Asymmetric Pyramid combines a shelf
 * overhang with sloped sides.
 */
export function makeLetterRMesh(): Mesh {
  const tris: Vector3[] = []

  // Left stroke: full height.
  tris.push(...boxTriangles(new Vector3(-10, -15, -2.5), new Vector3(-5, 15, 2.5)))

  // Bowl: top bar, upper-half right bar, and a middle bar closing the loop.
  tris.push(...boxTriangles(new Vector3(-10, 10, -2.5), new Vector3(10, 15, 2.5))) // top bar
  tris.push(...boxTriangles(new Vector3(5, 1, -2.5), new Vector3(10, 10, 2.5))) // right bar, upper half only
  tris.push(...boxTriangles(new Vector3(-10, 1, -2.5), new Vector3(5, 6, 2.5))) // middle bar

  // Diagonal leg: from the bowl's middle-right joint (5, 3.5) down to the
  // bottom-right (10, -15), built straight then rotated about Z into place.
  const diagonalLocal = boxTriangles(new Vector3(-2.5, -9.582, -2.5), new Vector3(2.5, 9.582, 2.5))
  const diagonal = rotateAndTranslate(diagonalLocal, new Vector3(0, 0, 1), 15.12, new Vector3(7.5, -5.75, 0))
  tris.push(...diagonal)

  return makeMesh('Letter R', tris)
}

/**
 * A block letter "D": a flat vertical stroke on the left and a genuinely
 * round bowl on the right, built as a "stadium" ring (see `stadiumLoop` /
 * `extrudeRingProfile`) — a half-disk outline (radius 15, straight edge at
 * x=-10) with a uniformly-inset (5-unit-thick) hole cut out, extruded to
 * 5 units of depth. Unlike the other block letters, no face of the curved
 * bowl is flat, so no axis-aligned rotation can rest the bowl overhang-free
 * "for free" — the optimizer has to find the orientation (resting on the
 * flat left stroke, or tipped so the curve's lowest tangent line is on the
 * bed) that minimizes overhang along a continuously-varying surface instead
 * of a handful of discrete flat faces.
 */
export function makeLetterDMesh(): Mesh {
  const xLeft = -10
  const outerRadius = 15
  const strokeWidth = 5
  const innerRadius = outerRadius - strokeWidth
  const zMin = -2.5
  const zMax = 2.5
  const arcSamples = 15

  // Outer boundary: straight edge at x=xLeft, semicircular arc (same center,
  // radius outerRadius) bulging right — an exact half-disk.
  const outer = stadiumLoop(xLeft, xLeft, outerRadius, arcSamples)

  // Inner boundary (the hole): a uniform inward offset by strokeWidth — the
  // arc keeps the same center but shrinks its radius (the correct offset of
  // a circular arc), while the straight edge shifts right by strokeWidth;
  // stadiumLoop's straightEdgeX/radius parametrization derives the resulting
  // (shorter) arc span automatically, so the stroke has constant thickness
  // and does not taper to a point anywhere along the boundary.
  const inner = stadiumLoop(xLeft, xLeft + strokeWidth, innerRadius, arcSamples)

  const tris = extrudeRingProfile(outer, inner, zMin, zMax)
  return makeMesh('Letter D', tris)
}

export interface TestMeshOption {
  readonly id: string
  readonly label: string
  readonly build: () => Mesh
}

export const TEST_MESHES: readonly TestMeshOption[] = [
  { id: 'cube', label: 'Cube (baseline)', build: makeCubeMesh },
  { id: 'l-bracket', label: 'L-Bracket (clear overhang)', build: makeLBracketMesh },
  { id: 'pyramid', label: 'Asymmetric Pyramid (non-obvious optimum)', build: makeAsymmetricPyramidMesh },
  { id: 'tilted-slab', label: 'Tilted Slab (oblique optimum)', build: makeTiltedSlabMesh },
  { id: 'angled-wedge', label: 'Angled Wedge (oblique optimum)', build: makeAngledWedgeMesh },
  { id: 'letter-u', label: 'Letter U (bridge overhang)', build: makeLetterUMesh },
  { id: 'letter-n', label: 'Letter N (oblique diagonal)', build: makeLetterNMesh },
  { id: 'letter-r', label: 'Letter R (overhang + oblique)', build: makeLetterRMesh },
  { id: 'letter-d', label: 'Letter D (curved bowl)', build: makeLetterDMesh },
]
