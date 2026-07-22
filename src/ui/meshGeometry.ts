import { BufferGeometry, Color, Float32BufferAttribute, Quaternion, Vector3 } from 'three'
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
  // Flat-shaded, per-triangle color for the straight-down-face highlight:
  // updated every frame from the mesh's own stored per-triangle normal
  // (not the smoothed vertex normals above, which blend across shared
  // vertices and can't tell "this exact triangle is flat-down").
  geometry.setAttribute('color', new Float32BufferAttribute(new Float32Array(mesh.triangles.length * 9), 3))
  return geometry
}

const BASE_COLOR = new Color('#4f9dde')
const STRAIGHT_DOWN_COLOR = new Color('#e5484d')

/**
 * Recomputes the geometry's per-triangle color attribute for the current
 * rotation: any triangle whose rotated normal points exactly straight down
 * (normal.y === -1, i.e. it would rest flat against the bed) is highlighted;
 * everything else keeps the base color. Called every frame so the highlight
 * tracks the mesh's live orientation, not just its rest pose.
 */
export function updateStraightDownColors(geometry: BufferGeometry, mesh: Mesh, rotation: Quaternion): void {
  const colorAttr = geometry.getAttribute('color') as InstanceType<typeof Float32BufferAttribute>
  const normal = new Vector3()
  let i = 0
  for (const tri of mesh.triangles) {
    normal.copy(tri.normal).applyQuaternion(rotation)
    const color = normal.y === -1 ? STRAIGHT_DOWN_COLOR : BASE_COLOR
    for (let v = 0; v < 3; v++) {
      colorAttr.setXYZ(i++, color.r, color.g, color.b)
    }
  }
  colorAttr.needsUpdate = true
}
