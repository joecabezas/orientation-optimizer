import { Mesh } from '../../domain/mesh'
import { Genome } from '../../domain/genome'

/**
 * Per-triangle breakdown of a single score() call, for UI explainability
 * (the "score explainer" popover). Not used by the evolutionary algorithm's
 * hot loop — building `triangleContributions` allocates an array the size of
 * the mesh, so it's opt-in and only ever called for the one individual a user
 * is currently inspecting.
 */
export interface FitnessExplanation {
  /** Same value score() would return for this (mesh, genome). */
  readonly totalScore: number
  readonly strategyName: string
  /**
   * One non-negative contribution per triangle, in the same order as
   * `Mesh.triangles` (index-aligned — triangles have no id field). Units
   * match the strategy's internal weighting so that, where the strategy
   * computes a weighted-area average, summing these contributions
   * approximately reproduces `totalScore`.
   */
  readonly triangleContributions: readonly number[]
}

/**
 * Scores how much support material a mesh would need when printed at a given
 * rotation. Lower is better. Implementations must be pure functions of
 * (mesh, genome) so they can be swapped freely (strategy pattern).
 */
export interface FitnessStrategy {
  readonly name: string
  score(mesh: Mesh, genome: Genome): number
  /**
   * Optional: explains score() by breaking it down per triangle. Implementing
   * this is opt-in per strategy (see FitnessExplanation) — callers that need
   * an explanation should feature-detect with `strategy.explain?.(...)`.
   */
  explain?(mesh: Mesh, genome: Genome): FitnessExplanation
}
