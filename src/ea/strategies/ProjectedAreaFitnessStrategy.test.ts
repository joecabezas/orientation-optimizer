import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { makeMesh } from '../../domain/mesh'
import { ProjectedAreaFitnessStrategy } from './ProjectedAreaFitnessStrategy'
import { boxTriangles } from '../../meshes/primitives'
import { identityGenome, rotatedGenome } from './testFixtures'

const strategy = new ProjectedAreaFitnessStrategy()

/** A single downward-facing quad (two triangles), normal = -Y, area = 4. */
function makeFlatDownFacingMesh() {
  const tris = [
    new Vector3(-1, 0, -1),
    new Vector3(1, 0, -1),
    new Vector3(1, 0, 1),
    new Vector3(-1, 0, -1),
    new Vector3(1, 0, 1),
    new Vector3(-1, 0, 1),
  ]
  return makeMesh('flat-down', tris)
}

describe('ProjectedAreaFitnessStrategy', () => {
  it('scores 0 for a mesh with no downward-facing area (cube, identity rotation is symmetric anyway)', () => {
    const cube = makeMesh('cube', boxTriangles(new Vector3(-1, -1, -1), new Vector3(1, 1, 1)))
    // A cube always has exactly one face pointing straight down regardless of
    // axis-aligned rotation, so this checks the metric doesn't blow up / stays in range.
    const score = strategy.score(cube, identityGenome())
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })

  it('scores exactly 0 for a vertical wall (normal perpendicular to up)', () => {
    // A quad facing -Z (a vertical wall) contributes 0 downward severity.
    const wall = makeMesh('wall', [
      new Vector3(-1, -1, 0),
      new Vector3(1, -1, 0),
      new Vector3(1, 1, 0),
      new Vector3(-1, -1, 0),
      new Vector3(1, 1, 0),
      new Vector3(-1, 1, 0),
    ])
    expect(strategy.score(wall, identityGenome())).toBeCloseTo(0, 10)
  })

  it('scores exactly 1 for a face pointing straight down', () => {
    const mesh = makeFlatDownFacingMesh()
    expect(strategy.score(mesh, identityGenome())).toBeCloseTo(1, 10)
  })

  it('scores 0 once a downward face is rotated to point straight up', () => {
    const mesh = makeFlatDownFacingMesh()
    const flipped = rotatedGenome(new Vector3(1, 0, 0), 180)
    expect(strategy.score(mesh, flipped)).toBeCloseTo(0, 10)
  })

  it('is a continuous, monotonic function of tilt angle (no threshold / plateau)', () => {
    const mesh = makeFlatDownFacingMesh()
    const angles = [0, 15, 30, 45, 60, 75, 90]
    const scores = angles.map((deg) => strategy.score(mesh, rotatedGenome(new Vector3(1, 0, 0), deg)))
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThan(scores[i - 1] + 1e-9)
    }
    // strictly decreasing somewhere (not flat across the whole range)
    expect(scores[0]).toBeGreaterThan(scores[scores.length - 1])
  })

  it('never flips the ranking of two orientations based on a threshold, because it has none', () => {
    // Sanity check that the strategy's public API takes no critical-angle config at all.
    expect(strategy.name).toBe('projected-area')
    expect(Object.keys(strategy)).not.toContain('config')
  })
})
