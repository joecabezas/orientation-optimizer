import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { makeMesh } from '../domain/mesh'
import { makeGenome } from '../domain/genome'
import { rotatedMinY } from '../domain/mesh'
import {
  eightDiagonalDirections,
  rotationPointingUp,
  sixAxisDirections,
  topFaceDirections,
  twelveEdgeDirections,
} from './directionShells'

describe('sixAxisDirections / eightDiagonalDirections / twelveEdgeDirections', () => {
  it('return the expected counts', () => {
    expect(sixAxisDirections()).toHaveLength(6)
    expect(eightDiagonalDirections()).toHaveLength(8)
    expect(twelveEdgeDirections()).toHaveLength(12)
  })
})

describe('topFaceDirections', () => {
  it('ranks by area, returning the largest triangle first', () => {
    // A large quad facing +Y (area 400) and a tiny quad facing +X (area 0.02),
    // far apart so they don't interact geometrically.
    const bigQuad = [
      new Vector3(-10, 0, -10),
      new Vector3(10, 0, -10),
      new Vector3(10, 0, 10),
      new Vector3(-10, 0, -10),
      new Vector3(10, 0, 10),
      new Vector3(-10, 0, 10),
    ]
    const tinyQuad = [
      new Vector3(1000, -0.1, -0.1),
      new Vector3(1000, 0.1, -0.1),
      new Vector3(1000, 0.1, 0.1),
      new Vector3(1000, -0.1, -0.1),
      new Vector3(1000, 0.1, 0.1),
      new Vector3(1000, -0.1, 0.1),
    ]
    const mesh = makeMesh('mixed', [...tinyQuad, ...bigQuad])

    const [first] = topFaceDirections(mesh, 1)
    // The big quad's normal is +-Y; topFaceDirections negates it, so the
    // returned direction should be along Y, not X (the tiny quad's axis).
    expect(Math.abs(first.y)).toBeGreaterThan(0.9)
    expect(Math.abs(first.x)).toBeLessThan(0.1)
  })

  it('caps the result at `count` even when the mesh has more triangles', () => {
    const mesh = makeMesh('cube', [
      new Vector3(-1, -1, -1),
      new Vector3(1, -1, -1),
      new Vector3(1, 1, -1),
      new Vector3(-1, -1, -1),
      new Vector3(1, 1, -1),
      new Vector3(-1, 1, -1),
      new Vector3(-1, -1, 1),
      new Vector3(1, 1, 1),
      new Vector3(1, -1, 1),
    ])
    expect(topFaceDirections(mesh, 1)).toHaveLength(1)
    expect(topFaceDirections(mesh, 3)).toHaveLength(3)
  })

  it('resting the returned direction up via rotationPointingUp lands that exact face at the mesh minY', () => {
    // A large quad facing sideways (+X), paired with a small anchor triangle
    // placed on the quad's own outward-normal side, so it's guaranteed to end
    // up above the quad (not below it) once the quad is rotated flat.
    const quad = [
      new Vector3(-1, -1, 0),
      new Vector3(1, -1, 0),
      new Vector3(1, 1, 0),
      new Vector3(-1, -1, 0),
      new Vector3(1, 1, 0),
      new Vector3(-1, 1, 0),
    ].map((v) => v.clone().add(new Vector3(5, 0, 0)))
    const quadNormal = new Vector3(1, 0, 0) // outward normal of the quad above, given its winding
    const anchorCenter = new Vector3(5, 0, 0).add(quadNormal.clone().multiplyScalar(50))
    const anchor = [
      anchorCenter.clone().add(new Vector3(0, 0.5, 0)),
      anchorCenter.clone().add(new Vector3(0.5, -0.5, 0)),
      anchorCenter.clone().add(new Vector3(-0.5, -0.5, 0)),
    ]
    const mesh = makeMesh('quad-plus-anchor', [...quad, ...anchor])

    const [dir] = topFaceDirections(mesh, 1)
    const rotation = rotationPointingUp(dir)
    const genome = makeGenome(rotation, 0)

    // After rotating so the quad's own resting direction points up, the quad
    // (the largest face) should be the one resting at the mesh's new minY —
    // i.e. the rotation actually brought that specific face down to the
    // floor, not some other part of the mesh.
    const rotatedQuadY = quad.map((v) => v.clone().applyQuaternion(genome.rotation).y)
    const meshMinY = rotatedMinY(mesh, genome.rotation)
    for (const y of rotatedQuadY) {
      expect(y).toBeCloseTo(meshMinY, 6)
    }
  })
})
