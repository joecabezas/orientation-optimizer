import { EAConfig, EA_PRESETS, FitnessStrategyName, PresetName } from '../../ea/EAConfig'
import { TestMeshOption } from '../../meshes/testMeshes'

interface ConfigPanelProps {
  readonly config: EAConfig
  readonly activePreset: PresetName | 'custom'
  readonly onPresetChange: (preset: PresetName) => void
  readonly onConfigChange: (config: EAConfig) => void
  readonly testMeshes: readonly TestMeshOption[]
  readonly selectedMeshId: string
  readonly onMeshChange: (id: string) => void
  readonly isRunning: boolean
  readonly onStart: () => void
  readonly onPause: () => void
  readonly onReset: () => void
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <label className="config-field">
      <span>{label}</span>
      <div className="config-field-row">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="mono config-field-value">{value}</span>
      </div>
    </label>
  )
}

export function ConfigPanel({
  config,
  activePreset,
  onPresetChange,
  onConfigChange,
  testMeshes,
  selectedMeshId,
  onMeshChange,
  isRunning,
  onStart,
  onPause,
  onReset,
}: ConfigPanelProps) {
  const patch = (partial: Partial<EAConfig>) => onConfigChange({ ...config, ...partial })

  return (
    <div className="config-panel">
      <div className="config-section">
        <span className="config-section-title">Test model</span>
        <select value={selectedMeshId} onChange={(e) => onMeshChange(e.target.value)}>
          {testMeshes.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div className="config-section">
        <span className="config-section-title">Preset</span>
        <div className="preset-buttons">
          {(Object.keys(EA_PRESETS) as PresetName[]).map((preset) => (
            <button
              key={preset}
              className={activePreset === preset ? 'preset-btn active' : 'preset-btn'}
              onClick={() => onPresetChange(preset)}
            >
              {preset}
            </button>
          ))}
        </div>
        {activePreset === 'custom' && <span className="config-hint">Custom (edited from a preset)</span>}
      </div>

      <div className="config-section">
        <span className="config-section-title">Meta-parameters</span>
        <NumberField
          label="Population size"
          value={config.populationSize}
          min={8}
          max={128}
          step={4}
          onChange={(v) => patch({ populationSize: v })}
        />
        <label className="config-field">
          <span>Seeding shell (initial directions)</span>
          <select
            value={config.seedingShellLevel}
            onChange={(e) => patch({ seedingShellLevel: Number(e.target.value) as 6 | 14 | 26 })}
          >
            <option value={6}>6 (up/down/left/right/front/back)</option>
            <option value={14}>14 (+ 8 diagonals)</option>
            <option value={26}>26 (+ 12 edges)</option>
          </select>
        </label>
        <NumberField
          label="Elitism fraction"
          value={config.elitismFraction}
          min={0}
          max={0.5}
          step={0.05}
          onChange={(v) => patch({ elitismFraction: v })}
        />
        <NumberField
          label="Tournament size"
          value={config.tournamentSize}
          min={2}
          max={8}
          step={1}
          onChange={(v) => patch({ tournamentSize: v })}
        />
        <NumberField
          label="Mutation probability"
          value={config.mutationProbability}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => patch({ mutationProbability: v })}
        />
        <NumberField
          label="Mutation strength"
          value={config.mutationStrength}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => patch({ mutationStrength: v })}
        />
        <NumberField
          label="Max generations"
          value={config.maxGenerations}
          min={5}
          max={300}
          step={5}
          onChange={(v) => patch({ maxGenerations: v })}
        />
        <label className="config-field">
          <span>Fitness strategy</span>
          <select
            value={config.fitnessStrategy}
            onChange={(e) => patch({ fitnessStrategy: e.target.value as FitnessStrategyName })}
          >
            <option value="projected-area">Projected area (printer-agnostic)</option>
            <option value="overhang-angle">Overhang angle (printer-specific)</option>
          </select>
        </label>
        {config.fitnessStrategy === 'overhang-angle' && (
          <NumberField
            label="Critical overhang angle (deg)"
            value={config.criticalOverhangAngleDeg}
            min={20}
            max={70}
            step={1}
            onChange={(v) => patch({ criticalOverhangAngleDeg: v })}
          />
        )}
        <NumberField
          label="Tween duration (ms)"
          value={config.tweenDurationMs}
          min={0}
          max={1500}
          step={50}
          onChange={(v) => patch({ tweenDurationMs: v })}
        />
      </div>

      <div className="config-section run-controls">
        {!isRunning ? (
          <button className="primary-btn" onClick={onStart}>
            Start
          </button>
        ) : (
          <button className="primary-btn" onClick={onPause}>
            Pause
          </button>
        )}
        <button className="secondary-btn" onClick={onReset}>
          Reset
        </button>
      </div>
    </div>
  )
}
