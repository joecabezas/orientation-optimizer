import { Vector3 } from 'three'
import { makeMesh, Mesh } from '../domain/mesh'
import { boxTriangles, rotateAndTranslate, wedgeTriangles } from './primitives'

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
  tris.push(corners[0], corners[2], corners[1])
  tris.push(corners[0], corners[3], corners[2])

  // Four side faces, apex offset so faces have varying slopes.
  for (let i = 0; i < 4; i++) {
    const cA = corners[i]
    const cB = corners[(i + 1) % 4]
    tris.push(cA, cB, apex)
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
]
