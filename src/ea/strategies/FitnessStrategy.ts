import { Mesh } from '../../domain/mesh'
import { Genome } from '../../domain/genome'

/**
 * Scores how much support material a mesh would need when printed at a given
 * rotation. Lower is better. Implementations must be pure functions of
 * (mesh, genome) so they can be swapped freely (strategy pattern).
 */
export interface FitnessStrategy {
  readonly name: string
  score(mesh: Mesh, genome: Genome): number
}
