import { ChangeEvent, ReactNode, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
  readonly onImportFile: (file: File) => void
  readonly importError: string | null
  readonly isRunning: boolean
  readonly hasStarted: boolean
  readonly isFinished: boolean
  readonly targetGeneration: number
  readonly onAdvance: (amount: number) => void
  readonly onPauseToggle: () => void
  readonly onReset: () => void
}

const HINT_WIDTH = 220
const HINT_MARGIN = 8

/**
 * Small "?" badge that reveals an explanation in a floating popover on
 * hover/focus. Rendered via a portal with `position: fixed` (not absolute
 * inside the scrollable, 300px-wide sidebar) so it can never be clipped by
 * an ancestor's overflow/width and always paints above sibling content.
 */
function InfoHint({ text }: { text: string }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const badgeRef = useRef<HTMLSpanElement>(null)

  const show = () => {
    const rect = badgeRef.current?.getBoundingClientRect()
    if (!rect) return
    const left = Math.min(Math.max(rect.right - HINT_WIDTH, HINT_MARGIN), window.innerWidth - HINT_WIDTH - HINT_MARGIN)
    setPos({ top: rect.top - HINT_MARGIN, left })
  }
  const hide = () => setPos(null)

  return (
    <>
      <span
        ref={badgeRef}
        tabIndex={0}
        aria-label={text}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-flex h-3.5 w-3.5 shrink-0 cursor-help items-center justify-center rounded-full border border-border-hairline text-[9px] leading-none text-text-muted hover:border-accent-dim hover:text-text-secondary focus-visible:border-accent-dim focus-visible:text-text-secondary focus-visible:outline-none"
      >
        ?
      </span>
      {pos &&
        createPortal(
          <span
            role="tooltip"
            style={{ top: pos.top, left: pos.left, width: HINT_WIDTH }}
            className="pointer-events-none fixed z-50 -translate-y-full rounded-md border border-border-hairline bg-surface-3 p-2 text-[11px] leading-snug font-normal text-text-secondary shadow-lg"
          >
            {text}
          </span>,
          document.body,
        )}
    </>
  )
}

/** Collapsible section with a header, used to break the panel into scannable groups. */
function Section({
  title,
  hint,
  defaultOpen = true,
  children,
}: {
  title: string
  hint?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="flex flex-col gap-2.5 border-b border-border-hairline pb-[18px] last:border-b-0 last:pb-0">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="flex flex-1 cursor-pointer items-center gap-1.5 text-left"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <span
            className={
              'text-[9px] text-text-muted transition-transform duration-150 ' + (open ? 'rotate-90' : 'rotate-0')
            }
          >
            ▶
          </span>
          <span className="text-[11px] font-semibold tracking-[0.08em] text-text-muted uppercase">{title}</span>
        </button>
        {hint && <InfoHint text={hint} />}
      </div>
      {open && <div className="flex flex-col gap-3 pl-[14px]">{children}</div>}
    </div>
  )
}

/** Visually nests conditional sub-fields under the control that reveals them. */
function NestedFields({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2.5 border-l border-border-hairline pl-3">{children}</div>
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
    <div className="flex items-center gap-2 text-xs text-text-secondary">
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          className="accent-accent"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>{label}</span>
      </label>
      {hint && <InfoHint text={hint} />}
    </div>
  )
}

