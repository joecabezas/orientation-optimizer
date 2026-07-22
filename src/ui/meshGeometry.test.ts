import { describe, expect, it } from 'vitest'
import { Quaternion, Vector3 } from 'three'
import { makeMesh } from '../domain/mesh'
import { meshToGeometry, updateContributionColors, updateStraightDownColors } from './meshGeometry'

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

    const [r, , b] = triangleColor(geometry, 0)
    // Base color (#4f9dde) in linear space is brighter in B than R.
    expect(b).toBeGreaterThan(r)
  })

  it('does not highlight a vertical wall', () => {
    const mesh = makeMesh('wall', [new Vector3(-1, -1, 0), new Vector3(1, -1, 0), new Vector3(1, 1, 0)])
    expect(mesh.triangles[0].normal.y).toBe(0)

    const geometry = meshToGeometry(mesh)
    updateStraightDownColors(geometry, mesh, new Quaternion())

    const [r, , b] = triangleColor(geometry, 0)
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

    const [r, , b] = triangleColor(geometry, 0)
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

describe('updateContributionColors', () => {
  /** Three disjoint triangles so per-triangle colors can be inspected independently. */
  function threeTriangleMesh() {
    return makeMesh('three', [
      new Vector3(0, 0, 0),
      new Vector3(1, 0, 0),
      new Vector3(0, 1, 0),
      new Vector3(10, 0, 0),
      new Vector3(11, 0, 0),
      new Vector3(10, 1, 0),
      new Vector3(20, 0, 0),
      new Vector3(21, 0, 0),
      new Vector3(20, 1, 0),
    ])
  }

  it('colors a zero-contribution triangle neutral gray and the top contributor bright plasma yellow', () => {
    const mesh = threeTriangleMesh()
    const geometry = meshToGeometry(mesh)
    updateContributionColors(geometry, mesh, [0, 0.5, 1])

    const [rZero, gZero, bZero] = triangleColor(geometry, 0)
    // #6b7078 in linear space: r and b close together, g slightly higher — a
    // neutral gray, not a hue from the ramp (which is never r ≈ b at low t).
    expect(rZero).toBeCloseTo(bZero, 1)
    expect(gZero).toBeGreaterThanOrEqual(rZero)

    const [rHigh, gHigh, bHigh] = triangleColor(geometry, 2)
    // Plasma's t=1 stop (#f0f921) is bright yellow: high red and green, low blue.
    expect(rHigh).toBeGreaterThan(bHigh)
    expect(gHigh).toBeGreaterThan(bHigh)
  })

  it('colors the low end of the ramp dark purple/blue for a small but nonzero contribution', () => {
    const mesh = threeTriangleMesh()
    const geometry = meshToGeometry(mesh)
    updateContributionColors(geometry, mesh, [0.001, 0.5, 1])

    const [r, g, b] = triangleColor(geometry, 0)
    // Near plasma's t=0 stop (#0d0887): blue dominant, red/green low — distinct
    // from both the mid-ramp warm hues and the neutral zero-contribution gray.
    expect(b).toBeGreaterThan(r)
    expect(b).toBeGreaterThan(g)
  })

  it('produces a plasma ramp that gets monotonically "hotter" (more red, less blue) as contribution increases', () => {
    const mesh = threeTriangleMesh()
    const geometry = meshToGeometry(mesh)
    updateContributionColors(geometry, mesh, [0.001, 0.5, 1])

    const colors = [0, 1, 2].map((i) => triangleColor(geometry, i))
    for (let i = 1; i < colors.length; i++) {
      expect(colors[i][0]).toBeGreaterThanOrEqual(colors[i - 1][0]) // red non-decreasing
      expect(colors[i][2]).toBeLessThanOrEqual(colors[i - 1][2]) // blue non-increasing
    }
  })

  it('avoids pure black/white extremes across the whole ramp, so it stays legible under scene lighting', () => {
    const mesh = threeTriangleMesh()
    const geometry = meshToGeometry(mesh)
    updateContributionColors(geometry, mesh, [0.01, 0.25, 0.5, 0.75, 1].slice(0, mesh.triangles.length))

    for (let i = 0; i < mesh.triangles.length; i++) {
      const [r, g, b] = triangleColor(geometry, i)
      expect(r + g + b).toBeGreaterThan(0.1)
      expect(Math.max(r, g, b)).toBeLessThan(1)
    }
  })

  it('defaults to the neutral zero-contribution gray for triangles missing from a shorter contributions array', () => {
    const mesh = threeTriangleMesh()
    const geometry = meshToGeometry(mesh)
    // Only triangle 0 has an explicit (high) contribution; 1 and 2 are absent
    // from the array entirely and should fall back to zero, not undefined/NaN.
    updateContributionColors(geometry, mesh, [1])

    const [r0, g0, b0] = triangleColor(geometry, 0)
    const [r1, , b1] = triangleColor(geometry, 1)
    const [r2, , b2] = triangleColor(geometry, 2)
    expect(r0).toBeGreaterThan(b0) // present and hot (plasma yellow)
    expect(g0).toBeGreaterThan(b0)
    expect(r1).toBeCloseTo(b1, 1) // missing, defaults to neutral gray
    expect(r2).toBeCloseTo(b2, 1) // missing, defaults to neutral gray
  })
})
