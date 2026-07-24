import { Vector3 } from 'three'
import { makeMesh, Mesh } from '../../domain/mesh'

/** Re-centers a mesh so its bounding-box midpoint sits at the origin. */
export function centerMesh(mesh: Mesh): Mesh {
  const min = new Vector3(Infinity, Infinity, Infinity)
  const max = new Vector3(-Infinity, -Infinity, -Infinity)
  for (const tri of mesh.triangles) {
    for (const vertex of [tri.a, tri.b, tri.c]) {
      min.min(vertex)
      max.max(vertex)
    }
  }
  if (!isFinite(min.x)) return mesh // no triangles

  const center = min.add(max).multiplyScalar(0.5)
  if (center.lengthSq() === 0) return mesh

  const vertices: Vector3[] = []
  for (const tri of mesh.triangles) {
    vertices.push(tri.a.clone().sub(center), tri.b.clone().sub(center), tri.c.clone().sub(center))
  }
  return makeMesh(mesh.name, vertices)
}
