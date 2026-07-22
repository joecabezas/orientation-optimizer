import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { makeLetterDMesh, TEST_MESHES } from './testMeshes'

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

describe('makeLetterDMesh', () => {
  // Regression check for the ring-based D: a wrong triangle winding anywhere
  // would silently flip a normal's direction, which the fitness strategies
  // rely on to detect overhangs -- so verify it directly rather than just
  // eyeballing the render. Geometry constants below mirror makeLetterDMesh's
  // own parameters (shared arc center, outer/inner radii, depth).
  const zMin = -2.5
  const zMax = 2.5
  const center = new Vector3(-10, 0, 0)
  const outerRadius = 15
  const innerRadius = 10
  const eps = 1e-6

  it('has front/back caps facing along Z and outer/inner walls facing radially', () => {
    const mesh = makeLetterDMesh()
    let frontCapCount = 0
    let backCapCount = 0
    let outerWallCount = 0
    let innerWallCount = 0

    for (const tri of mesh.triangles) {
      const zs = [tri.a.z, tri.b.z, tri.c.z]
      const allAtZMin = zs.every((z) => Math.abs(z - zMin) < eps)
      const allAtZMax = zs.every((z) => Math.abs(z - zMax) < eps)

      if (allAtZMin) {
        // Front cap: outward normal points in -Z.
        frontCapCount++
        expect(tri.normal.z).toBeCloseTo(-1, 5)
        continue
      }
      if (allAtZMax) {
        // Back cap: outward normal points in +Z.
        backCapCount++
        expect(tri.normal.z).toBeCloseTo(1, 5)
        continue
      }

      // Wall triangle (spans both zMin and zMax). Every wall vertex's (x,y)
      // lies exactly on the outer or inner loop, i.e. at radius outerRadius
      // or innerRadius from the shared arc center -- use that to classify
      // outer vs. inner wall.
      const v = tri.a
      const dist = Math.hypot(v.x - center.x, v.y - center.y)
      const isOuter = dist > (outerRadius + innerRadius) / 2
      expect(dist).toBeCloseTo(isOuter ? outerRadius : innerRadius, 5)

      // Expected direction in the X/Y plane: outward (away from the solid)
      // for the outer wall, and toward the shared center -- i.e. away from
      // the solid material and into the hollow interior -- for the inner
      // wall. On the arc, "away from center" / "toward center" is just the
      // radial direction (flipped for inner). On the one straight-edge wall
      // segment (all 3 vertices share the same X -- true only for the
      // top/bottom corner edge, never for two distinct arc samples), the
      // radial direction from center degenerates to a tangential vector
      // instead of an outward one, so use the known flat edge direction
      // (-X for outer, +X for inner) there instead.
      const xs = [tri.a.x, tri.b.x, tri.c.x]
      const isStraightEdge = xs.every((x) => Math.abs(x - xs[0]) < eps)
      const expected = isStraightEdge
        ? new Vector3(isOuter ? -1 : 1, 0, 0)
        : new Vector3(v.x - center.x, v.y - center.y, 0)
            .normalize()
            .multiplyScalar(isOuter ? 1 : -1)
      const dot = tri.normal.x * expected.x + tri.normal.y * expected.y

      if (isOuter) {
        outerWallCount++
      } else {
        innerWallCount++
      }
      expect(dot).toBeGreaterThan(0.3) // normal aligns with the expected outward/inward direction
    }

    expect(frontCapCount).toBeGreaterThan(0)
    expect(frontCapCount).toBe(backCapCount)
    expect(outerWallCount).toBeGreaterThan(0)
    expect(outerWallCount).toBe(innerWallCount)
  })

  it('is watertight: every directed edge has exactly one matching reverse edge', () => {
    const mesh = makeLetterDMesh()
    const key = (v: Vector3) => `${v.x.toFixed(5)},${v.y.toFixed(5)},${v.z.toFixed(5)}`
    const edgeCounts = new Map<string, number>()

    for (const tri of mesh.triangles) {
      for (const [p, q] of [
        [tri.a, tri.b],
        [tri.b, tri.c],
        [tri.c, tri.a],
      ] as const) {
        const k = `${key(p)}|${key(q)}`
        edgeCounts.set(k, (edgeCounts.get(k) ?? 0) + 1)
      }
    }

    for (const [k, count] of edgeCounts) {
      expect(count).toBe(1)
      const [a, b] = k.split('|')
      expect(edgeCounts.has(`${b}|${a}`)).toBe(true)
    }
  })
})
