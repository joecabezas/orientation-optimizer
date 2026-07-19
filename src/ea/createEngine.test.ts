import { describe, expect, it } from 'vitest'
import { createEngine } from './createEngine'
import { EA_PRESETS } from './EAConfig'
import { makeLBracketMesh, makeTiltedSlabMesh, makeAngledWedgeMesh } from '../meshes/testMeshes'

describe('createEngine', () => {
  it('defaults to the projected-area (critical-angle-free) fitness strategy', () => {
    expect(EA_PRESETS.fast.fitnessStrategy).toBe('projected-area')
  })

  it('runs an evolution loop end to end with the default strategy and improves or holds best score', () => {
    const mesh = makeLBracketMesh()
    const config = { ...EA_PRESETS.fast, maxGenerations: 10 }
    const engine = createEngine(mesh, config)

    const first = engine.start()
    let last = first
    for (let i = 0; i < config.maxGenerations; i++) {
      last = engine.step()
    }

    expect(last.generation).toBe(config.maxGenerations)
    // Evolution with elitism should never regress the best score.
    expect(last.best.score).toBeLessThanOrEqual(first.best.score)
  })

  it('builds an engine using the overhang-angle strategy when explicitly configured', () => {
    const mesh = makeLBracketMesh()
    const config = { ...EA_PRESETS.fast, fitnessStrategy: 'overhang-angle' as const, criticalOverhangAngleDeg: 45 }
    const engine = createEngine(mesh, config)
    const result = engine.start()
    expect(result.best.score).toBeGreaterThanOrEqual(0)
  })

  it.each([
    ['tilted-slab', makeTiltedSlabMesh],
    ['angled-wedge', makeAngledWedgeMesh],
  ])(
    '%s: generation-0 seeding does not already find the optimum, so the EA has real work to do',
    (_name, build) => {
      const mesh = build()
      const config = { ...EA_PRESETS.best, maxGenerations: 60 }
      const engine = createEngine(mesh, config)

      const first = engine.start()
      let last = first
      for (let i = 0; i < config.maxGenerations; i++) {
        last = engine.step()
      }

      // These meshes are built with a baked-in oblique tilt and no untilted
      // anchor component, so the axis-aligned seeding candidates should not
      // already be optimal — later generations must measurably improve on them.
      expect(last.best.score).toBeLessThan(first.best.score * 0.9)
    },
  )
})
