import { Quaternion, Vector3 } from 'three'
import { Genome, makeGenome } from '../../domain/genome'
import { MutationStrategy } from './MutationStrategy'

/**
 * Perturbs the rotation by composing it with a small random axis-angle
 * rotation. `mutationRate` is interpreted as the maximum perturbation angle
 * in degrees, scaled by `mutationStrength` from config (0..1) — this avoids
 * any Euler-angle wraparound/gimbal issues since it operates directly on the
 * quaternion.
 */
export class AxisAngleMutation implements MutationStrategy {
  readonly name = 'axis-angle'

  constructor(private readonly maxAngleDeg: number = 30) {}

  mutate(genome: Genome, mutationStrength: number): Genome {
    const axis = new Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1)
    if (axis.lengthSq() < 1e-9) axis.set(1, 0, 0)
    axis.normalize()

    const angleDeg = (Math.random() * 2 - 1) * this.maxAngleDeg * mutationStrength
    const angleRad = (angleDeg * Math.PI) / 180
    const delta = new Quaternion().setFromAxisAngle(axis, angleRad)

    const mutated = genome.rotation.clone().multiply(delta)
    return makeGenome(mutated)
  }
}
