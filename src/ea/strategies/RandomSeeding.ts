import { Genome, makeGenome } from '../../domain/genome'
import { randomQuaternion } from './DirectionalShellSeeding'
import { SeedingStrategy } from './SeedingStrategy'

export class RandomSeeding implements SeedingStrategy {
  readonly name = 'random'

  seed(populationSize: number): Genome[] {
    return Array.from({ length: populationSize }, () => makeGenome(randomQuaternion()))
  }
}
