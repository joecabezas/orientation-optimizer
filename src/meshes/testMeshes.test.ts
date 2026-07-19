import { describe, expect, it } from 'vitest'
import { TEST_MESHES } from './testMeshes'

describe('TEST_MESHES', () => {
  it('has a unique id for every registered mesh', () => {
    const ids = TEST_MESHES.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('builds a well-formed, non-empty mesh for every registered option', () => {
    for (const option of TEST_MESHES) {
      const mesh = option.build()
      expect(mesh.triangles.length).toBeGreaterThan(0)
      for (const tri of mesh.triangles) {
        expect(tri.area).toBeGreaterThanOrEqual(0)
        expect(Number.isFinite(tri.normal.length())).toBe(true)
      }
    }
  })
})
