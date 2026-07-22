export type FitnessStrategyName = 'projected-area' | 'overhang-angle' | 'support-aware'

export interface EAConfig {
  /** Number of genomes per generation. */
  readonly populationSize: number
  /** Seed the 6 axis-aligned face-normal directions (up/down/left/right/front/back). */
  readonly seedAxisDirections: boolean
  /** Seed the 8 corner-diagonal directions. */
  readonly seedDiagonalDirections: boolean
  /**
   * Seed the 12 edge-midpoint directions — each bisects the angle between two
   * adjacent face normals, tipping the mesh 45deg between two axis-aligned
   * placements. Useful for catching optima that lie between two face-flat
   * orientations rather than exactly on one.
   */
  readonly seedEdgeDirections: boolean
  /**
   * Seed one direction per one of the mesh's own largest triangles (by area),
   * resting that face flat on the bed — unlike the generic cube directions
   * above, these are tailored to the actual mesh's geometry, and the biggest
   * fitness gains typically come from landing a large flat face on the plate.
   */
  readonly seedTopFaces: boolean
  /** How many of the mesh's largest triangles to seed when seedTopFaces is enabled. */
  readonly seedTopFacesCount: number
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
   * Which fitness strategy to score orientations with. 'support-aware' is the
   * recommended default: it extends angle-based scoring with two effects angle
   * alone misses — support columns cost more the higher up they reach, and
   * support that lands on other mesh geometry (rather than the bed) is worse
   * than support that lands on the plate. 'overhang-angle' targets a specific
   * printer's critical overhang angle without those refinements, which can
   * occasionally change which orientation ranks best (see
   * criticalOverhangAngleDeg). 'projected-area' has no printer-specific
   * threshold, minimizing total downward-facing area regardless of a
   * printer's overhang tolerance.
   */
  readonly fitnessStrategy: FitnessStrategyName
  /**
   * Overhang angle (degrees from vertical) beyond which a face is considered to
   * need support. Used when fitnessStrategy is 'overhang-angle' or 'support-aware'.
   */
  readonly criticalOverhangAngleDeg: number
  /** Milliseconds to animate the 3D view tweening to each new generation's best rotation. */
  readonly tweenDurationMs: number
}

export type PresetName = 'fast' | 'medium' | 'best'

export const EA_PRESETS: Record<PresetName, EAConfig> = {
  fast: {
    populationSize: 16,
    seedAxisDirections: true,
    seedDiagonalDirections: false,
    seedEdgeDirections: false,
    seedTopFaces: true,
    seedTopFacesCount: 6,
    elitismFraction: 0.2,
    tournamentSize: 2,
    mutationProbability: 0.3,
    mutationStrength: 0.5,
    maxGenerations: 25,
    fitnessStrategy: 'support-aware',
    criticalOverhangAngleDeg: 45,
    tweenDurationMs: 200,
  },
  medium: {
    populationSize: 32,
    seedAxisDirections: true,
    seedDiagonalDirections: true,
    seedEdgeDirections: false,
    seedTopFaces: true,
    seedTopFacesCount: 10,
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
    seedAxisDirections: true,
    seedDiagonalDirections: true,
    seedEdgeDirections: true,
    seedTopFaces: true,
    seedTopFacesCount: 10,
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
