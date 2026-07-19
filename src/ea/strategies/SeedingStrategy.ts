import { Genome } from '../../domain/genome'

/**
 * Produces the initial population. Typically front-loads a set of
 * "directional shell" rotations (axis-aligned, diagonal, etc.) that cover the
 * rotation space cheaply before the EA's mutation/crossover takes over, then
 * fills any remaining slots with random rotations.
 */
export interface SeedingStrategy {
  readonly name: string
  seed(populationSize: number): Genome[]
}
