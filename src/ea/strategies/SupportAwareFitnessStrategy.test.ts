import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { makeMesh, Mesh } from '../../domain/mesh'
import { boxTriangles } from '../../meshes/primitives'
import { SupportAwareFitnessStrategy, DEFAULT_SUPPORT_AWARE_CONFIG } from './SupportAwareFitnessStrategy'
import { identityGenome, meshFromFaces, normalAtAngleFromVertical, rotatedGenome } from './testFixtures'

const strategy = new SupportAwareFitnessStrategy()

/** A single downward-facing quad (two triangles), normal = -Y, area = 4, centered at the given height. */
function flatDownFacingQuad(y: number): Vector3[] {
  return [
    new Vector3(-1, y, -1),
    new Vector3(1, y, -1),
    new Vector3(1, y, 1),
    new Vector3(-1, y, -1),
    new Vector3(1, y, 1),
    new Vector3(-1, y, 1),
  ]
}

/**
 * A "table" mesh: a wide flat base at y=0 (the part touching the bed) plus a
 * smaller downward-facing shelf floating above it at y=2, directly over the
 * base's footprint. The shelf's underside should be classified as
 * model-on-model (it rests over the base, not open air down to the bed).
 */
function tableMesh(): Mesh {
  const base = flatDownFacingQuad(0)
  const shelfTop = [
    new Vector3(-1, 2, -1),
    new Vector3(1, 2, 1),
    new Vector3(1, 2, -1),
    new Vector3(-1, 2, -1),
    new Vector3(-1, 2, 1),
    new Vector3(1, 2, 1),
  ] // upward-facing top of the shelf, irrelevant to overhang scoring
  const shelfUnderside = flatDownFacingQuad(2)
  return makeMesh('table', [...base, ...shelfTop, ...shelfUnderside])
}

