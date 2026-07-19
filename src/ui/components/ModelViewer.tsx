import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Grid, OrbitControls } from '@react-three/drei'
import { Mesh as ThreeMesh, Quaternion } from 'three'
import { Mesh } from '../../domain/mesh'
import { meshToGeometry } from '../meshGeometry'

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
  })

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial color="#4f9dde" side={2} />
    </mesh>
  )
}

interface ModelViewerProps {
  readonly mesh: Mesh
  readonly rotation: Quaternion
  readonly tweenDurationMs: number
}

export function ModelViewer({ mesh, rotation, tweenDurationMs }: ModelViewerProps) {
  return (
    <Canvas camera={{ position: [40, 40, 40], fov: 45 }} style={{ background: '#12151a' }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[30, 50, 20]} intensity={0.8} />
      <RotatingMesh mesh={mesh} targetRotation={rotation} tweenDurationMs={tweenDurationMs} />
      {/* Print bed reference: the plane the model should rest on, at the +Y "up" direction. */}
      <Grid args={[100, 100]} position={[0, -20, 0]} cellColor="#334" sectionColor="#556" fadeDistance={120} />
      <OrbitControls />
    </Canvas>
  )
}
