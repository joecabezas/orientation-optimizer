import { Genome } from '../../domain/genome'

/** Combines two parent genomes into a child genome. */
export interface CrossoverStrategy {
  readonly name: string
  /** `generation` is the birth generation to stamp onto the resulting child genome. */
  crossover(parentA: Genome, parentB: Genome, generation: number): Genome
}
