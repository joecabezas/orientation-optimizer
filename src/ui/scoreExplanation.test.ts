import { describe, expect, it } from 'vitest'
import { Quaternion, Vector3 } from 'three'
import { makeTriangle, Mesh } from '../domain/mesh'
import { makeGenome } from '../domain/genome'
import { SupportAwareFitnessStrategy } from '../ea/strategies/SupportAwareFitnessStrategy'
import { ProjectedAreaFitnessStrategy } from '../ea/strategies/ProjectedAreaFitnessStrategy'
import { FitnessStrategy } from '../ea/strategies/FitnessStrategy'
import { buildScoreExplanation } from './scoreExplanation'

function identityGenome() {
  return makeGenome(new Quaternion())
}

/** A mesh with a low, flat, bed-resting base and an elevated, straight-down, unsupported face. */
function baseWithElevatedOverhang(): Mesh {
  const base = makeTriangle(new Vector3(-11, 0, -1), new Vector3(-9, 0, -1), new Vector3(-9, 0, 1))
  const elevatedDownFace = makeTriangle(new Vector3(-1, 5, -1), new Vector3(1, 5, -1), new Vector3(1, 5, 1))
  return { name: 'base-with-overhang', triangles: [base, elevatedDownFace] }
}

describe('buildScoreExplanation', () => {
  const strategy: FitnessStrategy = new SupportAwareFitnessStrategy()

  it('returns undefined when the active strategy has no explain() implementation', () => {
    const noExplain: FitnessStrategy = { name: 'stub', score: () => 0 }
    const mesh = baseWithElevatedOverhang()
    expect(buildScoreExplanation(mesh, identityGenome(), noExplain)).toBeUndefined()
  })

  it('identifies only the elevated overhang face as contributing, near the top of the print', () => {
    const mesh = baseWithElevatedOverhang()
    const summary = buildScoreExplanation(mesh, identityGenome(), strategy)

    expect(summary).toBeDefined()
    expect(summary!.totalTriangleCount).toBe(2)
    expect(summary!.contributingTriangleCount).toBe(1)
    expect(summary!.contributingAreaFraction).toBeCloseTo(0.5, 6)
    expect(summary!.averageHeightFraction).toBeCloseTo(1, 6) // the only contributor sits at the mesh's max height
    expect(summary!.normalizedContributions).toHaveLength(2)
    expect(summary!.normalizedContributions[0]).toBeCloseTo(0, 6) // base, resting on bed
    expect(summary!.normalizedContributions[1]).toBeCloseTo(1, 6) // sole contributor normalizes to 1
    expect(summary!.summaryText).toContain('1 of 2 triangles')
    expect(summary!.summaryText).toContain('top')
  })

  it('reports zero contributing triangles with a "no support needed" summary when nothing overhangs', () => {
    const wall = makeTriangle(new Vector3(0, 0, 0), new Vector3(0, 1, 0), new Vector3(1, 0, 0))
    const mesh: Mesh = { name: 'wall', triangles: [wall] }
    const summary = buildScoreExplanation(mesh, identityGenome(), strategy)

    expect(summary!.contributingTriangleCount).toBe(0)
    expect(summary!.averageHeightFraction).toBeUndefined()
    expect(summary!.summaryText.toLowerCase()).toContain('no triangles need support')
  })

  it('works with any FitnessStrategy implementing explain(), not just SupportAwareFitnessStrategy', () => {
    const mesh = baseWithElevatedOverhang()
    const summary = buildScoreExplanation(mesh, identityGenome(), new ProjectedAreaFitnessStrategy())
    expect(summary).toBeDefined()
    expect(summary!.strategyName).toBe('projected-area')
  })
})
