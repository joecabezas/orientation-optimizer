import { Vector3 } from 'three'

/** A single triangle of a mesh, in the mesh's original (unrotated) local space. */
export interface Triangle {
  readonly a: Vector3
  readonly b: Vector3
  readonly c: Vector3
  /** Unit normal, precomputed once at mesh creation time. */
  readonly normal: Vector3
  /** Triangle area, precomputed once — used to weight fitness contributions. */
  readonly area: number
}

/** An immutable, precomputed triangle soup. Not tied to any particular rotation. */
export interface Mesh {
  readonly name: string
  readonly triangles: readonly Triangle[]
}

function computeNormal(a: Vector3, b: Vector3, c: Vector3): Vector3 {
  const ab = b.clone().sub(a)
  const ac = c.clone().sub(a)
  const normal = ab.cross(ac)
  const length = normal.length()
  return length > 1e-12 ? normal.divideScalar(length) : normal.set(0, 0, 0)
}

function computeArea(a: Vector3, b: Vector3, c: Vector3): number {
  const ab = b.clone().sub(a)
  const ac = c.clone().sub(a)
  return ab.clone().cross(ac).length() / 2
}

/** Builds a Triangle from three vertices, deriving normal and area. */
export function makeTriangle(a: Vector3, b: Vector3, c: Vector3): Triangle {
  return { a, b, c, normal: computeNormal(a, b, c), area: computeArea(a, b, c) }
}

/** Builds a Mesh from a flat list of vertex triples (each group of 3 vectors is one triangle). */
export function makeMesh(name: string, vertexTriples: readonly Vector3[]): Mesh {
  if (vertexTriples.length % 3 !== 0) {
    throw new Error(`makeMesh: vertex count must be a multiple of 3, got ${vertexTriples.length}`)
  }
  const triangles: Triangle[] = []
  for (let i = 0; i < vertexTriples.length; i += 3) {
    triangles.push(makeTriangle(vertexTriples[i], vertexTriples[i + 1], vertexTriples[i + 2]))
  }
  return { name, triangles }
}
