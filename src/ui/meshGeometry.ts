import { BufferGeometry, Float32BufferAttribute } from 'three'
import { Mesh } from '../domain/mesh'

/** Converts our immutable Mesh (triangle soup) into a three.js BufferGeometry for rendering. */
export function meshToGeometry(mesh: Mesh): BufferGeometry {
  const positions = new Float32Array(mesh.triangles.length * 9)
  let i = 0
  for (const tri of mesh.triangles) {
    positions[i++] = tri.a.x
    positions[i++] = tri.a.y
    positions[i++] = tri.a.z
    positions[i++] = tri.b.x
    positions[i++] = tri.b.y
    positions[i++] = tri.b.z
    positions[i++] = tri.c.x
    positions[i++] = tri.c.y
    positions[i++] = tri.c.z
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return geometry
}
