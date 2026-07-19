import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { makeMesh, makeTriangle } from './mesh'

describe('makeTriangle', () => {
  it('computes an outward unit normal via right-hand winding', () => {
    const tri = makeTriangle(new Vector3(0, 0, 0), new Vector3(1, 0, 0), new Vector3(0, 1, 0))
    expect(tri.normal.x).toBeCloseTo(0)
    expect(tri.normal.y).toBeCloseTo(0)
    expect(tri.normal.z).toBeCloseTo(1)
    expect(tri.normal.length()).toBeCloseTo(1)
  })

  it('computes area via the cross-product formula', () => {
    const tri = makeTriangle(new Vector3(0, 0, 0), new Vector3(2, 0, 0), new Vector3(0, 3, 0))
    expect(tri.area).toBeCloseTo(3) // 1/2 * base * height = 1/2 * 2 * 3
  })

  it('degenerates to a zero normal and zero area for collinear points', () => {
    const tri = makeTriangle(new Vector3(0, 0, 0), new Vector3(1, 0, 0), new Vector3(2, 0, 0))
    expect(tri.area).toBeCloseTo(0)
    expect(tri.normal.length()).toBeCloseTo(0)
  })
})

describe('makeMesh', () => {
  it('groups vertex triples into triangles', () => {
    const mesh = makeMesh('test', [
      new Vector3(0, 0, 0),
      new Vector3(1, 0, 0),
      new Vector3(0, 1, 0),
      new Vector3(0, 0, 0),
      new Vector3(0, 1, 0),
      new Vector3(0, 0, 1),
    ])
    expect(mesh.triangles).toHaveLength(2)
    expect(mesh.name).toBe('test')
  })

  it('throws if vertex count is not a multiple of 3', () => {
    expect(() => makeMesh('bad', [new Vector3(), new Vector3()])).toThrow()
  })
})
