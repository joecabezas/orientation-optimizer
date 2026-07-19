import { ShellLevel } from './directionShells'

export type FitnessStrategyName = 'projected-area' | 'overhang-angle'

export interface EAConfig {
  /** Number of genomes per generation. */
  readonly populationSize: number
  /** Directional shell used to seed the initial population (6/14/26), rest filled randomly. */
  readonly seedingShellLevel: ShellLevel
  /** Fraction of the population carried over unchanged as elites each generation (0..1). */
  readonly elitismFraction: number
  /** How many individuals compete in each tournament selection draw. */
  readonly tournamentSize: number
  /** Probability (0..1) that a given child is mutated at all. */
  readonly mutationProbability: number
  /** Strength of mutation perturbation (0..1), scales the max axis-angle rotation. */
  readonly mutationStrength: number
  /** Max number of generations to run before stopping automatically. */
  readonly maxGenerations: number
  /**
   * Which fitness strategy to score orientations with. 'projected-area' has no
   * printer-specific threshold and is the recommended default: it minimizes
   * total downward-facing area, which cannot rank orientations differently
   * depending on a printer's overhang tolerance. 'overhang-angle' instead
   * targets a specific printer's critical overhang angle, which can occasionally
   * change which orientation ranks best (see criticalOverhangAngleDeg).
   */
  readonly fitnessStrategy: FitnessStrategyName
  /**
   * Overhang angle (degrees from vertical) beyond which a face is considered to
   * need support. Only used when fitnessStrategy is 'overhang-angle'.
   */
  readonly criticalOverhangAngleDeg: number
  /** Milliseconds to animate the 3D view tweening to each new generation's best rotation. */
  readonly tweenDurationMs: number
}

export type PresetName = 'fast' | 'medium' | 'best'

export const EA_PRESETS: Record<PresetName, EAConfig> = {
  fast: {
    populationSize: 16,
    seedingShellLevel: 6,
    elitismFraction: 0.2,
    tournamentSize: 2,
    mutationProbability: 0.3,
    mutationStrength: 0.5,
    maxGenerations: 25,
    fitnessStrategy: 'projected-area',
    criticalOverhangAngleDeg: 45,
    tweenDurationMs: 200,
  },
  medium: {
    populationSize: 32,
    seedingShellLevel: 14,
    elitismFraction: 0.15,
    tournamentSize: 3,
    mutationProbability: 0.35,
    mutationStrength: 0.4,
    maxGenerations: 60,
    fitnessStrategy: 'projected-area',
    criticalOverhangAngleDeg: 45,
    tweenDurationMs: 400,
  },
  best: {
    populationSize: 64,
    seedingShellLevel: 26,
    elitismFraction: 0.1,
    tournamentSize: 4,
    mutationProbability: 0.4,
    mutationStrength: 0.3,
    maxGenerations: 150,
    fitnessStrategy: 'projected-area',
    criticalOverhangAngleDeg: 45,
    tweenDurationMs: 500,
  },
}
