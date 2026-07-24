import { describe, expect, it } from 'vitest'
import { importMeshFile } from './meshImporters'

const ASCII_STL_ONE_TRIANGLE = `solid test
  facet normal 0 0 1
    outer loop
      vertex 0 0 0
      vertex 1 0 0
      vertex 0 1 0
    endloop
  endfacet
endsolid test
`

describe('importMeshFile', () => {
  it('resolves a Mesh for a supported extension', async () => {
    const file = new File([ASCII_STL_ONE_TRIANGLE], 'part.stl', { type: 'model/stl' })
    const mesh = await importMeshFile(file)
    expect(mesh.name).toBe('part.stl')
    expect(mesh.triangles).toHaveLength(1)
  })

  it('rejects an unsupported extension', async () => {
    const file = new File(['irrelevant'], 'part.obj')
    await expect(importMeshFile(file)).rejects.toThrow(/unsupported/i)
  })

  it('rejects malformed content with a descriptive error', async () => {
    const file = new File(['not an stl file'], 'garbage.stl')
    await expect(importMeshFile(file)).rejects.toThrow(/could not import/i)
  })
})
