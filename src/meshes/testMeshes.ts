import { Vector3 } from 'three'
import { makeMesh, Mesh } from '../domain/mesh'
import { boxTriangles } from './primitives'

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

export interface TestMeshOption {
  readonly id: string
  readonly label: string
  readonly build: () => Mesh
}

export const TEST_MESHES: readonly TestMeshOption[] = [
  { id: 'cube', label: 'Cube (baseline)', build: makeCubeMesh },
  { id: 'l-bracket', label: 'L-Bracket (clear overhang)', build: makeLBracketMesh },
  { id: 'pyramid', label: 'Asymmetric Pyramid (non-obvious optimum)', build: makeAsymmetricPyramidMesh },
]
