import { Mesh } from '../domain/mesh'
import { EAConfig } from './EAConfig'
import { EvolutionEngine } from './EvolutionEngine'
import { FitnessStrategy } from './strategies/FitnessStrategy'
import { OverhangFitnessStrategy } from './strategies/OverhangFitnessStrategy'
import { ProjectedAreaFitnessStrategy } from './strategies/ProjectedAreaFitnessStrategy'
import { DirectionalShellSeeding } from './strategies/DirectionalShellSeeding'
import { TournamentSelection } from './strategies/TournamentSelection'
import { SlerpCrossover } from './strategies/SlerpCrossover'
import { AxisAngleMutation } from './strategies/AxisAngleMutation'

function createFitnessStrategy(config: EAConfig): FitnessStrategy {
  switch (config.fitnessStrategy) {
    case 'overhang-angle':
      return new OverhangFitnessStrategy({
        criticalOverhangAngleDeg: config.criticalOverhangAngleDeg,
        transitionWidthDeg: 20,
      })
    case 'projected-area':
      return new ProjectedAreaFitnessStrategy()
  }
}

/** Builds a ready-to-run EvolutionEngine wiring the default strategy implementations for a given config. */
export function createEngine(mesh: Mesh, config: EAConfig): EvolutionEngine {
  return new EvolutionEngine(mesh, config, {
    fitness: createFitnessStrategy(config),
    seeding: new DirectionalShellSeeding(config.seedingShellLevel),
    selection: new TournamentSelection(config.tournamentSize),
    crossover: new SlerpCrossover(),
    mutation: new AxisAngleMutation(30),
  })
}
