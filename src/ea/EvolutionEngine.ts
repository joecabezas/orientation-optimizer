import { Mesh } from '../domain/mesh'
import { Genome } from '../domain/genome'
import { Individual } from '../domain/individual'
import { EAConfig } from './EAConfig'
import { FitnessStrategy } from './strategies/FitnessStrategy'
import { SeedingStrategy } from './strategies/SeedingStrategy'
import { SelectionStrategy } from './strategies/SelectionStrategy'
import { CrossoverStrategy } from './strategies/CrossoverStrategy'
import { MutationStrategy } from './strategies/MutationStrategy'

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
    const elites = sorted.slice(0, eliteCount).map((ind) => ind.genome)

    const children: Genome[] = [...elites]
    while (children.length < this.config.populationSize) {
      const parentA = this.strategies.selection.selectParent(sorted)
      const parentB = this.strategies.selection.selectParent(sorted)
      let child = this.strategies.crossover.crossover(parentA.genome, parentB.genome)
      if (Math.random() < this.config.mutationProbability) {
        child = this.strategies.mutation.mutate(child, this.config.mutationStrength)
      }
      children.push(child)
    }

    this.population = this.evaluate(children)
    this.generation += 1
    return this.currentResult()
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
