import { useEffect, useMemo, useRef, useState } from 'react'
import { ModelViewer } from './ui/components/ModelViewer'
import { GenomeTable } from './ui/components/GenomeTable'
import { FitnessChart, FitnessHistoryPoint } from './ui/components/FitnessChart'
import { ConfigPanel } from './ui/components/ConfigPanel'
import { EAConfig, EA_PRESETS, PresetName } from './ea/EAConfig'
import { createEngine } from './ea/createEngine'
import { EvolutionEngine, GenerationResult } from './ea/EvolutionEngine'
import { TEST_MESHES } from './meshes/testMeshes'

export default function App() {
  const [selectedMeshId, setSelectedMeshId] = useState(TEST_MESHES[1].id)
  const [preset, setPreset] = useState<PresetName>('fast')
  const [config, setConfig] = useState<EAConfig>(EA_PRESETS.fast)
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [history, setHistory] = useState<FitnessHistoryPoint[]>([])

  const mesh = useMemo(() => {
    const option = TEST_MESHES.find((m) => m.id === selectedMeshId) ?? TEST_MESHES[0]
    return option.build()
  }, [selectedMeshId])

  const engineRef = useRef<EvolutionEngine | null>(null)
  const timerRef = useRef<number | null>(null)

  const resetEngine = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setIsRunning(false)
    const engine = createEngine(mesh, config)
    engineRef.current = engine
    const first = engine.start()
    setResult(first)
    setHistory([{ generation: first.generation, bestScore: first.best.score, averageScore: first.averageScore }])
  }

  // Rebuild the engine whenever the mesh or structural config changes.
  useEffect(() => {
    resetEngine()
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
    if (!engineRef.current) resetEngine()
    setIsRunning(true)
  }

  const handlePause = () => setIsRunning(false)

  const handleReset = () => resetEngine()

  const handleMeshChange = (id: string) => setSelectedMeshId(id)

  return (
    <div className="app-root">
      <header className="app-header">
        <h1>Orientation Optimizer</h1>
        <p className="app-subtitle">
          Evolutionary search for the 3D-print orientation that minimizes support material.
        </p>
      </header>

      <div className="app-body">
        <aside className="app-sidebar">
          <ConfigPanel
            config={config}
            activePreset={preset}
            onPresetChange={handlePresetChange}
            onConfigChange={handleConfigChange}
            testMeshes={TEST_MESHES}
            selectedMeshId={selectedMeshId}
            onMeshChange={handleMeshChange}
            isRunning={isRunning}
            onStart={handleStart}
            onPause={handlePause}
            onReset={handleReset}
          />
        </aside>

        <main className="app-main">
          <div className="viewer-panel">
            <div className="viewer-status">
              <span>
                Generation <strong>{result?.generation ?? 0}</strong> / {config.maxGenerations}
              </span>
              <span>
                Best score <strong>{result?.best.score.toFixed(4) ?? '-'}</strong>
              </span>
              {engineRef.current?.isDone && <span className="badge-done">Done</span>}
            </div>
            {result && (
              <ModelViewer mesh={mesh} rotation={result.best.genome.rotation} tweenDurationMs={config.tweenDurationMs} />
            )}
          </div>

          <FitnessChart history={history} />

          {result && <GenomeTable population={result.population} selectedGenomeId={result.best.genome.id} />}
        </main>
      </div>
    </div>
  )
}
