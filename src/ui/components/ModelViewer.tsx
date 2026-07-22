import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Grid, Line, OrbitControls, Text } from '@react-three/drei'
import { Group, Mesh as ThreeMesh, Quaternion, Vector3 } from 'three'
import { Mesh, rotatedMinY } from '../../domain/mesh'
import { genomeToEulerDegrees } from '../../domain/genome'
import { meshToGeometry, updateStraightDownColors } from '../meshGeometry'
import { CopyableValue } from './CopyableValue'

interface RotatingMeshProps {
  readonly mesh: Mesh
  readonly targetRotation: Quaternion
  readonly tweenDurationMs: number
}

function RotatingMesh({ mesh, targetRotation, tweenDurationMs }: RotatingMeshProps) {
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
    updateStraightDownColors(geometry, mesh, meshRef.current.quaternion)
  })

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial vertexColors side={2} />
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
      <Text
        position={labelPosition.toArray()}
        fontSize={3.4}
        color={color}
        outlineWidth={0.3}
        outlineColor="#12151a"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
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
}

export function ModelViewer({ mesh, rotation, tweenDurationMs }: ModelViewerProps) {
  const euler = genomeToEulerDegrees({ id: '', rotation })

  return (
    <div className="relative min-h-0 flex-1 [&_canvas]:h-full!">
      <Canvas camera={{ position: [40, 40, 40], fov: 45 }} style={{ background: '#12151a' }}>
        <ambientLight intensity={0.35} />
        {/* Three lights from spread-out directions so every face normal gets
            meaningful contrast from at least one of them — a single light
            leaves every face pointing away from it flat-ambient-lit and
            indistinguishable from its neighbors at some rotations. */}
        <directionalLight position={[30, 50, 20]} intensity={0.75} />
        <directionalLight position={[-40, 20, -30]} intensity={0.45} />
        <directionalLight position={[10, -30, 35]} intensity={0.3} />
        <RotatingMesh mesh={mesh} targetRotation={rotation} tweenDurationMs={tweenDurationMs} />
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
    </div>
  )
}
