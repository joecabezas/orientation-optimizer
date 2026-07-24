import { Vector3 } from 'three'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'
import { makeMesh } from '../../domain/mesh'
import { MeshImporter } from './MeshImporter'

export const stlMeshImporter: MeshImporter = {
  extensions: ['stl'],
  parse(buffer, name) {
    const geometry = new STLLoader().parse(buffer)
    const position = geometry.getAttribute('position')
    if (!position || position.count === 0) {
      throw new Error(`"${name}" contains no triangles.`)
    }

    const vertices: Vector3[] = []
    for (let i = 0; i < position.count; i++) {
      vertices.push(new Vector3(position.getX(i), position.getY(i), position.getZ(i)))
    }

    return makeMesh(name, vertices)
  },
}
