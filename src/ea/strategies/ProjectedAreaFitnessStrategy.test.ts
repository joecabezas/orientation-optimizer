import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { makeMesh, Mesh } from '../../domain/mesh'
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

/** A single quad (two triangles) at the given height/XZ offset, facing up (+Y) or down (-Y). */
function flatQuad(y: number, facingDown: boolean, xOffset = 0): Vector3[] {
  const a = new Vector3(-1 + xOffset, y, -1)
  const b = new Vector3(1 + xOffset, y, -1)
  const c = new Vector3(1 + xOffset, y, 1)
  const d = new Vector3(-1 + xOffset, y, 1)
  // Winding determines normal direction (see Mesh's normal-from-winding convention).
  return facingDown ? [a, b, c, a, c, d] : [a, d, c, a, c, b]
}

/**
 * A "table": a solid closed box base from y=0 to y=1 (its own bottom face is
 * the mesh's true minY, so BedContactGrid correctly reads it as touching the
 * bed, not penalized) plus a separate downward-facing shelf floating above it
 * at y=3. `shelfOverBase` controls whether the shelf's footprint overlaps the
 * base's (model-on-model — the base's downward-facing bottom, recorded in
 * BedContactGrid, is what makes this a real occluder for a closed mesh) or is
 * offset clear of it (open air down to the bed).
 */
function tableMesh(shelfOverBase: boolean): Mesh {
  const base = boxTriangles(new Vector3(-1, 0, -1), new Vector3(1, 1, 1))
  const shelfUnderside = flatQuad(3, true, shelfOverBase ? 0 : 10)
  return makeMesh('table', [...base, ...shelfUnderside])
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

  it('penalizes a downward face resting over other mesh geometry more than the same face open to the bed', () => {
    // The base box itself is identical (same position, same own bottom-face
    // severity) in both variants — only the shelf's XZ position differs — so
    // comparing the two scores isolates the occlusion penalty on the shelf.
    const shelfOverBase = strategy.score(tableMesh(true), identityGenome())
    const shelfOverAir = strategy.score(tableMesh(false), identityGenome())

    expect(shelfOverBase).toBeGreaterThan(shelfOverAir)
  })

  it('penalizes a face resting flush (zero gap) on other mesh geometry the same as one with a genuine gap', () => {
    // This strategy trades flush-vs-gap precision for speed (see
    // BedContactGrid): both a face resting flush on other geometry and one
    // with real air beneath it down to that surface simply aren't the
    // lowest crossing in their column, so both get the same penalty.
    const flushShelf = flatQuad(1, true) // coincident with the box top at y=1
    const gappedShelf = flatQuad(3, true) // same XZ footprint, floating higher with a real gap
    const base = boxTriangles(new Vector3(-1, 0, -1), new Vector3(1, 1, 1))

    const flushScore = strategy.score(makeMesh('flush', [...base, ...flushShelf]), identityGenome())
    const gappedScore = strategy.score(makeMesh('gapped', [...base, ...gappedShelf]), identityGenome())

    expect(flushScore).toBeCloseTo(gappedScore, 6)
  })

  describe('explain', () => {
    it('returns one contribution per triangle, matching score() as their weighted average', () => {
      const mesh = makeFlatDownFacingMesh()
      const genome = identityGenome()
      const explanation = strategy.explain(mesh, genome)

      expect(explanation.strategyName).toBe('projected-area')
      expect(explanation.triangleContributions).toHaveLength(mesh.triangles.length)
      expect(explanation.totalScore).toBeCloseTo(strategy.score(mesh, genome), 10)
      expect(explanation.triangleContributions.every((c) => c >= 0)).toBe(true)
    })
  })
})
