import { Genome } from '../../domain/genome'

/** Randomly perturbs a genome's rotation. Should return a new Genome, never mutate in place. */
export interface MutationStrategy {
  readonly name: string
  /** `generation` is the birth generation to stamp onto the resulting genome. */
  mutate(genome: Genome, mutationRate: number, generation: number): Genome
}
