import { EAConfig, EA_PRESETS, FitnessStrategyName, PresetName } from '../../ea/EAConfig'
import { TestMeshOption } from '../../meshes/testMeshes'
import { primaryButtonClass, secondaryButtonClass } from '../buttonStyles'
import { selectClass } from '../formStyles'

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
    <label className="flex flex-col gap-1 text-xs text-text-secondary">
      <span>{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="range"
          className="flex-1 accent-accent"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="min-w-[34px] text-right font-mono text-xs tabular-nums text-text-primary">{value}</span>
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
    <div className="flex flex-col gap-[22px]">
      <div className="flex flex-col gap-2.5">
        <span className="text-[11px] font-semibold tracking-[0.08em] text-text-muted uppercase">Test model</span>
        <select className={selectClass} value={selectedMeshId} onChange={(e) => onMeshChange(e.target.value)}>
          {testMeshes.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="text-[11px] font-semibold tracking-[0.08em] text-text-muted uppercase">Preset</span>
        <div className="flex gap-1.5">
          {(Object.keys(EA_PRESETS) as PresetName[]).map((preset) => (
            <button
              key={preset}
              className={
                'flex-1 cursor-pointer rounded-md border px-0 py-[7px] font-display text-xs font-semibold capitalize transition-colors duration-150 ' +
                (activePreset === preset
                  ? 'border-accent bg-accent-dim text-white'
                  : 'border-border-hairline bg-surface-2 text-text-secondary hover:border-accent-dim hover:text-text-primary')
              }
              onClick={() => onPresetChange(preset)}
            >
              {preset}
            </button>
          ))}
        </div>
        {activePreset === 'custom' && (
          <span className="text-[11px] text-text-muted italic">Custom (edited from a preset)</span>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="text-[11px] font-semibold tracking-[0.08em] text-text-muted uppercase">
          Meta-parameters
        </span>
        <NumberField
          label="Population size"
          value={config.populationSize}
          min={8}
          max={128}
          step={4}
          onChange={(v) => patch({ populationSize: v })}
        />
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          <span>Seeding shell (initial directions)</span>
          <select
            className={selectClass}
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
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          <span>Fitness strategy</span>
          <select
            className={selectClass}
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

      <div className="flex flex-row gap-2">
        {!isRunning ? (
          <button className={`flex-1 ${primaryButtonClass}`} onClick={onStart}>
            Start
          </button>
        ) : (
          <button className={`flex-1 ${primaryButtonClass}`} onClick={onPause}>
            Pause
          </button>
        )}
        <button className={`flex-1 ${secondaryButtonClass}`} onClick={onReset}>
          Reset
        </button>
      </div>
    </div>
  )
}
