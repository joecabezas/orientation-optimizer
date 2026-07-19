import { Genome } from '../../domain/genome'

/** Combines two parent genomes into a child genome. */
export interface CrossoverStrategy {
  readonly name: string
  crossover(parentA: Genome, parentB: Genome): Genome
}
