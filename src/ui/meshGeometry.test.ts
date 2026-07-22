import { describe, expect, it } from 'vitest'
import { Quaternion, Vector3 } from 'three'
import { makeMesh } from '../domain/mesh'
import { meshToGeometry, updateStraightDownColors } from './meshGeometry'

function triangleColor(geometry: ReturnType<typeof meshToGeometry>, triangleIndex: number): number[] {
  const colorAttr = geometry.getAttribute('color')
  const base = triangleIndex * 9
  return [colorAttr.array[base], colorAttr.array[base + 1], colorAttr.array[base + 2]]
}

describe('updateStraightDownColors', () => {
  it('highlights a triangle whose normal is exactly straight down under identity rotation', () => {
    const mesh = makeMesh('flat-down', [new Vector3(-1, 0, -1), new Vector3(1, 0, -1), new Vector3(1, 0, 1)])
    expect(mesh.triangles[0].normal.y).toBe(-1)

    const geometry = meshToGeometry(mesh)
    updateStraightDownColors(geometry, mesh, new Quaternion())

    const [r, g, b] = triangleColor(geometry, 0)
    // Highlight red (#e5484d) in linear space is brighter in R than G/B.
    expect(r).toBeGreaterThan(g)
    expect(r).toBeGreaterThan(b)
    expect(r).toBeGreaterThan(0.5)
  })

  it('does not highlight a triangle facing straight up', () => {
    const mesh = makeMesh('flat-up', [new Vector3(-1, 0, -1), new Vector3(1, 0, 1), new Vector3(1, 0, -1)])
    expect(mesh.triangles[0].normal.y).toBe(1)

    const geometry = meshToGeometry(mesh)
    updateStraightDownColors(geometry, mesh, new Quaternion())

    const [r, g, b] = triangleColor(geometry, 0)
    // Base color (#4f9dde) in linear space is brighter in B than R.
    expect(b).toBeGreaterThan(r)
  })

  it('does not highlight a vertical wall', () => {
    const mesh = makeMesh('wall', [new Vector3(-1, -1, 0), new Vector3(1, -1, 0), new Vector3(1, 1, 0)])
    expect(mesh.triangles[0].normal.y).toBe(0)

    const geometry = meshToGeometry(mesh)
    updateStraightDownColors(geometry, mesh, new Quaternion())

    const [r, g, b] = triangleColor(geometry, 0)
    expect(b).toBeGreaterThan(r)
  })

  it('does not highlight a near-but-not-exactly straight down face (strict equality)', () => {
    // A face whose normal is straight down locally, rotated by a tiny angle
    // so the resulting normal.y is extremely close to -1 but not exact —
    // documents the strict === -1 semantics rather than an angle tolerance.
    const mesh = makeMesh('flat-down', [new Vector3(-1, 0, -1), new Vector3(1, 0, -1), new Vector3(1, 0, 1)])
    const rotation = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 0.0001)

    const geometry = meshToGeometry(mesh)
    updateStraightDownColors(geometry, mesh, rotation)

    const [r, g, b] = triangleColor(geometry, 0)
    expect(b).toBeGreaterThan(r)
  })

  it('updates colors when called again with a different rotation (tracks live orientation)', () => {
    const mesh = makeMesh('flat-down', [new Vector3(-1, 0, -1), new Vector3(1, 0, -1), new Vector3(1, 0, 1)])
    const geometry = meshToGeometry(mesh)

    updateStraightDownColors(geometry, mesh, new Quaternion())
    const [rIdentity] = triangleColor(geometry, 0)
    expect(rIdentity).toBeGreaterThan(0.5)

    const flipped = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI)
    updateStraightDownColors(geometry, mesh, flipped)
    const [rFlipped, , bFlipped] = triangleColor(geometry, 0)
    expect(bFlipped).toBeGreaterThan(rFlipped)
  })
})
