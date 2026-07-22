import { Quaternion, Vector3 } from 'three'
import { Genome, makeGenome } from '../../domain/genome'
import { Mesh } from '../../domain/mesh'
import {
  eightDiagonalDirections,
  rotationPointingUp,
  sixAxisDirections,
  topFaceDirections,
  twelveEdgeDirections,
} from '../directionShells'
import { SeedingStrategy } from './SeedingStrategy'

export interface DirectionalShellSeedingOptions {
  readonly seedAxisDirections: boolean
  readonly seedDiagonalDirections: boolean
  readonly seedEdgeDirections: boolean
  readonly seedTopFaces: boolean
  readonly seedTopFacesCount: number
}

/** Rounds a direction to a stable string key for deduplication across sources. */
function directionKey(d: Vector3): string {
  return `${d.x.toFixed(3)},${d.y.toFixed(3)},${d.z.toFixed(3)}`
}

/**
 * Seeds the population from independently toggleable direction sources (cube
 * axes, corner diagonals, edge midpoints, and/or the mesh's own largest
 * faces), deduplicated, then fills any remaining population slots with
 * uniformly random rotations for diversity.
 */
export class DirectionalShellSeeding implements SeedingStrategy {
  readonly name = 'directional-shell'

  constructor(
    private readonly mesh: Mesh,
    private readonly options: DirectionalShellSeedingOptions,
  ) {}

  seed(populationSize: number): Genome[] {
    const { seedAxisDirections, seedDiagonalDirections, seedEdgeDirections, seedTopFaces, seedTopFacesCount } =
      this.options

    const directions: Vector3[] = []
    if (seedAxisDirections) directions.push(...sixAxisDirections())
    if (seedDiagonalDirections) directions.push(...eightDiagonalDirections())
    if (seedEdgeDirections) directions.push(...twelveEdgeDirections())
    if (seedTopFaces) directions.push(...topFaceDirections(this.mesh, seedTopFacesCount))

    const seen = new Set<string>()
    const deduped = directions.filter((d) => {
      const key = directionKey(d)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    const genomes: Genome[] = deduped.slice(0, populationSize).map((dir) => makeGenome(rotationPointingUp(dir)))

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
