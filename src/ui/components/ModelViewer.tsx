import { DragEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Billboard, Grid, Line, OrbitControls, Text } from '@react-three/drei'
import { DoubleSide, Group, Mesh as ThreeMesh, Quaternion, Vector3 } from 'three'
import { Mesh, rotatedMinY } from '../../domain/mesh'
import { rotationToEulerDegrees } from '../../domain/genome'
import { meshToGeometry, updateContributionColors, updateStraightDownColors } from '../meshGeometry'
import { CopyableValue } from './CopyableValue'

/**
 * Debug shader for spotting inverted-winding triangles.
 *
 * `meshStandardMaterial` (used for normal rendering) auto-flips the shading
 * normal for back-facing fragments so double-sided geometry always looks lit
 * "correctly" from both sides — which is exactly why a triangle wound
 * backwards doesn't visibly stand out today. This material does the opposite:
 * it reads `gl_FrontFacing` (the GPU rasterizer's own front/back
 * determination, driven purely by each triangle's winding order as seen from
 * the camera) uncompensated, and paints back-facing fragments a flat warning
 * red. Front-facing fragments get simple flat-ish shading (not the real PBR
 * look) since this is a diagnostic view, not a final-appearance one.
 *
 * `side` is left DoubleSide (never culled) by the caller so both the "front"
 * and "back" of every triangle still get rasterized and colored — the point
 * is to distinguish them, not hide one.
 */
const BACKFACE_DEBUG_VERTEX_SHADER = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalMatrix * normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const BACKFACE_DEBUG_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    if (!gl_FrontFacing) {
      gl_FragColor = vec4(0.92, 0.14, 0.16, 1.0);
      return;
    }
    vec3 light = normalize(vec3(0.4, 0.85, 0.5));
    float diffuse = max(dot(normalize(vNormal), light), 0.0);
    vec3 base = vec3(0.32, 0.62, 0.42);
    gl_FragColor = vec4(base * (0.4 + 0.6 * diffuse), 1.0);
  }
