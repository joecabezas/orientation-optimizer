import { Mesh } from '../domain/mesh'
import { Genome, makeGenome, quaternionsExactlyEqual } from '../domain/genome'
import { Individual } from '../domain/individual'
import { EAConfig } from './EAConfig'
import { FitnessStrategy } from './strategies/FitnessStrategy'
import { SeedingStrategy } from './strategies/SeedingStrategy'
import { SelectionStrategy } from './strategies/SelectionStrategy'
import { CrossoverStrategy } from './strategies/CrossoverStrategy'
import { MutationStrategy } from './strategies/MutationStrategy'
import { randomQuaternion } from './strategies/DirectionalShellSeeding'

/** Retries a duplicate child this many times before giving up and injecting a random rotation. */
const MAX_BREED_ATTEMPTS = 8

export interface EvolutionStrategies {
  readonly fitness: FitnessStrategy
  readonly seeding: SeedingStrategy
  readonly selection: SelectionStrategy
  readonly crossover: CrossoverStrategy
  readonly mutation: MutationStrategy
}

export interface GenerationResult {
  readonly generation: number
  readonly population: readonly Individual[]
  readonly best: Individual
  readonly averageScore: number
}

/**
 * Orchestrates the generation loop. Holds no knowledge of *how* selection,
 * crossover, mutation, seeding, or fitness scoring work internally — those
 * are all pluggable strategies, so swapping algorithms never touches this
 * class (strategy pattern).
 */
export class EvolutionEngine {
  private population: Individual[] = []
  private generation = 0

  constructor(
    private readonly mesh: Mesh,
    private readonly config: EAConfig,
    private readonly strategies: EvolutionStrategies,
  ) {}

  /** Seeds and evaluates generation 0. Must be called before step(). */
  start(): GenerationResult {
    const genomes = this.strategies.seeding.seed(this.config.populationSize)
    this.population = this.evaluate(genomes)
    this.generation = 0
    return this.currentResult()
  }

  /** Advances one generation and returns the new evaluated population. */
  step(): GenerationResult {
    const sorted = [...this.population].sort((a, b) => a.score - b.score)
    const eliteCount = Math.max(1, Math.round(this.config.elitismFraction * this.config.populationSize))
    const elites = this.selectDistinctElites(sorted, eliteCount)
    const nextGeneration = this.generation + 1

    const children: Genome[] = [...elites]
    while (children.length < this.config.populationSize) {
      children.push(this.breedDistinctChild(sorted, children, nextGeneration))
    }

    this.population = this.evaluate(children)
    this.generation = nextGeneration
    return this.currentResult()
  }

  /**
   * Elitism should carry forward the population's best *distinct* rotations,
   * not just its best-scoring individuals: once the population converges,
   * many top scorers are literal duplicates of each other (the exact same
   * quaternion, just with a fresh seq/generation from crossover/mutation),
   * and blindly taking the top `eliteCount` would carry several copies of one rotation
   * forward as "elites" instead of preserving genuinely distinct candidates.
   * Orientations that are merely close, not exactly equal, are left alone.
   */
  private selectDistinctElites(sorted: readonly Individual[], eliteCount: number): Genome[] {
    const elites: Genome[] = []
    for (const individual of sorted) {
      if (elites.length >= eliteCount) break
      if (!elites.some((g) => quaternionsExactlyEqual(g.rotation, individual.genome.rotation))) {
        elites.push(individual.genome)
      }
    }
    return elites
  }

  /**
   * Breeds one child distinct (by rotation, not id) from every genome already
   * accepted into the next generation. Crossing over a parent with itself (or
   * with an exact duplicate of itself) reproduces that same rotation exactly,
   * so a plain crossover/mutate pass can otherwise fill the population with
   * duplicate quaternions under different genome seqs, which then keep
   * crossing over with each other and never actually explore new
   * orientations. Retries force a mutation — even if the probability roll
   * didn't call for one — so a repeat duplicate gets a real chance to
   * diverge; if it's still stuck after a few tries, injects a fresh random
   * rotation instead of giving up. Children that are merely close to an
   * existing genome, not exactly equal, are accepted as-is.
   */
  private breedDistinctChild(sorted: readonly Individual[], existing: readonly Genome[], generation: number): Genome {
    for (let attempt = 0; attempt < MAX_BREED_ATTEMPTS; attempt++) {
      const parentA = this.strategies.selection.selectParent(sorted)
      const parentB = this.strategies.selection.selectParent(sorted)
      let child = this.strategies.crossover.crossover(parentA.genome, parentB.genome, generation)
      if (attempt > 0 || Math.random() < this.config.mutationProbability) {
        child = this.strategies.mutation.mutate(child, this.config.mutationStrength, generation)
      }
      if (!existing.some((g) => quaternionsExactlyEqual(g.rotation, child.rotation))) {
        return child
      }
    }
    return makeGenome(randomQuaternion(), generation)
  }

  get currentGeneration(): number {
    return this.generation
  }

  get isDone(): boolean {
    return this.generation >= this.config.maxGenerations
  }

  /** The fitness strategy this engine scores with, exposed read-only for UI features like the score explainer. */
  get fitnessStrategy(): FitnessStrategy {
    return this.strategies.fitness
  }

  private evaluate(genomes: readonly Genome[]): Individual[] {
    return genomes.map((genome) => ({ genome, score: this.strategies.fitness.score(this.mesh, genome) }))
  }

  private currentResult(): GenerationResult {
    const sorted = [...this.population].sort((a, b) => a.score - b.score)
    const best = sorted[0]
    const averageScore = sorted.reduce((sum, ind) => sum + ind.score, 0) / sorted.length
    return { generation: this.generation, population: sorted, best, averageScore }
  }
}
