import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import {
  login as apiLogin,
  azureAdLogin,
  ldapLogin,
  getAuthConfig,
  windowsAuth
} from '../api/client.js'
import { initMsal, AZURE_AD_SCOPES } from '../config/msalConfig.js'

const Stage = {
  CHECKING_WINDOWS: 'checking_windows',
  SHOW_FORM:        'show_form',
  LOGGING_IN:       'logging_in'
}

const Tab = {
  LDAP:  'ldap',
  FORM:  'form'
}

export default function Login() {
  const [stage,           setStage]         = useState(Stage.CHECKING_WINDOWS)
  const [activeTab,       setActiveTab]     = useState(Tab.LDAP)
  // LDAP form
  const [ldapUsername,    setLdapUsername]  = useState('')
  const [ldapPassword,    setLdapPassword]  = useState('')
  // Form login
  const [email,           setEmail]         = useState('')
  const [password,        setPassword]      = useState('')
  // State
  const [error,           setError]         = useState('')
  const [winAuthError,    setWinAuthError]  = useState('')
  const [ldapEnabled,     setLdapEnabled]   = useState(false)
  const [azureAdEnabled,  setAzureAdEnabled] = useState(false)
  const [azureAdConfig,   setAzureAdConfig]  = useState(null)

  const { login, isAuthenticated, user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated) {
      navigate(user?.role === 'it_admin' ? '/admin' : '/tickets', { replace: true })
    }
  }, [isAuthenticated, user, navigate])

  useEffect(() => {
    let cancelled = false

    async function init() {
      // 1. Try silent Windows/Negotiate auth
      try {
        const data = await windowsAuth()
        if (!cancelled && data?.token) {
          login(data.token, data)
          return
        }
      } catch (err) {
        if (err?.response?.status === 403) {
          if (!cancelled)
            setWinAuthError(err.response.data?.message || 'Windows 帳號尚未關聯至系統，請聯繫 IT 管理員')
        }
        // 401 expected on non-domain machines
      }

      if (cancelled) return
      setStage(Stage.SHOW_FORM)

      // 2. Fetch auth config
      try {
        const cfg = await getAuthConfig()
        if (!cancelled) {
          setLdapEnabled(!!cfg.ldapAuth)
          setAzureAdEnabled(!!cfg.azureAd)
          if (cfg.azureAd) setAzureAdConfig(cfg)
          // Default tab: LDAP if available, else form login
          setActiveTab(cfg.ldapAuth ? Tab.LDAP : Tab.FORM)
        }
      } catch {
        // Non-critical
        if (!cancelled) setActiveTab(Tab.FORM)
      }
    }

    init()
    return () => { cancelled = true }
  }, [login])

  // ── LDAP Login ───────────────────────────────────────────────────────────
  const handleLdapSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setStage(Stage.LOGGING_IN)
    try {
      const data = await ldapLogin(ldapUsername, ldapPassword)
      login(data.token, data)
    } catch (err) {
      setError(err.response?.data?.message || 'LDAP 登入失敗，請確認帳號密碼')
      setStage(Stage.SHOW_FORM)
    }
  }

  // ── Form Login ────────────────────────────────────────────────────────────
  const handleFormSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setStage(Stage.LOGGING_IN)
    try {
      const data = await apiLogin(email, password)
      login(data.token, data)
    } catch (err) {
      setError(err.response?.data?.message || '登入失敗，請確認帳號密碼')
      setStage(Stage.SHOW_FORM)
    }
  }

  // ── Azure AD Login ────────────────────────────────────────────────────────
  const handleAzureAdLogin = async () => {
    if (!azureAdConfig) return
    setError('')
    setStage(Stage.LOGGING_IN)
    try {
      const msal   = await initMsal(azureAdConfig.azureAdClientId, azureAdConfig.azureAdTenantId)
      const result = await msal.loginPopup({ scopes: AZURE_AD_SCOPES })
      const idToken = result.idToken
      if (!idToken) throw new Error('未取得 ID Token')
      const data = await azureAdLogin(idToken)
      login(data.token, data)
    } catch (err) {
      if (err?.errorCode === 'user_cancelled' || err?.name === 'BrowserAuthError') {
        setError('')
      } else {
        setError(err?.response?.data?.message || err?.message || 'Azure AD 登入失敗')
      }
      setStage(Stage.SHOW_FORM)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (stage === Stage.CHECKING_WINDOWS) {
    return (
      <div style={s.fullPage}>
        <div style={s.card}>
          <div style={s.logoWrap}>
            <span style={s.logo}>GITP</span>
            <p style={s.subtitle}>集團跨公司 IT 問題反應平台</p>
          </div>
          <div style={s.checking}>
            <div style={s.spinner} />
            <p style={s.checkingText}>正在驗證 Windows 身份…</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={s.fullPage}>
      <div style={s.card}>
        <div style={s.logoWrap}>
          <span style={s.logo}>GITP</span>
          <p style={s.subtitle}>集團跨公司 IT 問題反應平台</p>
        </div>

        {winAuthError && (
          <div style={s.warnBox}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <span style={{ marginLeft: 8 }}>{winAuthError}</span>
          </div>
        )}

        {/* Tab bar — only show if both LDAP and form login are available */}
        {ldapEnabled && (
          <div style={s.tabs}>
            <button
              style={{ ...s.tab, ...(activeTab === Tab.LDAP ? s.tabActive : {}) }}
              onClick={() => { setActiveTab(Tab.LDAP); setError('') }}
            >
              🔐 Windows 帳號（LDAP）
            </button>
            <button
              style={{ ...s.tab, ...(activeTab === Tab.FORM ? s.tabActive : {}) }}
              onClick={() => { setActiveTab(Tab.FORM); setError('') }}
            >
              ✉️ Email 帳號
            </button>
          </div>
        )}

        {/* LDAP Login Form */}
        {(activeTab === Tab.LDAP && ldapEnabled) && (
          <form onSubmit={handleLdapSubmit} style={s.form}>
            <div style={s.fieldNote}>
              使用 Windows 網域帳號登入，格式：<code>DOMAIN\username</code> 或 <code>username@domain.local</code>
            </div>
            <div style={s.field}>
              <label style={s.label}>Windows 帳號</label>
              <input
                type="text"
                value={ldapUsername}
                onChange={e => setLdapUsername(e.target.value)}
                placeholder="CORP\john.doe 或 john.doe@corp.local"
                required
                disabled={stage === Stage.LOGGING_IN}
                style={s.input}
                autoComplete="username"
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>密碼</label>
              <input
                type="password"
                value={ldapPassword}
                onChange={e => setLdapPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={stage === Stage.LOGGING_IN}
                style={s.input}
                autoComplete="current-password"
              />
            </div>
            {error && <div style={s.errBox}>{error}</div>}
            <button
              type="submit"
              disabled={stage === Stage.LOGGING_IN}
              style={{ ...s.btn, opacity: stage === Stage.LOGGING_IN ? 0.7 : 1 }}
            >
              {stage === Stage.LOGGING_IN ? '驗證中…' : 'Windows 帳號登入'}
            </button>
          </form>
        )}

        {/* Email / Form Login */}
        {(activeTab === Tab.FORM || !ldapEnabled) && (
          <form onSubmit={handleFormSubmit} style={s.form}>
            <div style={s.field}>
              <label style={s.label}>電子郵件</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@company.com"
                required
                disabled={stage === Stage.LOGGING_IN}
                style={s.input}
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>密碼</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={stage === Stage.LOGGING_IN}
                style={s.input}
              />
            </div>
            {error && <div style={s.errBox}>{error}</div>}
            <button
              type="submit"
              disabled={stage === Stage.LOGGING_IN}
              style={{ ...s.btn, opacity: stage === Stage.LOGGING_IN ? 0.7 : 1 }}
            >
              {stage === Stage.LOGGING_IN ? '登入中…' : '登入'}
            </button>
          </form>
        )}

        {/* Azure AD */}
        {azureAdEnabled && (
          <>
            <div style={s.divider}><span style={s.dividerText}>或</span></div>
            <button
              onClick={handleAzureAdLogin}
              disabled={stage === Stage.LOGGING_IN}
              style={s.aadBtn}
            >
              <MicrosoftIcon />
              使用 Azure AD 帳號登入
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" style={{ marginRight: 8, flexShrink: 0 }}>
      <rect x="1"  y="1"  width="9" height="9" fill="#f25022" />
      <rect x="11" y="1"  width="9" height="9" fill="#7fba00" />
      <rect x="1"  y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  )
}

const s = {
  fullPage: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, #1a56db 0%, #0e4aad 100%)'
  },
  card: {
    background: '#fff', borderRadius: 12, padding: '40px',
    width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.18)'
  },
  logoWrap: { textAlign: 'center', marginBottom: 24 },
  logo: { fontSize: 34, fontWeight: 700, color: '#1a56db', letterSpacing: 3 },
  subtitle: { color: '#666', marginTop: 6, fontSize: 13 },
  checking: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '20px 0 8px' },
  spinner: {
    width: 36, height: 36, border: '3px solid #e0e7ff',
    borderTopColor: '#1a56db', borderRadius: '50%', animation: 'spin 0.9s linear infinite'
  },
  checkingText: { color: '#555', fontSize: 14 },
  warnBox: {
    display: 'flex', alignItems: 'flex-start',
    background: '#fffbeb', border: '1px solid #f6c90e', borderRadius: 8,
    padding: '10px 14px', fontSize: 13, color: '#7d5700', marginBottom: 20
  },
  tabs: {
    display: 'flex', borderBottom: '2px solid #e5e7eb', marginBottom: 24, gap: 0
  },
  tab: {
    flex: 1, padding: '10px 8px', border: 'none', background: 'none',
    fontSize: 13, color: '#6b7280', cursor: 'pointer', fontWeight: 500,
    borderBottom: '2px solid transparent', marginBottom: -2
  },
  tabActive: { color: '#1a56db', borderBottomColor: '#1a56db', fontWeight: 700 },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  fieldNote: {
    background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af',
    padding: '8px 12px', borderRadius: 6, fontSize: 12, lineHeight: 1.5
  },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 13, fontWeight: 600, color: '#333' },
  input: { padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 15, outline: 'none' },
  errBox: {
    background: '#fff0f0', color: '#e53e3e', padding: '10px 14px',
    borderRadius: 8, fontSize: 13, border: '1px solid #feb2b2'
  },
  btn: {
    background: '#1a56db', color: '#fff', border: 'none', borderRadius: 8,
    padding: '12px', fontSize: 15, fontWeight: 600, cursor: 'pointer'
  },
  divider: { display: 'flex', alignItems: 'center', margin: '20px 0 16px', gap: 12 },
  dividerText: { color: '#aaa', fontSize: 12, padding: '0 8px', background: '#fff', whiteSpace: 'nowrap' },
  aadBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '100%', padding: '11px 16px', border: '1px solid #dadce0',
    borderRadius: 8, background: '#fff', color: '#3c4043',
    fontSize: 14, fontWeight: 500, cursor: 'pointer', gap: 0
  }
}
