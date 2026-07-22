import { Vector3 } from 'three'
import { Mesh, Triangle } from '../domain/mesh'
import { Genome } from '../domain/genome'
import { FitnessStrategy } from '../ea/strategies/FitnessStrategy'

/** A ready-to-render summary of what's driving a genome's score, for the score explainer popover. */
export interface ScoreExplanationSummary {
  readonly totalScore: number
  readonly strategyName: string
  readonly totalTriangleCount: number
  /** Triangles with a meaningfully nonzero contribution to the score. */
  readonly contributingTriangleCount: number
  /** Fraction (0..1) of the mesh's total surface area that those contributing triangles cover. */
  readonly contributingAreaFraction: number
  /**
   * Contribution-weighted average height of the contributing triangles within
   * the mesh's rotated vertical extent, 0 = resting at the bottom, 1 = at the
   * very top. Undefined when there are no contributing triangles.
   */
  readonly averageHeightFraction: number | undefined
  /** Short, derived-from-the-numbers human summary of the score. */
  readonly summaryText: string
  /**
   * Per-triangle contribution normalized to [0, 1] (0 = no contribution, 1 =
   * the mesh's single highest-contributing triangle), index-aligned with
   * `Mesh.triangles` — feed directly to the 3D view's color ramp.
   */
  readonly normalizedContributions: readonly number[]
}

const NEGLIGIBLE_CONTRIBUTION = 1e-9

function rotatedCentroidY(tri: Triangle, rotation: Genome['rotation']): number {
  return new Vector3().addVectors(tri.a, tri.b).add(tri.c).divideScalar(3).applyQuaternion(rotation).y
}

/**
 * Builds a human-readable explanation of a genome's score from the fitness
 * strategy's real per-triangle contributions — nothing here is hardcoded
 * independent of the actual numbers. Returns undefined if the active strategy
 * doesn't implement explain() (feature-detected, since it's an optional
 * FitnessStrategy method).
 */
export function buildScoreExplanation(
  mesh: Mesh,
  genome: Genome,
  strategy: FitnessStrategy,
): ScoreExplanationSummary | undefined {
  if (!strategy.explain) return undefined
  const { totalScore, triangleContributions } = strategy.explain(mesh, genome)

  const maxContribution = triangleContributions.reduce((max, c) => Math.max(max, c), 0)
  const normalizedContributions =
    maxContribution > 0 ? triangleContributions.map((c) => c / maxContribution) : triangleContributions.map(() => 0)

  let minY = Infinity
  let maxY = -Infinity
  let totalArea = 0
  const rotatedYByTriangle = new Array<number>(mesh.triangles.length)
  mesh.triangles.forEach((tri, i) => {
    const y = rotatedCentroidY(tri, genome.rotation)
    rotatedYByTriangle[i] = y
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
    totalArea += tri.area
  })
  const verticalExtent = Math.max(maxY - minY, 1e-9)

  let contributingTriangleCount = 0
  let contributingArea = 0
  let heightWeightSum = 0
  let heightWeightTotal = 0
  mesh.triangles.forEach((tri, i) => {
    const contribution = triangleContributions[i] ?? 0
    if (contribution <= NEGLIGIBLE_CONTRIBUTION) return
    contributingTriangleCount += 1
    contributingArea += tri.area
    const heightFraction = (rotatedYByTriangle[i] - minY) / verticalExtent
    heightWeightSum += heightFraction * contribution
    heightWeightTotal += contribution
  })

  const contributingAreaFraction = totalArea > 0 ? contributingArea / totalArea : 0
  const averageHeightFraction = heightWeightTotal > 0 ? heightWeightSum / heightWeightTotal : undefined

  const summaryText = buildSummaryText({
    strategyName: strategy.name,
    totalScore,
    totalTriangleCount: mesh.triangles.length,
    contributingTriangleCount,
    contributingAreaFraction,
    averageHeightFraction,
  })

  return {
    totalScore,
    strategyName: strategy.name,
    totalTriangleCount: mesh.triangles.length,
    contributingTriangleCount,
    contributingAreaFraction,
    averageHeightFraction,
    summaryText,
    normalizedContributions,
  }
}

function buildSummaryText(args: {
  strategyName: string
  totalScore: number
  totalTriangleCount: number
  contributingTriangleCount: number
  contributingAreaFraction: number
  averageHeightFraction: number | undefined
}): string {
  const { totalScore, totalTriangleCount, contributingTriangleCount, contributingAreaFraction, averageHeightFraction } =
    args

  if (contributingTriangleCount === 0 || totalScore <= NEGLIGIBLE_CONTRIBUTION) {
    return 'No triangles need support material at this orientation — the score is effectively zero.'
  }

  const pct = Math.round(contributingAreaFraction * 100)
  const heightPhrase =
    averageHeightFraction === undefined
      ? ''
      : averageHeightFraction >= 0.66
        ? ', concentrated near the top of the print'
        : averageHeightFraction <= 0.33
          ? ', concentrated near the bottom of the print'
          : ', spread through the middle of the print'

  return (
    `${contributingTriangleCount} of ${totalTriangleCount} triangles ` +
    `(${pct}% of surface area) are driving this score${heightPhrase}.`
  )
}
