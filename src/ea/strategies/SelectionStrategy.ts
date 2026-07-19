import { Individual } from '../../domain/individual'

/**
 * Picks parents from an evaluated population for producing the next
 * generation. Lower score is better (fitness = support material to minimize).
 */
export interface SelectionStrategy {
  readonly name: string
  /** Selects a single parent from the population. Called repeatedly per child needed. */
  selectParent(population: readonly Individual[]): Individual
}
