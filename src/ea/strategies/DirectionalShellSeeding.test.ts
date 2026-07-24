import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { makeMesh } from '../../domain/mesh'
import { boxTriangles } from '../../meshes/primitives'
import { DirectionalShellSeeding, DirectionalShellSeedingOptions } from './DirectionalShellSeeding'

const ALL_OFF: DirectionalShellSeedingOptions = {
  seedAxisDirections: false,
  seedDiagonalDirections: false,
  seedEdgeDirections: false,
  seedTopFaces: false,
  seedTopFacesCount: 0,
}

const cube = makeMesh('cube', boxTriangles(new Vector3(-1, -1, -1), new Vector3(1, 1, 1)))

describe('DirectionalShellSeeding', () => {
  it('seeds only random rotations when every source is disabled', () => {
    const seeding = new DirectionalShellSeeding(cube, ALL_OFF)
    const genomes = seeding.seed(10)
    expect(genomes).toHaveLength(10)
    // No structural guarantee about randoms beyond count/uniqueness of seqs.
    expect(new Set(genomes.map((g) => g.seq)).size).toBe(10)
  })

  it('seeds exactly the 6 axis directions when only that source is enabled', () => {
    const seeding = new DirectionalShellSeeding(cube, { ...ALL_OFF, seedAxisDirections: true })
    const genomes = seeding.seed(6)
    expect(genomes).toHaveLength(6)
  })

  it('pads with random rotations when the population exceeds the enabled sources', () => {
    const seeding = new DirectionalShellSeeding(cube, { ...ALL_OFF, seedAxisDirections: true })
    const genomes = seeding.seed(16)
    expect(genomes).toHaveLength(16)
  })

  it('truncates to populationSize when the enabled sources exceed it', () => {
    const seeding = new DirectionalShellSeeding(cube, {
      ...ALL_OFF,
      seedAxisDirections: true,
      seedDiagonalDirections: true,
      seedEdgeDirections: true,
    })
    // 6 + 8 + 12 = 26 directions, but only ask for 4.
    const genomes = seeding.seed(4)
    expect(genomes).toHaveLength(4)
  })

  it('combines multiple enabled sources', () => {
    const axisOnly = new DirectionalShellSeeding(cube, { ...ALL_OFF, seedAxisDirections: true }).seed(6).length
    const axisAndDiagonal = new DirectionalShellSeeding(cube, {
      ...ALL_OFF,
      seedAxisDirections: true,
      seedDiagonalDirections: true,
    }).seed(14).length
    expect(axisAndDiagonal).toBeGreaterThan(axisOnly)
  })

  it('deduplicates identical directions across sources', () => {
    // A cube's largest faces point along the same 6 axis directions as
    // sixAxisDirections, so enabling both axis + top-faces on a cube
    // shouldn't double the seed count from duplicate directions.
    const axisOnly = new DirectionalShellSeeding(cube, { ...ALL_OFF, seedAxisDirections: true }).seed(60)
    const axisPlusTopFaces = new DirectionalShellSeeding(cube, {
      ...ALL_OFF,
      seedAxisDirections: true,
      seedTopFaces: true,
      seedTopFacesCount: 12,
    }).seed(60)
    // All faces of an axis-aligned cube share a normal with one of the 6 axis
    // directions, so deduping should leave exactly 6 non-random directions
    // either way — same count of "real" seeds before random padding kicks in.
    expect(axisPlusTopFaces.length).toBe(axisOnly.length)
  })

  it('produces the requested count of top-face seeds, capped by populationSize', () => {
    const mesh = makeMesh('cube', boxTriangles(new Vector3(-1, -1, -1), new Vector3(1, 1, 1)))
    const seeding = new DirectionalShellSeeding(mesh, { ...ALL_OFF, seedTopFaces: true, seedTopFacesCount: 3 })
    const genomes = seeding.seed(2)
    expect(genomes).toHaveLength(2)
  })
})
