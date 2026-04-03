/**
 * Pure unit tests for priority matrix calculation logic.
 * These mirror TicketStateMachineTests.cs on the frontend.
 * Formula: Math.ceil((severity + urgency - 1) / 2)
 */
import { describe, it, expect } from 'vitest'

function getPriority(s, u) {
  return Math.ceil((s + u - 1) / 2)
}

describe('Priority matrix formula', () => {
  // Full 3×3 expected values
  const matrix = [
    [1, 1, 1],  // ceil(0.5) = 1
    [1, 2, 1],  // ceil(1.0) = 1
    [1, 3, 2],  // ceil(1.5) = 2
    [2, 1, 1],  // ceil(1.0) = 1
    [2, 2, 2],  // ceil(1.5) = 2
    [2, 3, 2],  // ceil(2.0) = 2
    [3, 1, 2],  // ceil(1.5) = 2
    [3, 2, 2],  // ceil(2.0) = 2
    [3, 3, 3],  // ceil(2.5) = 3
  ]

  it.each(matrix)(
    'getPriority(%i, %i) === %i',
    (s, u, expected) => {
      expect(getPriority(s, u)).toBe(expected)
    }
  )

  it('is symmetric — getPriority(s, u) === getPriority(u, s)', () => {
    for (let s = 1; s <= 3; s++) {
      for (let u = 1; u <= 3; u++) {
        expect(getPriority(s, u)).toBe(getPriority(u, s))
      }
    }
  })

  it('always returns a value between 1 and 3 (inclusive)', () => {
    for (let s = 1; s <= 3; s++) {
      for (let u = 1; u <= 3; u++) {
        const p = getPriority(s, u)
        expect(p).toBeGreaterThanOrEqual(1)
        expect(p).toBeLessThanOrEqual(3)
      }
    }
  })

  it('minimum inputs give P1', () => {
    expect(getPriority(1, 1)).toBe(1)
  })

  it('maximum inputs give P3', () => {
    expect(getPriority(3, 3)).toBe(3)
  })
})
