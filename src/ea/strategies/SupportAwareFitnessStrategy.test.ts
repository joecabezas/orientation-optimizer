import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { makeMesh, makeTriangle, Mesh } from '../../domain/mesh'
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

  describe('explain', () => {
    it('returns one contribution per triangle, matching score() as their weighted average', () => {
      const table = tableMesh()
      const genome = identityGenome()
      const explanation = strategy.explain(table, genome)

      expect(explanation.strategyName).toBe('support-aware')
      expect(explanation.triangleContributions).toHaveLength(table.triangles.length)
      expect(explanation.totalScore).toBeCloseTo(strategy.score(table, genome), 10)
    })

    it('attributes the shelf underside triangles as the top contributors, not the base or shelf top', () => {
      // tableMesh() is [base (2 tris), shelfTop (2 tris), shelfUnderside (2 tris)] in that
      // order — the base rests on the bed (excluded) and the shelf top faces up (zero
      // severity), so only the last two triangles (the shelf underside) should contribute.
      const table = tableMesh()
      const explanation = strategy.explain(table, identityGenome())

      expect(explanation.triangleContributions[0]).toBeCloseTo(0, 6)
      expect(explanation.triangleContributions[1]).toBeCloseTo(0, 6)
      expect(explanation.triangleContributions[2]).toBeCloseTo(0, 6)
      expect(explanation.triangleContributions[3]).toBeCloseTo(0, 6)
      expect(explanation.triangleContributions[4]).toBeGreaterThan(0)
      expect(explanation.triangleContributions[5]).toBeGreaterThan(0)
    })

    it('keeps contributions index-aligned with mesh.triangles when zero-area triangles are interspersed', () => {
      // Degenerate (zero-area) triangle, skipped entirely by the strategy.
      const zeroArea = makeTriangle(new Vector3(0, 0, 0), new Vector3(0, 0, 0), new Vector3(0, 0, 0))
      // Anchor face at y=0, offset in X so it never occludes the elevated face
      // below — establishes the mesh's true minY as a flat bed-contact face.
      const anchor = makeTriangle(new Vector3(-11, 0, -1), new Vector3(-9, 0, -1), new Vector3(-9, 0, 1))
      // Straight-down face elevated at y=5 — not the mesh's own minY (the anchor
      // is), so it isn't excluded as bed contact and should contribute > 0.
      const elevatedDownFace = makeTriangle(new Vector3(-1, 5, -1), new Vector3(1, 5, -1), new Vector3(1, 5, 1))
      const mesh: Mesh = { name: 'mixed', triangles: [zeroArea, anchor, elevatedDownFace] }

      const explanation = strategy.explain(mesh, identityGenome())
      expect(explanation.triangleContributions).toHaveLength(3)
      expect(explanation.triangleContributions[0]).toBe(0) // zero-area triangle, never touched
      expect(explanation.triangleContributions[1]).toBeCloseTo(0, 6) // anchor rests on the bed
      expect(explanation.triangleContributions[2]).toBeGreaterThan(0) // elevated, needs support
    })

    it('returns an empty contributions array for an empty mesh instead of throwing', () => {
      const empty = makeMesh('empty', [])
      const explanation = strategy.explain(empty, identityGenome())
      expect(explanation.triangleContributions).toEqual([])
      expect(explanation.totalScore).toBe(0)
    })
  })
})
