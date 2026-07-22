import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { OverhangFitnessStrategy } from './OverhangFitnessStrategy'
import { identityGenome, meshFromFaces, normalAtAngleFromVertical } from './testFixtures'

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

  describe('explain', () => {
    const strategy = new OverhangFitnessStrategy()

    it('returns one contribution per triangle, matching score() as their weighted average', () => {
      const mesh = meshFromFaces([
        { normal: new Vector3(0, -1, 0), area: 3 },
        { normal: new Vector3(1, 0, 0), area: 5 },
      ])
      const genome = identityGenome()
      const explanation = strategy.explain(mesh, genome)

      expect(explanation.strategyName).toBe('overhang-angle')
      expect(explanation.triangleContributions).toHaveLength(mesh.triangles.length)
      expect(explanation.totalScore).toBeCloseTo(strategy.score(mesh, genome), 10)

      // Only the straight-down face should contribute; the vertical wall shouldn't.
      expect(explanation.triangleContributions[0]).toBeGreaterThan(0)
      expect(explanation.triangleContributions[1]).toBeCloseTo(0, 6)
    })

    it('returns an empty contributions array for an empty mesh instead of throwing', () => {
      const empty = meshFromFaces([])
      const explanation = strategy.explain(empty, identityGenome())
      expect(explanation.triangleContributions).toEqual([])
      expect(explanation.totalScore).toBe(0)
    })
  })
})
