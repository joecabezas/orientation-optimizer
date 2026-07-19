import { describe, expect, it } from 'vitest'
import { createEngine } from './createEngine'
import { EA_PRESETS } from './EAConfig'
import { makeLBracketMesh } from '../meshes/testMeshes'

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
})
