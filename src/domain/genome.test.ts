import { describe, expect, it } from 'vitest'
import { Quaternion, Vector3 } from 'three'
import { makeGenome, quaternionHash, quaternionsExactlyEqual } from './genome'

describe('quaternionsExactlyEqual', () => {
  it('is true for the same rotation', () => {
    const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.7)
    expect(quaternionsExactlyEqual(q, q.clone())).toBe(true)
  })

  it('is true for a quaternion and its negation (double cover of the same rotation)', () => {
    const q = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 1.2)
    const negated = new Quaternion(-q.x, -q.y, -q.z, -q.w)
    expect(quaternionsExactlyEqual(q, negated)).toBe(true)
  })

  it('is false for rotations that are close but not exactly equal, no matter how small the difference', () => {
    const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.5)
    const nudged = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.5 + 1e-4)
    expect(quaternionsExactlyEqual(q, nudged)).toBe(false)
  })

  it('is false for clearly different rotations', () => {
    const a = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 0.3)
    const b = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 1.9)
    expect(quaternionsExactlyEqual(a, b)).toBe(false)
  })
})

describe('quaternionHash', () => {
  it('is the same for the same orientation, and different for a different one', () => {
    const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.9)
    const other = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 0.4)
    expect(quaternionHash(q)).toBe(quaternionHash(q.clone()))
    expect(quaternionHash(q)).not.toBe(quaternionHash(other))
  })

  it('is the same for a quaternion and its negation', () => {
    const q = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 2.1)
    const negated = new Quaternion(-q.x, -q.y, -q.z, -q.w)
    expect(quaternionHash(q)).toBe(quaternionHash(negated))
  })
})

describe('makeGenome', () => {
  it('assigns a monotonically increasing seq, the given birth generation, and a rotation hash', () => {
    const rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 1.1)
    const first = makeGenome(rotation, 3)
    const second = makeGenome(rotation, 3)

    expect(second.seq).toBeGreaterThan(first.seq)
    expect(first.generation).toBe(3)
    // Same orientation -> same hash, even though seq differs.
    expect(first.rotationHash).toBe(second.rotationHash)
    expect(first.rotationHash).toBe(quaternionHash(rotation))
  })
})
