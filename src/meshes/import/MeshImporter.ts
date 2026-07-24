import { Mesh } from '../../domain/mesh'

/** A pluggable strategy for turning a file's raw bytes into a Mesh. */
export interface MeshImporter {
  /** Lowercase extensions this importer handles, without the leading dot (e.g. ['stl']). */
  readonly extensions: readonly string[]
  parse(buffer: ArrayBuffer, name: string): Mesh
}
