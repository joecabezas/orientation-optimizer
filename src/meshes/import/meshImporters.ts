import { Mesh } from '../../domain/mesh'
import { centerMesh } from './centerMesh'
import { MeshImporter } from './MeshImporter'
import { stlMeshImporter } from './StlMeshImporter'

/** Registry of supported import formats. Add new importers here to extend format support. */
export const MESH_IMPORTERS: readonly MeshImporter[] = [stlMeshImporter]

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot === -1 ? '' : fileName.slice(dot + 1).toLowerCase()
}

export async function importMeshFile(file: File): Promise<Mesh> {
  const extension = extensionOf(file.name)
  const importer = MESH_IMPORTERS.find((i) => i.extensions.includes(extension))
  if (!importer) {
    const supported = MESH_IMPORTERS.flatMap((i) => i.extensions).join(', ')
    throw new Error(`Unsupported file type ".${extension}" — supported formats: ${supported}.`)
  }

  const buffer = await file.arrayBuffer()
  try {
    return centerMesh(importer.parse(buffer, file.name))
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new Error(`Could not import "${file.name}": ${reason}`)
  }
}
