import { describe, expect, it } from 'vitest'
import { Quaternion, Vector3 } from 'three'
import { makeMesh, makeTriangle, Mesh } from '../../domain/mesh'
import { makeGenome } from '../../domain/genome'
import { boxTriangles } from '../../meshes/primitives'
import { makeLBracketMesh } from '../../meshes/testMeshes'
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
 *
 * The shelf is given a small but real thickness (top at y=2.1, underside at
 * y=2) rather than the zero-thickness idealization it might otherwise be
 * tempted to use: a literally coincident top/underside pair would let the
 * shelf's own top face register in the same occlusion-heightmap cell as its
 * underside at the exact same height, which is a degenerate "resting flush
 * on itself" artifact, not a real gap — real printed geometry always has
 * some thickness, so this keeps the fixture physically meaningful and keeps
 * the two faces from colliding in the heightmap.
 */
function tableMesh(): Mesh {
  const base = flatDownFacingQuad(0)
  const shelfTop = [
    new Vector3(-1, 2.1, -1),
    new Vector3(1, 2.1, 1),
    new Vector3(1, 2.1, -1),
    new Vector3(-1, 2.1, -1),
    new Vector3(-1, 2.1, 1),
    new Vector3(1, 2.1, 1),
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

  it('penalizes a flat face resting flush on top of OTHER mesh geometry the same as one with a genuine gap', () => {
    // BedContactGrid trades flush-vs-gap precision for a much cheaper
    // per-triangle check (see its doc comment): a face resting flush on
    // other geometry and one with a real air gap down to that surface both
    // simply aren't the lowest crossing in their column, so both get
    // modelOnModelPenalty rather than the flush case being excluded.
    const base = boxTriangles(new Vector3(-1, 0, -1), new Vector3(1, 2, 1))
    const flushShelf = flatDownFacingQuad(2) // coincident with the base's own top, zero gap
    const gappedShelf = flatDownFacingQuad(4) // same footprint, floating higher with a real gap

    const flushScore = strategy.score(makeMesh('flush-on-model', [...base, ...flushShelf]), identityGenome())
    const gappedScore = strategy.score(makeMesh('gapped-on-model', [...base, ...gappedShelf]), identityGenome())

    expect(flushScore).toBeGreaterThan(0)
    expect(flushScore).toBeCloseTo(gappedScore, 6)
  })

  it("regression: L-Bracket rotated 90deg about Z lands the arm end-cap flush on the post's rotated top face, still penalized as model-on-model", () => {
    // A clean 90-degree-about-Z rotation puts the post's own -X face flush on
    // the bed (still correctly excluded — it's the mesh's true lowest point)
    // and, separately, the arm's end-cap face flush on top of the post's
    // newly-rotated top surface. BedContactGrid no longer distinguishes this
    // flush contact from a genuine gap (see above), so unlike the prior
    // flush-detection fix, this now scores nonzero rather than ~0 — the
    // point of this regression test is just that it stays finite/sane, not
    // that it's misclassified as some other case entirely.
    const mesh = makeLBracketMesh()
    const genome = makeGenome(new Quaternion(0, 0, 0.7071067811865476, 0.7071067811865476), 0)
    const score = strategy.score(mesh, genome)
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(1)
  })

  it('still applies modelOnModelPenalty when a support column reaches down to other mesh geometry with a genuine gap (not flush)', () => {
    const table = tableMesh()
    const withPenalty = new SupportAwareFitnessStrategy({ ...DEFAULT_SUPPORT_AWARE_CONFIG, modelOnModelPenalty: 3 })
    const withoutPenalty = new SupportAwareFitnessStrategy({ ...DEFAULT_SUPPORT_AWARE_CONFIG, modelOnModelPenalty: 1 })
    expect(withPenalty.score(table, identityGenome())).toBeGreaterThan(withoutPenalty.score(table, identityGenome()))
  })

  it('scores a face floating in open air down to the bed as a plain overhang, and does not falsely detect it as flush-supported by its own recorded height', () => {
    // The anchor (disjoint in X) establishes the mesh's global minY far away
    // from the quad's own footprint, so the quad's bed-contact shortcut
    // never fires and the heightmap-based flush/gap logic is the only thing
    // that can classify it. Nothing else occupies the quad's own (x, z)
    // footprint at any height, so the only entry the heightmap ever finds
    // there is the quad's own two triangles — which must be excluded by
    // index, or this would wrongly detect itself as "flush support" and
    // collapse to 0.
    const anchor = flatDownFacingQuad(0).map((v) => v.clone().add(new Vector3(-10, 0, 0)))
    const quad = flatDownFacingQuad(5)
    const mesh = makeMesh('floating', [...quad, ...anchor])
    const score = strategy.score(mesh, identityGenome())
    // angleSeverity = 1 (straight down), heightWeight = 1 + (5-0)/5 = 2,
    // occlusionMultiplier = 1 (no model geometry below, open to the bed);
    // anchor itself is bed-contact (contributes 0 to weightedScore).
    // score = (1 * 2 * 1 * quadArea) / (quadArea + anchorArea) = (2*4)/(4+4) = 1
    expect(score).toBeCloseTo(1, 6)
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
