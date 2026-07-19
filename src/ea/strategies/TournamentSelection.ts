import { Individual } from '../../domain/individual'
import { SelectionStrategy } from './SelectionStrategy'

/**
 * Picks `tournamentSize` random individuals and returns the best of them.
 * Larger tournament size = stronger selection pressure toward the fittest.
 */
export class TournamentSelection implements SelectionStrategy {
  readonly name = 'tournament'

  constructor(private readonly tournamentSize: number = 3) {}

  selectParent(population: readonly Individual[]): Individual {
    const size = Math.min(this.tournamentSize, population.length)
    let best = population[Math.floor(Math.random() * population.length)]
    for (let i = 1; i < size; i++) {
      const candidate = population[Math.floor(Math.random() * population.length)]
      if (candidate.score < best.score) best = candidate
    }
    return best
  }
}
