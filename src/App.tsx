import { useEffect, useMemo, useRef, useState } from 'react'
import { Quaternion } from 'three'
import { ModelViewer } from './ui/components/ModelViewer'
import { GenomeTable } from './ui/components/GenomeTable'
import { FitnessChart, FitnessHistoryPoint } from './ui/components/FitnessChart'
import { ConfigPanel } from './ui/components/ConfigPanel'
import { EAConfig, EA_PRESETS, PresetName } from './ea/EAConfig'
import { createEngine } from './ea/createEngine'
import { EvolutionEngine, GenerationResult } from './ea/EvolutionEngine'
import { TEST_MESHES, TestMeshOption } from './meshes/testMeshes'
import { importMeshFile } from './meshes/import/meshImporters'
import { Mesh } from './domain/mesh'
import { secondaryButtonClass } from './ui/buttonStyles'
import { ScoreExplainerPopover } from './ui/components/ScoreExplainerPopover'
import { buildScoreExplanation, ScoreExplanationSummary } from './ui/scoreExplanation'

const IMPORTED_MESH_ID = 'imported'

/** Shown as-imported/as-authored, before the EA has seeded any candidate rotation. */
const IDENTITY_ROTATION = new Quaternion()

export default function App() {
  const [selectedMeshId, setSelectedMeshId] = useState(TEST_MESHES[1].id)
  const [preset, setPreset] = useState<PresetName>('fast')
  const [config, setConfig] = useState<EAConfig>(EA_PRESETS.fast)
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [history, setHistory] = useState<FitnessHistoryPoint[]>([])
  const [selectedGenomeSeq, setSelectedGenomeSeq] = useState<number | undefined>(undefined)
  const [scoreExplanation, setScoreExplanation] = useState<ScoreExplanationSummary | null>(null)
  const [debugBackfaces, setDebugBackfaces] = useState(false)
  const [importedMesh, setImportedMesh] = useState<Mesh | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const meshOptions: readonly TestMeshOption[] = useMemo(() => {
    if (!importedMesh) return TEST_MESHES
    return [{ id: IMPORTED_MESH_ID, label: importedMesh.name, build: () => importedMesh }, ...TEST_MESHES]
  }, [importedMesh])

  const mesh = useMemo(() => {
    const option = meshOptions.find((m) => m.id === selectedMeshId) ?? meshOptions[0]
    return option.build()
  }, [meshOptions, selectedMeshId])

  const engineRef = useRef<EvolutionEngine | null>(null)
  const timerRef = useRef<number | null>(null)
  const engineConfigRef = useRef<EAConfig | null>(null)
  // Whether engineRef's generation 0 has been seeded/evaluated yet. A ref (not
  // state) so handleStart can check it synchronously right after prepareEngine.
  const startedRef = useRef(false)

  /** Builds a fresh (unseeded) engine for the current mesh/config, without running it. */
  const prepareEngine = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setIsRunning(false)
    engineRef.current = createEngine(mesh, config)
    engineConfigRef.current = config
    startedRef.current = false
    setResult(null)
    setHistory([])
    setSelectedGenomeSeq(undefined)
  }

  // Rebuild the engine whenever the mesh changes, but don't seed/evaluate it yet —
  // the viewer should show the mesh in its original (as-imported) orientation
  // until the user presses Start.
  useEffect(() => {
    prepareEngine()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesh])

  useEffect(() => {
    if (!isRunning) return
    const engine = engineRef.current
    if (!engine) return
    if (engine.isDone) {
      setIsRunning(false)
      return
    }

    timerRef.current = window.setTimeout(() => {
      const next = engine.step()
      setResult(next)
      setHistory((prev) => [
        ...prev,
        { generation: next.generation, bestScore: next.best.score, averageScore: next.averageScore },
      ])
    }, config.tweenDurationMs)

    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [isRunning, result, config.tweenDurationMs])

  const handlePresetChange = (name: PresetName) => {
    setPreset(name)
    setConfig(EA_PRESETS[name])
  }

  const handleConfigChange = (next: EAConfig) => {
    setConfig(next)
  }

  const handleStart = () => {
    const configChanged = !engineRef.current || engineConfigRef.current !== config
    if (configChanged) prepareEngine()
    if (!startedRef.current) {
      const engine = engineRef.current!
      const first = engine.start()
      startedRef.current = true
      setResult(first)
      setHistory([{ generation: first.generation, bestScore: first.best.score, averageScore: first.averageScore }])
    }
    setIsRunning(true)
  }

  const handlePause = () => setIsRunning(false)

  const handleReset = () => prepareEngine()

  const handleMeshChange = (id: string) => {
    if (id !== IMPORTED_MESH_ID) setImportedMesh(null)
    setSelectedMeshId(id)
  }

  const handleImportFile = async (file: File) => {
    try {
      const parsed = await importMeshFile(file)
      setImportError(null)
      setImportedMesh(parsed)
      setSelectedMeshId(IMPORTED_MESH_ID)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleSelectGenome = (genomeSeq: number) => {
    setSelectedGenomeSeq((prev) => (prev === genomeSeq ? undefined : genomeSeq))
  }

  const displayedIndividual =
    (selectedGenomeSeq !== undefined && result?.population.find((ind) => ind.genome.seq === selectedGenomeSeq)) ||
    result?.best

  // Close the score explainer whenever the individual it's explaining stops
  // being displayed (a new selection, or — while running with nothing
  // selected — a new generation's best) rather than let it silently go stale.
  useEffect(() => {
    setScoreExplanation(null)
  }, [displayedIndividual?.genome.seq])

  const handleToggleScoreExplainer = () => {
    if (scoreExplanation) {
      setScoreExplanation(null)
      return
    }
    const strategy = engineRef.current?.fitnessStrategy
    if (!displayedIndividual || !strategy) return
    setScoreExplanation(buildScoreExplanation(mesh, displayedIndividual.genome, strategy) ?? null)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-baseline gap-2.5 border-b border-border-hairline bg-gradient-to-b from-surface-1 to-surface-0 px-5 py-2.5">
        <h1 className="m-0 shrink-0 text-[14px] font-bold tracking-[-0.005em]">Orientation Optimizer</h1>
        <span className="shrink-0 text-[12px] text-text-muted">·</span>
        <p className="m-0 min-w-0 truncate text-[12px] text-text-secondary">
          Evolutionary search for the 3D-print orientation that minimizes support material.
        </p>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-[300px] shrink-0 overflow-y-auto border-r border-border-hairline bg-surface-1 p-[18px]">
          <ConfigPanel
            config={config}
            activePreset={preset}
            onPresetChange={handlePresetChange}
            onConfigChange={handleConfigChange}
            testMeshes={meshOptions}
            selectedMeshId={selectedMeshId}
            onMeshChange={handleMeshChange}
            onImportFile={handleImportFile}
            importError={importError}
            isRunning={isRunning}
            onStart={handleStart}
            onPause={handlePause}
            onReset={handleReset}
          />
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 px-6 pt-[18px] pb-10">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[10px] border border-border-hairline bg-surface-1">
            <div
              data-testid="viewer-status"
              className="flex shrink-0 items-center gap-5 border-b border-border-hairline px-4 py-2.5 text-[13px] text-text-secondary"
            >
              <span>
                Generation{' '}
                <strong className="font-mono font-semibold text-text-primary">{result?.generation ?? 0}</strong> /{' '}
                {config.maxGenerations}
              </span>
              <span className="relative">
                {selectedGenomeSeq !== undefined ? 'Selected score' : 'Best score'}{' '}
                <button
                  type="button"
                  data-testid="score-explainer-trigger"
                  className="cursor-pointer rounded font-mono font-semibold text-text-primary underline decoration-text-muted decoration-dotted underline-offset-4 hover:text-accent disabled:cursor-default disabled:text-text-primary disabled:no-underline"
                  onClick={handleToggleScoreExplainer}
                  disabled={!displayedIndividual}
                  aria-expanded={scoreExplanation !== null}
                >
                  {displayedIndividual?.score.toFixed(4) ?? '-'}
                </button>
                {scoreExplanation && (
                  <ScoreExplainerPopover summary={scoreExplanation} onClose={() => setScoreExplanation(null)} />
                )}
              </span>
              <label
                className="flex cursor-pointer items-center gap-1.5 text-[12px] text-text-secondary"
                title="Colors genuine GPU back-facing fragments red (based on triangle winding, not compensated), to help spot triangles wound backwards."
              >
                <input
                  type="checkbox"
                  className="accent-accent"
                  checked={debugBackfaces}
                  onChange={(e) => setDebugBackfaces(e.target.checked)}
                />
                Show inverted normals
              </label>
              {engineRef.current?.isDone && (
                <span className="ml-auto rounded-full bg-[rgba(28,175,122,0.15)] px-2.5 py-[3px] text-[11px] font-semibold tracking-[0.04em] text-[#1baf7a] uppercase">
                  Done
                </span>
              )}
              {selectedGenomeSeq !== undefined && (
                <button className={secondaryButtonClass} onClick={() => setSelectedGenomeSeq(undefined)}>
                  Follow best
                </button>
              )}
            </div>
            <ModelViewer
              mesh={mesh}
              rotation={displayedIndividual?.genome.rotation ?? IDENTITY_ROTATION}
              tweenDurationMs={config.tweenDurationMs}
              explainContributions={scoreExplanation?.normalizedContributions}
              debugBackfaces={debugBackfaces}
              onImportFile={handleImportFile}
            />
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 gap-5">
            <div className="min-h-0 min-w-0 flex-1">
              <FitnessChart history={history} />
            </div>
            {result && (
              <div className="min-h-0 min-w-0 flex-1">
                <GenomeTable
                  population={result.population}
                  selectedGenomeSeq={selectedGenomeSeq ?? result.best.genome.seq}
                  onSelectGenome={handleSelectGenome}
                />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
