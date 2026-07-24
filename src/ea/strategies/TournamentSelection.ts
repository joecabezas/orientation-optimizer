import { Individual } from '../../domain/individual'
import { SelectionStrategy } from './SelectionStrategy'

function pickRandom(population: readonly Individual[]): Individual {
  return population[Math.floor(Math.random() * population.length)]
}

/**
 * Picks `tournamentSize` random individuals and returns the best of them.
 * Larger tournament size = stronger selection pressure toward the fittest.
 */
export class TournamentSelection implements SelectionStrategy {
  readonly name = 'tournament'

  constructor(private readonly tournamentSize: number = 3) {}

  selectParent(population: readonly Individual[]): Individual {
    const size = Math.min(this.tournamentSize, population.length)
    let best = pickRandom(population)
    for (let i = 1; i < size; i++) {
      const candidate = pickRandom(population)
      if (candidate.score < best.score) best = candidate
    }
    return best
  }
}
