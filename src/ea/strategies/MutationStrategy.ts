import { Genome } from '../../domain/genome'

/** Randomly perturbs a genome's rotation. Should return a new Genome, never mutate in place. */
export interface MutationStrategy {
  readonly name: string
  mutate(genome: Genome, mutationRate: number): Genome
}
