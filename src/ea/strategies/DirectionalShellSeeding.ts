import { Quaternion } from 'three'
import { Genome, makeGenome } from '../../domain/genome'
import { directionShell, rotationPointingUp, ShellLevel } from '../directionShells'
import { SeedingStrategy } from './SeedingStrategy'

/**
 * Seeds the population with directional-shell rotations (6/14/26 cube
 * directions mapped to "point this direction up"), then fills any remaining
 * population slots with uniformly random rotations for diversity.
 */
export class DirectionalShellSeeding implements SeedingStrategy {
  readonly name: string

  constructor(private readonly shellLevel: ShellLevel) {
    this.name = `directional-shell-${shellLevel}`
  }

  seed(populationSize: number): Genome[] {
    const directions = directionShell(this.shellLevel)
    const genomes: Genome[] = directions
      .slice(0, populationSize)
      .map((dir) => makeGenome(rotationPointingUp(dir)))

    while (genomes.length < populationSize) {
      genomes.push(makeGenome(randomQuaternion()))
    }

    return genomes
  }
}

/** Uniformly random unit quaternion (Marsaglia's method via three.js RNG). */
export function randomQuaternion(): Quaternion {
  const u1 = Math.random()
  const u2 = Math.random()
  const u3 = Math.random()
  const sqrt1u1 = Math.sqrt(1 - u1)
  const sqrtu1 = Math.sqrt(u1)
  return new Quaternion(
    sqrt1u1 * Math.sin(2 * Math.PI * u2),
    sqrt1u1 * Math.cos(2 * Math.PI * u2),
    sqrtu1 * Math.sin(2 * Math.PI * u3),
    sqrtu1 * Math.cos(2 * Math.PI * u3),
  )
}
