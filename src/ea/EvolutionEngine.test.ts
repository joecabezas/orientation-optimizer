import { describe, expect, it } from 'vitest'
import { Quaternion, Vector3 } from 'three'
import { EvolutionEngine } from './EvolutionEngine'
import { Genome, makeGenome, quaternionsExactlyEqual } from '../domain/genome'
import { EA_PRESETS } from './EAConfig'
import { makeCubeMesh } from '../meshes/testMeshes'
import { FitnessStrategy } from './strategies/FitnessStrategy'
import { SeedingStrategy } from './strategies/SeedingStrategy'
import { SelectionStrategy } from './strategies/SelectionStrategy'
import { CrossoverStrategy } from './strategies/CrossoverStrategy'
import { MutationStrategy } from './strategies/MutationStrategy'

const A = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 0.1)
const B = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.2)
const C = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 0.3)

describe('EvolutionEngine duplicate handling', () => {
  it('carries forward the best *distinct* rotations as elites, not literal duplicates under different seqs', () => {
    const mesh = makeCubeMesh()

    // Three individuals share the exact same (best-scoring) rotation A, plus
    // one each of two other distinct, worse-scoring rotations B and C.
    const gA1 = makeGenome(A, 0)
    const gA2 = makeGenome(A, 0)
    const gA3 = makeGenome(A, 0)
    const gB = makeGenome(B, 0)
    const gC = makeGenome(C, 0)
    const initialPopulation = [gA1, gA2, gA3, gB, gC]

    // Score keyed by genome identity (not id/seq), so the fixture doesn't
    // care how genomes are identified internally.
    const scoreByGenome = new Map<Genome, number>([
      [gA1, 0],
      [gA2, 0],
      [gA3, 0],
      [gB, 1],
      [gC, 2],
    ])
    const fitness: FitnessStrategy = {
      name: 'fixed-lookup',
      score: (_mesh, g) => scoreByGenome.get(g) ?? 99,
    }
    const seeding: SeedingStrategy = { name: 'fixed', seed: () => initialPopulation }
    // Always breed from the top-ranked individual, maximizing duplicate risk.
    const selection: SelectionStrategy = { name: 'first', selectParent: (pop) => pop[0] }
    // Crossover of a parent with itself reproduces its rotation exactly, as SlerpCrossover would.
    const crossover: CrossoverStrategy = { name: 'copy', crossover: (a, _b, generation) => makeGenome(a.rotation, generation) }
    let mutationCounter = 0
    const mutation: MutationStrategy = {
      name: 'diverge',
      mutate: (g, _rate, generation) => {
        mutationCounter += 1
        const delta = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), mutationCounter * 0.01)
        return makeGenome(g.rotation.clone().multiply(delta), generation)
      },
    }

    // populationSize 5, elitismFraction 0.6 -> eliteCount = round(0.6*5) = 3.
    const config = { ...EA_PRESETS.fast, populationSize: 5, elitismFraction: 0.6, mutationProbability: 0 }
    const engine = new EvolutionEngine(mesh, config, { fitness, seeding, selection, crossover, mutation })
    engine.start()
    const next = engine.step()

    expect(next.population).toHaveLength(5)

    // Only one copy of A should survive into elitism, not three.
    const aCount = next.population.filter((ind) => quaternionsExactlyEqual(ind.genome.rotation, A)).length
    expect(aCount).toBe(1)
    expect(next.population.some((ind) => quaternionsExactlyEqual(ind.genome.rotation, B))).toBe(true)
    expect(next.population.some((ind) => quaternionsExactlyEqual(ind.genome.rotation, C))).toBe(true)

    // A, B, and C all survive as elites (eliteCount is 3, and there are
    // exactly 3 distinct rotations), so they keep their original birth
    // generation (0). The other 2 population slots are freshly bred children,
    // which belong to the new generation (1).
    for (const rotation of [A, B, C]) {
      const elite = next.population.find((ind) => quaternionsExactlyEqual(ind.genome.rotation, rotation))
      expect(elite?.genome.generation).toBe(0)
    }
    const bred = next.population.filter(
      (ind) =>
        !quaternionsExactlyEqual(ind.genome.rotation, A) &&
        !quaternionsExactlyEqual(ind.genome.rotation, B) &&
        !quaternionsExactlyEqual(ind.genome.rotation, C),
    )
    expect(bred).toHaveLength(2)
    expect(bred.every((ind) => ind.genome.generation === 1)).toBe(true)

    // Every individual in the new generation should be a pairwise-distinct rotation.
    for (let i = 0; i < next.population.length; i++) {
      for (let j = i + 1; j < next.population.length; j++) {
        expect(quaternionsExactlyEqual(next.population[i].genome.rotation, next.population[j].genome.rotation)).toBe(
          false,
        )
      }
    }
  })
})