function RadioGroup<T extends string>({
  name,
  options,
  value,
  onChange,
}: {
  name: string
  options: readonly { value: T; label: string; hint?: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {options.map((opt) => (
        <div key={opt.value} className="flex items-center gap-2 text-xs text-text-secondary">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name={name}
              className="accent-accent"
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
            />
            <span>{opt.label}</span>
          </label>
          {opt.hint && <InfoHint text={opt.hint} />}
        </div>
      ))}
    </div>
  )
}

function NumberField({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  hint?: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex flex-col gap-1 text-xs text-text-secondary">
      <span className="flex items-center gap-1.5">
        <label>{label}</label>
        {hint && <InfoHint text={hint} />}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="range"
          aria-label={label}
          className="flex-1 accent-accent"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="min-w-[34px] text-right font-mono text-xs tabular-nums text-text-primary">{value}</span>
      </div>
    </div>
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
  onImportFile,
  importError,
  isRunning,
  hasStarted,
  isFinished,
  targetGeneration,
  onAdvance,
  onPauseToggle,
  onReset,
}: ConfigPanelProps) {
  const patch = (partial: Partial<EAConfig>) => onConfigChange({ ...config, ...partial })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) onImportFile(file)
  }

  const showCriticalAngle = config.fitnessStrategy === 'overhang-angle' || config.fitnessStrategy === 'support-aware'

  return (
    <div className="flex flex-col gap-[18px]">
      <Section title="Model" defaultOpen>
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
        <input
          ref={fileInputRef}
          data-testid="stl-file-input"
          type="file"
          accept=".stl"
          className="hidden"
          onChange={handleFileInputChange}
        />
        <button className={secondaryButtonClass} onClick={() => fileInputRef.current?.click()}>
          Import model…
        </button>
        {importError && <span className="text-[11px] text-red-400">{importError}</span>}
      </Section>

      <Section title="Preset" hint="A starting point for every setting below. Editing any value switches to Custom.">
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
          <span className="text-[11px] text-text-muted italic">Custom — edited from a preset</span>
        )}
      </Section>

      <Section
        title="Fitness strategy"
        hint="How each candidate rotation is scored. Lower score = less support material needed."
      >
        <RadioGroup<FitnessStrategyName>
          name="fitness-strategy"
          value={config.fitnessStrategy}
          onChange={(v) => patch({ fitnessStrategy: v })}
          options={[
            {
              value: 'support-aware',
              label: 'Support-aware',
              hint: 'Recommended default. Extends overhang-angle scoring with two refinements: support columns cost more the higher up they reach, and support that lands on other mesh geometry (rather than the bed) is penalized more than support that lands on the plate.',
            },
            {
              value: 'projected-area',
              label: 'Projected area',
              hint: 'Minimizes total downward-facing area with no printer-specific overhang threshold. Printer-agnostic, but ignores how support actually behaves.',
            },
            {
              value: 'overhang-angle',
              label: 'Overhang angle',
              hint: "Scores by how far each face's angle exceeds the critical overhang angle below, weighted by triangle area. Simple and printer-specific, but can rank orientations differently than support-aware since it ignores support height and mesh-on-mesh contact.",
            },
          ]}
        />
        {showCriticalAngle && (
          <NestedFields>
            <NumberField
              label="Critical overhang angle (deg)"
              hint="Angle from vertical beyond which a face is considered to need support. Lower = stricter (flags more faces as overhangs); should match your printer/material's actual unsupported-overhang capability."
              value={config.criticalOverhangAngleDeg}
              min={20}
              max={70}
              step={1}
              onChange={(v) => patch({ criticalOverhangAngleDeg: v })}
            />
          </NestedFields>
        )}
      </Section>

      <Section
        title="Seeding"
        hint="How the initial population (generation 0) is chosen, before any evolution happens."
      >
        <NumberField
          label="Population size"
          hint="Number of candidate rotations (genomes) evaluated and bred each generation. Larger populations explore more orientations per generation but take longer to run."
          value={config.populationSize}
          min={8}
          max={128}
          step={4}
          onChange={(v) => patch({ populationSize: v })}
        />
        <Checkbox
          label="6 axis directions"
          hint="Seeds the up / down / left / right / front / back face-normal directions — the six ways to rest the mesh flat on an axis-aligned face."
          checked={config.seedAxisDirections}
          onChange={(v) => patch({ seedAxisDirections: v })}
        />
        <Checkbox
          label="8 corner diagonals"
          hint="Seeds the eight corner-diagonal directions of a cube, balancing the mesh on a corner. Catches optima that favor a diagonal tilt over a flat face."
          checked={config.seedDiagonalDirections}
          onChange={(v) => patch({ seedDiagonalDirections: v })}
        />
        <Checkbox
          label="12 edge directions"
          hint="Seeds the twelve edge-bisector directions, each tipping the mesh 45° between two axis-aligned placements — catches optima that lie between two flat faces rather than on one."
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
          <NestedFields>
            <NumberField
              label="Top faces count"
              hint="How many of the mesh's largest triangles (by area) to seed as candidate flat-down orientations."
              value={config.seedTopFacesCount}
              min={1}
              max={30}
              step={1}
              onChange={(v) => patch({ seedTopFacesCount: v })}
            />
          </NestedFields>
        )}
      </Section>

      <Section
        title="Selection & mutation"
        hint="How each generation breeds the next: which genomes survive, and how children are perturbed."
        defaultOpen={false}
      >
        <NumberField
          label="Elitism fraction"
          hint="Fraction of the population copied unchanged into the next generation, ranked best-first. Guarantees the best genomes are never lost to selection/mutation, at the cost of population diversity if set too high."
          value={config.elitismFraction}
          min={0}
          max={0.5}
          step={0.05}
          onChange={(v) => patch({ elitismFraction: v })}
        />
        <NumberField
          label="Tournament size"
          hint="Number of genomes randomly drawn to compete for each parent slot; the best of the draw wins. Larger tournaments favor already-strong genomes more aggressively (faster convergence, less diversity)."
          value={config.tournamentSize}
          min={2}
          max={8}
          step={1}
          onChange={(v) => patch({ tournamentSize: v })}
        />
        <NumberField
          label="Mutation probability"
          hint="Chance that a given child's rotation is mutated at all after crossover. Higher values inject more randomness each generation, helping escape local optima but slowing convergence."
          value={config.mutationProbability}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => patch({ mutationProbability: v })}
        />
        <NumberField
          label="Mutation strength"
          hint="How large a mutation's rotation perturbation can be, when it happens. Higher values make bigger, coarser jumps in orientation; lower values fine-tune near the current rotation."
          value={config.mutationStrength}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => patch({ mutationStrength: v })}
        />
      </Section>

      <Section title="Run" hint="Playback speed for the live view." defaultOpen={false}>
        <NumberField
          label="Tween duration (ms)"
          hint="How long the 3D view animates between each generation's best rotation. Purely a display setting — it does not affect the search, only how fast it's fun to watch."
          value={config.tweenDurationMs}
          min={0}
          max={1500}
          step={50}
          onChange={(v) => patch({ tweenDurationMs: v })}
        />
      </Section>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold tracking-[0.08em] text-text-muted uppercase">
            Run to generation {targetGeneration}
          </span>
          <InfoHint text="Each button raises the target generation and resumes running toward it — there's no separate Start button. The run auto-pauses once it reaches the target." />
        </div>
        <div className="flex flex-row gap-2">
          <button className={`flex-1 ${secondaryButtonClass}`} onClick={() => onAdvance(1)}>
            +1
          </button>
          <button className={`flex-1 ${secondaryButtonClass}`} onClick={() => onAdvance(10)}>
            +10
          </button>
          <button className={`flex-1 ${secondaryButtonClass}`} onClick={() => onAdvance(50)}>
            +50
          </button>
        </div>
        <div className="flex flex-row gap-2">
          <button
            className={`flex-1 ${primaryButtonClass}`}
            onClick={onPauseToggle}
            disabled={!hasStarted || isFinished}
          >
            {isRunning ? 'Pause' : 'Resume'}
          </button>
          <button className={`flex-1 ${secondaryButtonClass}`} onClick={onReset}>
            Reset
          </button>
        </div>
        {isFinished && (
          <span className="text-[11px] text-text-muted italic">
            Run complete at generation {targetGeneration}. Use +N to keep going, or Reset to start over.
          </span>
        )}
      </div>
    </div>
  )
}
