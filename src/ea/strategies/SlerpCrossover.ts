import { Quaternion } from 'three'
import { Genome, makeGenome } from '../../domain/genome'
import { CrossoverStrategy } from './CrossoverStrategy'

/**
 * Spherically interpolates between two parent rotations at a random t, which
 * is the geometrically correct "blend" of two orientations (unlike averaging
 * Euler angles, which can produce a rotation unrelated to either parent).
 */
export class SlerpCrossover implements CrossoverStrategy {
  readonly name = 'slerp'

  crossover(parentA: Genome, parentB: Genome, generation: number): Genome {
    const t = Math.random()
    const child = new Quaternion().copy(parentA.rotation).slerp(parentB.rotation, t)
    return makeGenome(child, generation)
  }
}
