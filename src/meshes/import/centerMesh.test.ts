import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { makeMesh } from '../../domain/mesh'
import { centerMesh } from './centerMesh'

describe('centerMesh', () => {
  it('translates a mesh so its bounding-box midpoint sits at the origin', () => {
    // A box offset far from the origin: [100,100,100] to [110,120,140].
    const mesh = makeMesh('offset-box', [
      new Vector3(100, 100, 100),
      new Vector3(110, 100, 100),
      new Vector3(100, 120, 140),
    ])

    const centered = centerMesh(mesh)

    const min = new Vector3(Infinity, Infinity, Infinity)
    const max = new Vector3(-Infinity, -Infinity, -Infinity)
    for (const tri of centered.triangles) {
      for (const v of [tri.a, tri.b, tri.c]) {
        min.min(v)
        max.max(v)
      }
    }
    const center = min.clone().add(max).multiplyScalar(0.5)
    expect(center.x).toBeCloseTo(0)
    expect(center.y).toBeCloseTo(0)
    expect(center.z).toBeCloseTo(0)
  })

  it('leaves an already-centered mesh unchanged', () => {
    // Bounding box is [-1,-1,0] to [1,1,0], already centered on the origin.
    const mesh = makeMesh('centered', [new Vector3(-1, -1, 0), new Vector3(1, -1, 0), new Vector3(0, 1, 0)])
    const centered = centerMesh(mesh)
    expect(centered.triangles[0].a).toMatchObject({ x: -1, y: -1, z: 0 })
  })

  it('preserves triangle normals and areas (translation-invariant)', () => {
    const mesh = makeMesh('offset', [new Vector3(50, 50, 0), new Vector3(53, 50, 0), new Vector3(50, 54, 0)])
    const centered = centerMesh(mesh)
    expect(centered.triangles[0].area).toBeCloseTo(mesh.triangles[0].area)
    expect(centered.triangles[0].normal.z).toBeCloseTo(mesh.triangles[0].normal.z)
  })
})
