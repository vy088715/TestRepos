import { useState, useCallback, useEffect, useRef } from 'react'

const STORAGE_KEY = 'gitp_auth'

// Refresh when token has fewer than this many minutes remaining
const REFRESH_THRESHOLD_MINUTES = 5

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

function isTokenNearExpiry(token) {
  const exp = getTokenExpiryMs(token)
  if (exp === null) return false
  return exp - Date.now() < REFRESH_THRESHOLD_MINUTES * 60 * 1000
}

function loadAuth() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    const parsed = JSON.parse(stored)
    if (parsed?.token && isTokenExpired(parsed.token)) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

let _authState = loadAuth()
const _listeners = new Set()

function notifyListeners() {
  _listeners.forEach(fn => fn(_authState))
}

// Singleton in-flight refresh promise to avoid duplicate refresh calls
let _refreshPromise = null

export function useAuth() {
  const [auth, setAuth] = useState(_authState)
  const timerRef = useRef(null)

  const listener = useCallback((newState) => {
    setAuth(newState)
  }, [])

  useEffect(() => {
    _listeners.add(listener)
    return () => _listeners.delete(listener)
  }, [listener])

  const login = useCallback((token, userInfo) => {
    const payload = parseToken(token)
    const u = userInfo?.user || userInfo

    let roles = []
    if (payload) {
      const roleClaim =
        payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ||
        payload['role'] ||
        payload['roles']
      if (Array.isArray(roleClaim)) roles = roleClaim
      else if (typeof roleClaim === 'string')
        roles = roleClaim.split(',').map(r => r.trim()).filter(Boolean)
    }
    if (roles.length === 0) roles = ['employee']

    const isItCompany =
      u?.isItCompany === true ||
      payload?.is_it_company === 'true' ||
      payload?.is_it_company === true

    const user = {
      id:          u?.id || u?.userId || payload?.sub,
      name:        u?.name || payload?.emp_name || payload?.name,
      empId:       u?.empId || payload?.emp_id || '',
      empName:     u?.name || payload?.emp_name || payload?.name || '',
      companyId:   u?.companyId || payload?.company_id,
      companyName: u?.companyName || payload?.company_name || '',
      companyCode: u?.companyCode || payload?.company_code || '',
      depId:       u?.depId || payload?.dep_id || '',
      depName:     u?.depName || payload?.dep_name || '',
      createdAt:   payload?.created_at || '',
      email:       u?.email || payload?.email || '',
      role:        roles.includes('it_admin')
                     ? 'it_admin'
                     : roles.includes('it_assignee') ? 'it_assignee' : 'employee',
      roles,
      isItCompany
    }

    const newState = { token, user }
    _authState = newState
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState))
    notifyListeners()
  }, [])

  const logout = useCallback(() => {
    _authState = null
    localStorage.removeItem(STORAGE_KEY)
    _refreshPromise = null
    notifyListeners()
  }, [])

  /**
   * Silently refresh the JWT.  Returns the new token on success, null on failure.
   * Uses a singleton promise so concurrent calls share one HTTP request.
   */
  const refreshToken = useCallback(async () => {
    if (!_authState?.token) return null

    if (!_refreshPromise) {
      _refreshPromise = (async () => {
        try {
          const { refreshToken: apiRefresh } = await import('../api/client.js')
          const data = await apiRefresh()
          if (data?.token) {
            // Update stored token, keep existing user info
            const newState = { ..._authState, token: data.token }
            _authState = newState
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newState))
            notifyListeners()
            return data.token
          }
        } catch (err) {
          // Refresh failed (e.g., server-side session invalidated) → logout
          console.warn('[GITP] Token refresh failed, logging out:', err?.message)
          _authState = null
          localStorage.removeItem(STORAGE_KEY)
          notifyListeners()
        } finally {
          _refreshPromise = null
        }
        return null
      })()
    }

    return _refreshPromise
  }, [])

  // ── Auto-refresh timer ────────────────────────────────────────────────────
  useEffect(() => {
    const CHECK_INTERVAL_MS = 60_000 // check every 60 seconds

    async function checkAndRefresh() {
      if (!_authState?.token) return
      if (isTokenExpired(_authState.token)) {
        // Already expired — logout without attempting refresh
        _authState = null
        localStorage.removeItem(STORAGE_KEY)
        notifyListeners()
        return
      }
      if (isTokenNearExpiry(_authState.token)) {
        await refreshToken()
      }
    }

    // Run once immediately in case the page loaded with a near-expiry token
    checkAndRefresh()

    timerRef.current = setInterval(checkAndRefresh, CHECK_INTERVAL_MS)
    return () => clearInterval(timerRef.current)
  }, [refreshToken])

  const hasRole = useCallback((role) => {
    return auth?.user?.roles?.includes(role) ?? (auth?.user?.role === role)
  }, [auth])

  const tryWindowsAuth = useCallback(async () => {
    try {
      const { windowsAuth } = await import('../api/client.js')
      const data = await windowsAuth()
      if (data?.token) {
        login(data.token, data)
        return true
      }
    } catch {
      // NTLM not available or user not mapped — fall through to form login
    }
    return false
  }, [login])

  return {
    user:            auth?.user || null,
    token:           auth?.token || null,
    isAuthenticated: !!auth?.token,
    login,
    logout,
    hasRole,
    tryWindowsAuth,
    refreshToken
  }
}
