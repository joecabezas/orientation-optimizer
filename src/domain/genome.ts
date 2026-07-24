import { Euler, Quaternion } from 'three'

/**
 * A genome is a rotation plus identity/provenance metadata:
 * - `seq`: a monotonic creation-order id, unique for the process lifetime
 *   (not persisted — resets on reload). Doubles as a stable UI sort/display key.
 * - `generation`: the generation this genome was *born* in (seeded, crossed
 *   over, or mutated). An elite that survives unchanged across generations
 *   keeps its original birth generation, not the generation it's currently
 *   being displayed in.
 * - `rotationHash`: a deterministic fingerprint of `rotation` itself (see
 *   `quaternionHash`), so two genomes that represent the same orientation —
 *   however differently they were bred, and however different their `seq` —
 *   are recognizable as such at a glance.
 *
 * Quaternion remains the sole in-memory representation of the rotation —
 * Euler angles are derived only for display, never stored.
 */
export interface Genome {
  readonly seq: number
  readonly generation: number
  readonly rotationHash: string
  readonly rotation: Quaternion
}

let nextGenomeSeq = 0

export function makeGenome(rotation: Quaternion, generation: number): Genome {
  const normalized = rotation.clone().normalize()
  nextGenomeSeq += 1
  return { seq: nextGenomeSeq, generation, rotationHash: quaternionHash(normalized), rotation: normalized }
}

// Matches the precision `quaternionsExactlyEqual` cares about: components are
// rounded to this many decimal digits before hashing, so float noise from
// clone()/normalize()/slerp() round-tripping the same orientation still
// hashes identically, while any real difference — no matter how small —
// hashes differently.
const HASH_DECIMALS = 9

/**
 * Picks the canonical sign of {q, -q}. A quaternion and its negation
 * represent the identical rotation (the unit quaternions double-cover
 * SO(3)), so without this, two genomes at the exact same orientation could
 * still hash differently depending on which sign happened to fall out of
 * slerp/multiply.
 */
function canonicalSign(q: Quaternion): 1 | -1 {
  const first = [q.w, q.x, q.y, q.z].find((v) => Math.abs(v) > 1e-9) ?? 1
  return first < 0 ? -1 : 1
}

/** Tiny, non-cryptographic string hash (FNV-1a) — good enough for a compact display fingerprint. */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

/** A short, deterministic fingerprint of a rotation: same orientation in, same hash out. */
export function quaternionHash(q: Quaternion): string {
  const sign = canonicalSign(q)
  const key = [q.x, q.y, q.z, q.w].map((v) => (v * sign).toFixed(HASH_DECIMALS)).join(',')
  return fnv1a(key)
}

/**
 * True if two rotations are the *same* orientation (exactly, modulo
 * floating-point noise) — everything else, no matter how close, is a
 * distinct orientation. Compares rotation, not genome identity: a fresh
 * `seq`/id is assigned on every crossover/mutation, so two genomes can
 * represent the same orientation without ever being `===` or seq-equal.
 */
export function quaternionsExactlyEqual(a: Quaternion, b: Quaternion): boolean {
  return quaternionHash(a) === quaternionHash(b)
}

/** UI-only helper: derive Euler XYZ degrees from a rotation for display. */
export function rotationToEulerDegrees(rotation: Quaternion): { x: number; y: number; z: number } {
  const euler = new Euler().setFromQuaternion(rotation, 'XYZ')
  const toDeg = (rad: number) => (rad * 180) / Math.PI
  return { x: toDeg(euler.x), y: toDeg(euler.y), z: toDeg(euler.z) }
}
