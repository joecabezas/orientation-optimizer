import { describe, expect, it } from 'vitest'
import { Quaternion, Vector3 } from 'three'
import { makeMesh, Mesh } from '../../domain/mesh'
import { makeGenome } from '../../domain/genome'
import { OverhangFitnessStrategy } from './OverhangFitnessStrategy'

function identityGenome() {
  return makeGenome(new Quaternion())
}

/**
 * A downward-tilted normal at the given angle from vertical (0deg = vertical
 * wall, 90deg = straight down), matching OverhangFitnessStrategy's own
 * convention: fromVerticalDeg = 90 - acos(-normal.y), i.e. normal.y = -sin(fromVerticalDeg).
 */
function normalAtAngleFromVertical(fromVerticalDeg: number): Vector3 {
  const rad = (fromVerticalDeg * Math.PI) / 180
  return new Vector3(0, -Math.sin(rad), Math.cos(rad))
}

/** Builds a mesh from explicit (normal, area) pairs, placed as tiny triangles far apart so areas don't overlap. */
function meshFromFaces(faces: readonly { normal: Vector3; area: number }[]): Mesh {
  const tris: Vector3[] = []
  faces.forEach((f, i) => {
    // Build a right triangle whose normal is f.normal and area is f.area, offset per-face.
    const n = f.normal.clone().normalize()
    // Pick an arbitrary vector not parallel to n.
    const helper = Math.abs(n.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0)
    const u = helper.clone().cross(n).normalize()
    const v = n.clone().cross(u).normalize()
    const legLength = Math.sqrt(2 * f.area)
    const offset = new Vector3(i * 1000, 0, 0) // keep faces from interacting
    const a = offset.clone()
    const b = offset.clone().add(u.clone().multiplyScalar(legLength))
    const c = offset.clone().add(v.clone().multiplyScalar(legLength))
    tris.push(a, b, c)
  })
  return makeMesh('synthetic', tris)
}

describe('OverhangFitnessStrategy', () => {
  it('scores 0 for a vertical wall regardless of critical angle', () => {
    const wall = meshFromFaces([{ normal: new Vector3(1, 0, 0), area: 1 }])
    for (const critical of [20, 45, 70]) {
      const strategy = new OverhangFitnessStrategy({ criticalOverhangAngleDeg: critical, transitionWidthDeg: 20 })
      expect(strategy.score(wall, identityGenome())).toBeCloseTo(0, 6)
    }
  })

  it('scores ~1 for a face pointing straight down regardless of critical angle', () => {
    const downFace = meshFromFaces([{ normal: new Vector3(0, -1, 0), area: 1 }])
    for (const critical of [20, 45, 70]) {
      const strategy = new OverhangFitnessStrategy({ criticalOverhangAngleDeg: critical, transitionWidthDeg: 20 })
      expect(strategy.score(downFace, identityGenome())).toBeCloseTo(1, 6)
    }
  })

  it('scores 0 for both orientations of a mesh whose steepest face is within a lenient critical angle', () => {
    // Orientation A: one wall (0deg from vertical) + one 60deg-from-vertical face.
    const orientationA = meshFromFaces([
      { normal: new Vector3(1, 0, 0), area: 1 }, // 0deg from vertical
      { normal: normalAtAngleFromVertical(60), area: 1 },
    ])
    // Orientation B: two faces at 30deg from vertical.
    const orientationB = meshFromFaces([
      { normal: normalAtAngleFromVertical(30), area: 1 },
      { normal: normalAtAngleFromVertical(30), area: 1 },
    ])

    const lenientPrinter = new OverhangFitnessStrategy({ criticalOverhangAngleDeg: 70, transitionWidthDeg: 20 })
    expect(lenientPrinter.score(orientationA, identityGenome())).toBeCloseTo(0, 3)
    expect(lenientPrinter.score(orientationB, identityGenome())).toBeCloseTo(0, 3)
  })

  it('can rank two orientations differently depending on critical overhang angle', () => {
    // This documents *why* criticalOverhangAngleDeg exists as a config knob:
    // ranking under this strategy is not guaranteed invariant to critical angle
    // when two orientations' angle-vs-area distributions cross.
    //
    // orientationX: one large face at a moderate 50deg tilt (all of it).
    // orientationY: a small steep 89deg face plus a large 0deg wall (which never needs support).
    const orientationX = meshFromFaces([{ normal: normalAtAngleFromVertical(50), area: 10 }])
    const orientationY = meshFromFaces([
      { normal: normalAtAngleFromVertical(89), area: 2 },
      { normal: new Vector3(1, 0, 0), area: 8 },
    ])

    const strictPrinter = new OverhangFitnessStrategy({ criticalOverhangAngleDeg: 45, transitionWidthDeg: 10 })
    const lenientPrinter = new OverhangFitnessStrategy({ criticalOverhangAngleDeg: 85, transitionWidthDeg: 10 })

    const strictScores = {
      x: strictPrinter.score(orientationX, identityGenome()),
      y: strictPrinter.score(orientationY, identityGenome()),
    }
    const lenientScores = {
      x: lenientPrinter.score(orientationX, identityGenome()),
      y: lenientPrinter.score(orientationY, identityGenome()),
    }

    // Under the strict 45deg printer, orientation Y (small steep face, big wall) wins.
    expect(strictScores.y).toBeLessThan(strictScores.x)
    // Under the lenient 85deg printer, the ranking flips: orientation X now wins,
    // because its 50deg face falls below the raised critical threshold entirely
    // while Y's 89deg face still counts against it.
    expect(lenientScores.x).toBeLessThan(lenientScores.y)
  })
})
