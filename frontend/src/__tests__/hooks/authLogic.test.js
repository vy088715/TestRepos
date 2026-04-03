/**
 * Unit tests for the hasRole logic used in useAuth.
 * These are pure logic tests, no React rendering.
 */
import { describe, it, expect } from 'vitest'

// Mirror of useAuth's hasRole implementation
function hasRole(auth, role) {
  return auth?.user?.roles?.includes(role) ?? (auth?.user?.role === role)
}

// Mirror of useAuth's login role-resolution logic
function resolveEffectiveRole(roles) {
  if (roles.includes('it_admin'))    return 'it_admin'
  if (roles.includes('it_assignee')) return 'it_assignee'
  return 'employee'
}

describe('hasRole', () => {
  it('returns true when role is in roles array', () => {
    const auth = { user: { roles: ['it_admin', 'it_assignee'], role: 'it_admin' } }
    expect(hasRole(auth, 'it_admin')).toBe(true)
    expect(hasRole(auth, 'it_assignee')).toBe(true)
  })

  it('returns false when role is not in roles array', () => {
    const auth = { user: { roles: ['employee'], role: 'employee' } }
    expect(hasRole(auth, 'it_admin')).toBe(false)
  })

  it('falls back to role string when roles array is absent', () => {
    const auth = { user: { role: 'it_admin' } }
    expect(hasRole(auth, 'it_admin')).toBe(true)
    expect(hasRole(auth, 'employee')).toBe(false)
  })

  it('returns undefined/falsy when auth is null', () => {
    expect(hasRole(null, 'it_admin')).toBeFalsy()
  })

  it('returns undefined/falsy when user is null', () => {
    expect(hasRole({ user: null }, 'it_admin')).toBeFalsy()
  })
})

describe('resolveEffectiveRole', () => {
  it('it_admin wins over everything', () => {
    expect(resolveEffectiveRole(['it_admin', 'it_assignee', 'employee'])).toBe('it_admin')
  })

  it('it_assignee wins over employee', () => {
    expect(resolveEffectiveRole(['it_assignee', 'employee'])).toBe('it_assignee')
  })

  it('falls back to employee when no IT roles', () => {
    expect(resolveEffectiveRole(['employee'])).toBe('employee')
  })

  it('empty roles defaults to employee', () => {
    expect(resolveEffectiveRole([])).toBe('employee')
  })

  it('single admin role gives it_admin', () => {
    expect(resolveEffectiveRole(['it_admin'])).toBe('it_admin')
  })
})
