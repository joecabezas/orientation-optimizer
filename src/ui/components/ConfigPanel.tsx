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

function Checkbox({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-xs text-text-secondary">
      <input
        type="checkbox"
        className="mt-0.5 accent-accent"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="flex flex-col">
        <span>{label}</span>
        {hint && <span className="text-[11px] text-text-muted">{hint}</span>}
      </span>
    </label>
  )
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
        <select
          data-testid="mesh-select"
          className={selectClass}
          value={selectedMeshId}
          onChange={(e) => onMeshChange(e.target.value)}
        >
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
        <div className="flex flex-col gap-1.5">
          <span>Seeding directions (initial population)</span>
          <Checkbox
            label="6 axis directions"
            hint="Up / down / left / right / front / back"
            checked={config.seedAxisDirections}
            onChange={(v) => patch({ seedAxisDirections: v })}
          />
          <Checkbox
            label="8 corner diagonals"
            checked={config.seedDiagonalDirections}
            onChange={(v) => patch({ seedDiagonalDirections: v })}
          />
          <Checkbox
            label="12 edge directions"
            hint="Bisects two adjacent faces, tipping the mesh 45° between two axis-aligned placements — catches optima that lie between two flat faces rather than on one."
            checked={config.seedEdgeDirections}
            onChange={(v) => patch({ seedEdgeDirections: v })}
          />
          <Checkbox
            label="Top faces of this mesh"
            hint="Rests each of the mesh's own largest faces flat on the bed — tailored to this model's actual geometry, since the biggest gains usually come from landing a big flat face down."
            checked={config.seedTopFaces}
            onChange={(v) => patch({ seedTopFaces: v })}
          />
          {config.seedTopFaces && (
            <NumberField
              label="Top faces count"
              value={config.seedTopFacesCount}
              min={1}
              max={30}
              step={1}
              onChange={(v) => patch({ seedTopFacesCount: v })}
            />
          )}
        </div>
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
            <option value="support-aware">Support-aware (height + contact penalty)</option>
          </select>
        </label>
        {(config.fitnessStrategy === 'overhang-angle' || config.fitnessStrategy === 'support-aware') && (
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
