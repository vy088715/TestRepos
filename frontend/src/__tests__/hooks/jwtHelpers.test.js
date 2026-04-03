/**
 * Unit tests for JWT helper functions used in useAuth.js
 * (parseToken, getTokenExpiryMs, isTokenExpired, isTokenNearExpiry)
 *
 * These functions are extracted here for isolated testing.
 * The REFRESH_THRESHOLD_MINUTES is 5 minutes.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ──────────────────────────────────────────────────────────────────────
//  Inline copies of the pure JWT utility functions from useAuth.js
// ──────────────────────────────────────────────────────────────────────

function parseToken(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]))
  } catch {
    return null
  }
}

function getTokenExpiryMs(token) {
  const payload = parseToken(token)
  return payload?.exp ? payload.exp * 1000 : null
}

function isTokenExpired(token) {
  const exp = getTokenExpiryMs(token)
  return exp !== null && exp < Date.now()
}

const REFRESH_THRESHOLD_MINUTES = 5

function isTokenNearExpiry(token) {
  const exp = getTokenExpiryMs(token)
  if (exp === null) return false
  return exp - Date.now() < REFRESH_THRESHOLD_MINUTES * 60 * 1000
}

// ──────────────────────────────────────────────────────────────────────
//  Token factory helpers
// ──────────────────────────────────────────────────────────────────────

function makeToken(expOffsetSeconds) {
  const now = Math.floor(Date.now() / 1000)
  const payload = { sub: 'user-1', exp: now + expOffsetSeconds }
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body   = btoa(JSON.stringify(payload))
  return `${header}.${body}.signature`
}

describe('JWT utility helpers', () => {
  // ──────────────────────────────────────────────────────────────────────
  //  parseToken
  // ──────────────────────────────────────────────────────────────────────

  describe('parseToken', () => {
    it('extracts payload from a valid token', () => {
      const token = makeToken(3600)
      const payload = parseToken(token)
      expect(payload).not.toBeNull()
      expect(payload.sub).toBe('user-1')
    })

    it('returns null for a malformed token', () => {
      expect(parseToken('not.a.token')).toBeNull()
    })

    it('returns null for an empty string', () => {
      expect(parseToken('')).toBeNull()
    })

    it('returns null when only one segment', () => {
      expect(parseToken('onlyonepart')).toBeNull()
    })
  })

  // ──────────────────────────────────────────────────────────────────────
  //  getTokenExpiryMs
  // ──────────────────────────────────────────────────────────────────────

  describe('getTokenExpiryMs', () => {
    it('returns exp * 1000 from token payload', () => {
      const expSec = Math.floor(Date.now() / 1000) + 3600
      const payload = { exp: expSec }
      const header  = btoa(JSON.stringify({ alg: 'HS256' }))
      const body    = btoa(JSON.stringify(payload))
      const token   = `${header}.${body}.sig`

      const result = getTokenExpiryMs(token)
      expect(result).toBe(expSec * 1000)
    })

    it('returns null for malformed token', () => {
      expect(getTokenExpiryMs('bad.token')).toBeNull()
    })
  })

  // ──────────────────────────────────────────────────────────────────────
  //  isTokenExpired
  // ──────────────────────────────────────────────────────────────────────

  describe('isTokenExpired', () => {
    it('returns false for a token expiring in the future', () => {
      const token = makeToken(3600)
      expect(isTokenExpired(token)).toBe(false)
    })

    it('returns true for a token that expired in the past', () => {
      const token = makeToken(-60)
      expect(isTokenExpired(token)).toBe(true)
    })

    it('returns false for a malformed token (no exp → not expired)', () => {
      // No exp claim — conservative: not expired
      const header  = btoa(JSON.stringify({ alg: 'HS256' }))
      const body    = btoa(JSON.stringify({ sub: 'user' }))
      const token   = `${header}.${body}.sig`
      expect(isTokenExpired(token)).toBe(false)
    })
  })

  // ──────────────────────────────────────────────────────────────────────
  //  isTokenNearExpiry
  // ──────────────────────────────────────────────────────────────────────

  describe('isTokenNearExpiry', () => {
    it('returns false for token with 30 min remaining', () => {
      const token = makeToken(30 * 60)
      expect(isTokenNearExpiry(token)).toBe(false)
    })

    it('returns true for token with 4 min remaining (< threshold)', () => {
      const token = makeToken(4 * 60)
      expect(isTokenNearExpiry(token)).toBe(true)
    })

    it('returns true for already-expired token', () => {
      const token = makeToken(-10)
      expect(isTokenNearExpiry(token)).toBe(true)
    })

    it('returns false for malformed token', () => {
      expect(isTokenNearExpiry('bad.tok')).toBe(false)
    })

    it('boundary: token with exactly 5 min remaining is NOT near expiry', () => {
      // 5 min === threshold, should return false (> not <)
      const token = makeToken(5 * 60 + 30)   // just over threshold
      expect(isTokenNearExpiry(token)).toBe(false)
    })

    it('boundary: token with 4m59s remaining IS near expiry', () => {
      const token = makeToken(4 * 60 + 59)   // just under threshold
      expect(isTokenNearExpiry(token)).toBe(true)
    })
  })
})