`

interface RotatingMeshProps {
  readonly mesh: Mesh
  readonly targetRotation: Quaternion
  readonly tweenDurationMs: number
  /**
   * When set, overrides the normal straight-down-face highlight with the
   * score explainer's contribution color ramp (index-aligned with
   * mesh.triangles, normalized to [0, 1]). Undefined reverts to normal
   * shading — this is meant to be transient, only set while the score
   * explainer popover is open.
   */
  readonly explainContributions?: readonly number[]
  /**
   * When true, replaces the normal vertex-color / PBR shading with the
   * backface-debug shader above so genuinely-inverted-winding triangles
   * (and, more benignly, genuinely-interior surfaces from overlapping
   * box-union geometry) show up as flat red. Takes priority over
   * `explainContributions` since they're both diagnostic overlays and
   * showing both at once wouldn't be meaningful.
   */
  readonly debugBackfaces?: boolean
}

function RotatingMesh({ mesh, targetRotation, tweenDurationMs, explainContributions, debugBackfaces }: RotatingMeshProps) {
  const meshRef = useRef<ThreeMesh>(null)
  const geometry = useMemo(() => meshToGeometry(mesh), [mesh])

  const tween = useRef({ from: new Quaternion(), to: targetRotation.clone(), startedAt: 0 })

  useEffect(() => {
    const current = meshRef.current?.quaternion.clone() ?? new Quaternion()
    tween.current = { from: current, to: targetRotation.clone(), startedAt: performance.now() }
  }, [targetRotation])

  useFrame(() => {
    if (!meshRef.current) return
    const { from, to, startedAt } = tween.current
    const elapsed = performance.now() - startedAt
    const t = tweenDurationMs <= 0 ? 1 : Math.min(1, elapsed / tweenDurationMs)
    meshRef.current.quaternion.copy(from).slerp(to, t)
    // Keep the mesh's lowest point resting on the bed (y=0) at every point
    // in the tween, not just at the tween's endpoints.
    meshRef.current.position.y = -rotatedMinY(mesh, meshRef.current.quaternion)
    if (explainContributions) {
      updateContributionColors(geometry, mesh, explainContributions)
    } else {
      updateStraightDownColors(geometry, mesh, meshRef.current.quaternion)
    }
  })

  return (
    <mesh ref={meshRef} geometry={geometry}>
      {debugBackfaces ? (
        <shaderMaterial
          side={DoubleSide}
          vertexShader={BACKFACE_DEBUG_VERTEX_SHADER}
          fragmentShader={BACKFACE_DEBUG_FRAGMENT_SHADER}
        />
      ) : (
        <meshStandardMaterial vertexColors side={DoubleSide} />
      )}
    </mesh>
  )
}

const AXIS_COLORS = { x: '#e5484d', y: '#46a758', z: '#3987e5' } as const
const AXIS_LENGTH = 24
const LABEL_OFFSET = 3

interface AxisArrowProps {
  readonly direction: Vector3
  readonly color: string
  readonly label: string
}

/** A single labeled axis line with a small tip marker, from the origin out to `direction * AXIS_LENGTH`. */
function AxisArrow({ direction, color, label }: AxisArrowProps) {
  const tip = direction.clone().multiplyScalar(AXIS_LENGTH)
  const labelPosition = direction.clone().multiplyScalar(AXIS_LENGTH + LABEL_OFFSET)
  return (
    <group>
      <Line points={[[0, 0, 0], tip.toArray()]} color={color} lineWidth={3} />
      <Billboard position={labelPosition.toArray()}>
        <Text
          fontSize={3.4}
          color={color}
          outlineWidth={0.3}
          outlineColor="#12151a"
          anchorX="center"
          anchorY="middle"
        >
          {label}
        </Text>
      </Billboard>
    </group>
  )
}

interface RotatingAxisTriadProps {
  readonly targetRotation: Quaternion
  readonly tweenDurationMs: number
}

/** The XYZ axis triad attached to (and tweening with) the currently displayed rotation. */
function RotatingAxisTriad({ targetRotation, tweenDurationMs }: RotatingAxisTriadProps) {
  const groupRef = useRef<Group>(null)
  const tween = useRef({ from: new Quaternion(), to: targetRotation.clone(), startedAt: 0 })

  useEffect(() => {
    const current = groupRef.current?.quaternion.clone() ?? new Quaternion()
    tween.current = { from: current, to: targetRotation.clone(), startedAt: performance.now() }
  }, [targetRotation])

  useFrame(() => {
    if (!groupRef.current) return
    const { from, to, startedAt } = tween.current
    const elapsed = performance.now() - startedAt
    const t = tweenDurationMs <= 0 ? 1 : Math.min(1, elapsed / tweenDurationMs)
    groupRef.current.quaternion.copy(from).slerp(to, t)
  })

  return (
    <group ref={groupRef}>
      <AxisArrow direction={new Vector3(1, 0, 0)} color={AXIS_COLORS.x} label="X" />
      <AxisArrow direction={new Vector3(0, 1, 0)} color={AXIS_COLORS.y} label="Y" />
      <AxisArrow direction={new Vector3(0, 0, 1)} color={AXIS_COLORS.z} label="Z" />
    </group>
  )
}

interface ModelViewerProps {
  readonly mesh: Mesh
  readonly rotation: Quaternion
  readonly tweenDurationMs: number
  readonly explainContributions?: readonly number[]
  readonly debugBackfaces?: boolean
  readonly onImportFile?: (file: File) => void
}

export function ModelViewer({
  mesh,
  rotation,
  tweenDurationMs,
  explainContributions,
  debugBackfaces,
  onImportFile,
}: ModelViewerProps) {
  const euler = rotationToEulerDegrees(rotation)
  const [isDragActive, setIsDragActive] = useState(false)
  const dragCounter = useRef(0)

  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files')

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault()
    if (!hasFiles(e)) return
    dragCounter.current += 1
    setIsDragActive(true)
  }

  const handleDragOver = (e: DragEvent) => {
    if (hasFiles(e)) e.preventDefault()
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    dragCounter.current = Math.max(0, dragCounter.current - 1)
    if (dragCounter.current === 0) setIsDragActive(false)
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file) onImportFile?.(file)
  }

  return (
    <div
      className="relative min-h-0 flex-1 [&_canvas]:h-full!"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Canvas camera={{ position: [40, 40, 40], fov: 45 }} style={{ background: '#12151a' }}>
        <ambientLight intensity={0.35} />
        {/* Three lights from spread-out directions so every face normal gets
            meaningful contrast from at least one of them — a single light
            leaves every face pointing away from it flat-ambient-lit and
            indistinguishable from its neighbors at some rotations. */}
        <directionalLight position={[30, 50, 20]} intensity={0.75} />
        <directionalLight position={[-40, 20, -30]} intensity={0.45} />
        <directionalLight position={[10, -30, 35]} intensity={0.3} />
        <RotatingMesh
          mesh={mesh}
          targetRotation={rotation}
          tweenDurationMs={tweenDurationMs}
          explainContributions={explainContributions}
          debugBackfaces={debugBackfaces}
        />
        <RotatingAxisTriad targetRotation={rotation} tweenDurationMs={tweenDurationMs} />
        {/* Print bed reference, at y=0. RotatingMesh offsets the model each frame so its
            rotated lowest point always touches this plane, matching the fitness
            functions' bed-contact assumption. */}
        <Grid args={[100, 100]} position={[0, 0, 0]} cellColor="#334" sectionColor="#556" fadeDistance={120} />
        <OrbitControls />
      </Canvas>
      <div
        data-testid="axis-readout"
        className="absolute bottom-3 left-4 rounded-lg bg-[rgba(18,21,26,0.72)] px-3 py-1.5"
      >
        {/* This div is sized to just its own small badge, so making it (unlike before)
            receive pointer events only affects clicks landing on the badge itself —
            the rest of the canvas stays free for OrbitControls dragging. Clicking the
            badge copies the raw Euler values to the clipboard. */}
        <CopyableValue value={`${euler.x}, ${euler.y}, ${euler.z}`} className="flex gap-[14px]">
          <span className="font-mono text-xs font-semibold" style={{ color: AXIS_COLORS.x }}>
            X {euler.x.toFixed(1)}°
          </span>
          <span className="font-mono text-xs font-semibold" style={{ color: AXIS_COLORS.y }}>
            Y {euler.y.toFixed(1)}°
          </span>
          <span className="font-mono text-xs font-semibold" style={{ color: AXIS_COLORS.z }}>
            Z {euler.z.toFixed(1)}°
          </span>
        </CopyableValue>
      </div>
      {isDragActive && (
        <div
          data-testid="stl-drop-overlay"
          className="pointer-events-none absolute inset-0 flex items-center justify-center border-2 border-dashed border-accent bg-[rgba(18,21,26,0.82)]"
        >
          <span className="font-display text-sm font-semibold text-text-primary">Drop STL file to import</span>
        </div>
      )}
    </div>
  )
}