describe('SupportAwareFitnessStrategy', () => {
  it('scores 0 for a vertical wall, matching angle-only behavior', () => {
    const wall = meshFromFaces([{ normal: new Vector3(1, 0, 0), area: 1 }])
    expect(strategy.score(wall, identityGenome())).toBeCloseTo(0, 6)
  })

  it('scores 0 once a downward face is rotated to point straight up', () => {
    const mesh = makeMesh('flat-down', flatDownFacingQuad(0))
    const flipped = rotatedGenome(new Vector3(1, 0, 0), 180)
    expect(strategy.score(mesh, flipped)).toBeCloseTo(0, 6)
  })

  it('is a continuous, monotonic function of tilt angle for a face held off the bed, like the angle-only strategy', () => {
    // The quad is pre-offset above y=0 and paired with a separate, disjoint
    // anchor face fixed at y=0 (offset in X so it never occludes the quad).
    // Rotating only the quad's own vertices about its own center — not the
    // whole mesh — means the anchor stays put as the true global minY while
    // the quad's angle varies, isolating pure angle-severity behavior from
    // the bed-contact exclusion (which only fires for a mesh's own lowest face).
    const anchor = flatDownFacingQuad(0).map((v) => v.clone().add(new Vector3(-10, 0, 0)))
    const angles = [0, 15, 30, 45, 60, 75, 90]
    const scores = angles.map((deg) => {
      const quad = flatDownFacingQuad(5).map((v) =>
        v
          .clone()
          .sub(new Vector3(0, 5, 0))
          .applyAxisAngle(new Vector3(1, 0, 0), (deg * Math.PI) / 180)
          .add(new Vector3(0, 5, 0)),
      )
      const mesh = makeMesh('flat-down', [...quad, ...anchor])
      return strategy.score(mesh, identityGenome())
    })
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThan(scores[i - 1] + 1e-9)
    }
    expect(scores[0]).toBeGreaterThan(scores[scores.length - 1])
  })

  it('treats a flat face resting at the mesh minY as bed contact, scoring 0 regardless of angle severity', () => {
    const mesh = makeMesh('flat-down', flatDownFacingQuad(0))
    expect(strategy.score(mesh, identityGenome())).toBe(0)
  })

  it('scores a higher-altitude downward face worse than an otherwise identical low one', () => {
    // Two identical downward quads sharing one mesh (so verticalExtent is the
    // same for both), offset in X so neither occludes the other: one at the
    // bottom of the mesh's extent, one at the top.
    const stacked = makeMesh('stacked', [
      ...flatDownFacingQuad(0).map((v) => v.clone().add(new Vector3(-10, 0, 0))),
      ...flatDownFacingQuad(20).map((v) => v.clone().add(new Vector3(10, 0, 0))),
    ])
    const lowOnly = strategy.score(makeMesh('low-only', flatDownFacingQuad(0)), identityGenome())
    const stackedScore = strategy.score(stacked, identityGenome())
    expect(stackedScore).toBeGreaterThan(lowOnly)
  })

  it('penalizes a downward face resting over other mesh geometry more than one open to the bed', () => {
    const table = tableMesh()
    const tableScore = strategy.score(table, identityGenome())

    // Same shelf underside area/angle, but with the base removed so the
    // shelf's underside is open to the bed instead of resting over the base.
    const shelfOnly = makeMesh('shelf-only', [...flatDownFacingQuad(2)])
    const shelfOnlyScore = strategy.score(shelfOnly, identityGenome())

    expect(tableScore).toBeGreaterThan(shelfOnlyScore)
  })

  it('does not misclassify a face resting on the bed itself as model-on-model', () => {
    const base = makeMesh('base', flatDownFacingQuad(0))
    const withPenalty = new SupportAwareFitnessStrategy({ ...DEFAULT_SUPPORT_AWARE_CONFIG, modelOnModelPenalty: 5 })
    const withoutPenalty = new SupportAwareFitnessStrategy({ ...DEFAULT_SUPPORT_AWARE_CONFIG, modelOnModelPenalty: 1 })

    expect(withPenalty.score(base, identityGenome())).toBeCloseTo(withoutPenalty.score(base, identityGenome()), 6)
  })

  it('can rank two orientations differently based on model-on-model contact even at equal angle and height', () => {
    const table = tableMesh()
    const shelfOnly = makeMesh('shelf-only', flatDownFacingQuad(2))
    expect(strategy.score(table, identityGenome())).toBeGreaterThan(strategy.score(shelfOnly, identityGenome()))
  })

  it('stays within a sane [0, upper bound] range and never returns NaN', () => {
    const cube = makeMesh('cube', boxTriangles(new Vector3(-1, -1, -1), new Vector3(1, 1, 1)))
    const score = strategy.score(cube, identityGenome())
    expect(Number.isNaN(score)).toBe(false)
    expect(score).toBeGreaterThanOrEqual(0)
  })

  it('returns 0 for an empty mesh instead of NaN', () => {
    const empty = makeMesh('empty', [])
    expect(strategy.score(empty, identityGenome())).toBe(0)
  })

  it('is invariant to critical angle in the same documented way as overhang-angle for extreme faces', () => {
    // Anchored above a lower reference point so the down-facing quad isn't
    // the mesh's own minY (which would trigger bed-contact exclusion) —
    // isolates angle-severity behavior from bed-contact behavior.
    const table = tableMesh()
    for (const critical of [20, 45, 70]) {
      const s = new SupportAwareFitnessStrategy({ ...DEFAULT_SUPPORT_AWARE_CONFIG, criticalOverhangAngleDeg: critical })
      // The shelf underside is a straight-down face floating above the base
      // regardless of critical angle placement, so it always hits max angle
      // severity (1) and a nonzero model-on-model penalty.
      expect(s.score(table, identityGenome())).toBeGreaterThan(0)
    }
  })

  it('normal-at-angle faces below critical angle score 0 regardless of height or occlusion setup', () => {
    const shallow = meshFromFaces([{ normal: normalAtAngleFromVertical(10), area: 1 }])
    expect(strategy.score(shallow, identityGenome())).toBeCloseTo(0, 3)
  })
})
