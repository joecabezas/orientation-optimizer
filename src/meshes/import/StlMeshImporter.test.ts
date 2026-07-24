import { describe, expect, it } from 'vitest'
import { stlMeshImporter } from './StlMeshImporter'

const ASCII_STL_TWO_TRIANGLES = `solid test
  facet normal 0 0 1
    outer loop
      vertex 0 0 0
      vertex 1 0 0
      vertex 0 1 0
    endloop
  endfacet
  facet normal 0 0 -1
    outer loop
      vertex 0 0 0
      vertex 0 1 0
      vertex 0 0 1
    endloop
  endfacet
endsolid test
`

function toBuffer(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer
}

describe('stlMeshImporter', () => {
  it('parses an ASCII STL into a Mesh with one triangle per facet', () => {
    const mesh = stlMeshImporter.parse(toBuffer(ASCII_STL_TWO_TRIANGLES), 'test.stl')
    expect(mesh.name).toBe('test.stl')
    expect(mesh.triangles).toHaveLength(2)
    expect(mesh.triangles[0].a).toMatchObject({ x: 0, y: 0, z: 0 })
    expect(mesh.triangles[0].b).toMatchObject({ x: 1, y: 0, z: 0 })
    expect(mesh.triangles[0].c).toMatchObject({ x: 0, y: 1, z: 0 })
  })

  it('throws for a file with no triangles', () => {
    expect(() => stlMeshImporter.parse(toBuffer('solid empty\nendsolid empty\n'), 'empty.stl')).toThrow()
  })
})
