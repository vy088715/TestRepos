import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getCompanies,
  getLdapSettings,
  saveLdapSettings,
  deleteLdapSettings,
  testLdapConnection
} from '../api/client.js'
import { useAuth } from '../hooks/useAuth.js'

const DEFAULT_FORM = {
  ldapHost: '',
  ldapPort: 389,
  useSsl: false,
  baseDn: '',
  domainPrefix: '',
  upnSuffix: '',
  bindDn: '',
  bindPassword: '',
  userSearchBase: '',
  userFilter: '(sAMAccountName={0})',
  enabled: true
}

export default function LdapSettingsManagement() {
  const [companies, setCompanies] = useState([])
  const [ldapMap, setLdapMap] = useState({})     // companyId -> LdapSettingsDto
  const [editing, setEditing] = useState(null)   // companyId being edited
  const [form, setForm] = useState(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(null)
  const [testResult, setTestResult] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [comps, settings] = await Promise.all([getCompanies(), getLdapSettings()])
      setCompanies(comps)
      const map = {}
      settings.forEach(s => { map[s.companyId] = s })
      setLdapMap(map)
    } catch {
      setError('無法載入資料')
    } finally {
      setLoading(false)
    }
  }

  const startEdit = (company) => {
    const existing = ldapMap[company.id]
    setForm(existing ? {
      ldapHost: existing.ldapHost,
      ldapPort: existing.ldapPort,
      useSsl: existing.useSsl,
      baseDn: existing.baseDn,
      domainPrefix: existing.domainPrefix || '',
      upnSuffix: existing.upnSuffix || '',
      bindDn: existing.bindDn || '',
      bindPassword: '',         // never pre-fill password
      userSearchBase: existing.userSearchBase || '',
      userFilter: existing.userFilter || '(sAMAccountName={0})',
      enabled: existing.enabled
    } : { ...DEFAULT_FORM })
    setEditing(company.id)
    setError('')
  }

  const handleSave = async () => {
    if (!form.ldapHost.trim()) { setError('LDAP 主機位址為必填'); return }
    if (!form.baseDn.trim()) { setError('Base DN 為必填'); return }
    setSaving(true)
    setError('')
    try {
      const result = await saveLdapSettings(editing, {
        ...form,
        bindPassword: form.bindPassword || null  // null = keep existing
      })
      setLdapMap(prev => ({ ...prev, [editing]: result }))
      setEditing(null)
    } catch (err) {
      setError(err.response?.data?.message || '儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (companyId) => {
    if (!confirm('確定要刪除此公司的 LDAP 設定嗎？')) return
    try {
      await deleteLdapSettings(companyId)
      setLdapMap(prev => { const n = { ...prev }; delete n[companyId]; return n })
    } catch (err) {
      setError(err.response?.data?.message || '刪除失敗')
    }
  }

  const handleTest = async (companyId) => {
    setTesting(companyId)
    setTestResult(prev => ({ ...prev, [companyId]: null }))
    try {
      const res = await testLdapConnection(companyId)
      setTestResult(prev => ({ ...prev, [companyId]: { ok: true, message: res.message } }))
    } catch (err) {
      const msg = err.response?.data?.message || '連線測試失敗'
      setTestResult(prev => ({ ...prev, [companyId]: { ok: false, message: msg } }))
    } finally {
      setTesting(null)
    }
  }

  const f = (field) => e => setForm(prev => ({
    ...prev,
    [field]: e.target.type === 'checkbox' ? e.target.checked :
             e.target.type === 'number' ? Number(e.target.value) :
             e.target.value
  }))

  return (
    <div style={S.container}>
      <header style={S.header}>
        <h1 style={S.logo}>GITP LDAP 設定</h1>
        <div style={S.headerRight}>
          <span style={S.userName}>{user?.name}</span>
          <button onClick={() => navigate('/admin')} style={S.navBtn}>管理後台</button>
          <button onClick={() => navigate('/admin/companies')} style={S.navBtn}>公司管理</button>
          <button onClick={logout} style={S.logoutBtn}>登出</button>
        </div>
      </header>

      <main style={S.main}>
        <div style={S.titleSection}>
          <h2 style={S.pageTitle}>各子公司 LDAP 伺服器設定</h2>
          <p style={S.pageDesc}>
            各子公司可能有不同的 AD/LDAP 伺服器位址（IP）。
            設定後，使用者可使用 Windows 網域帳號（如 <code>CORP\john</code> 或 <code>john@corp.local</code>）登入系統。
          </p>
        </div>

        {error && <div style={S.errorBox}>{error}</div>}

        {loading ? <div style={S.loading}>載入中...</div> : (
          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead>
                <tr style={S.thead}>
                  <th style={S.th}>公司名稱</th>
                  <th style={S.th}>LDAP 主機（IP）</th>
                  <th style={S.th}>Port</th>
                  <th style={S.th}>Domain / UPN</th>
                  <th style={S.th}>狀態</th>
                  <th style={S.th}>操作</th>
                </tr>
              </thead>
              <tbody>
                {companies.map(company => {
                  const cfg = ldapMap[company.id]
                  const tr = testResult[company.id]
                  return (
                    <tr key={company.id} style={S.row}>
                      <td style={S.td}><strong>{company.name}</strong></td>
                      <td style={S.td}>
                        {cfg ? <code style={S.code}>{cfg.ldapHost}</code>
                              : <span style={S.notSet}>尚未設定</span>}
                      </td>
                      <td style={S.td}>{cfg?.ldapPort ?? '—'}</td>
                      <td style={S.td}>
                        {cfg ? (
                          <span style={S.domainText}>
                            {[cfg.domainPrefix && `${cfg.domainPrefix}\\`, cfg.upnSuffix && `@${cfg.upnSuffix}`]
                              .filter(Boolean).join(' / ') || '—'}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={S.td}>
                        {cfg
                          ? cfg.enabled
                            ? <span style={S.badgeEnabled}>✅ 啟用</span>
                            : <span style={S.badgeDisabled}>停用</span>
                          : <span style={S.badgeNone}>未設定</span>}
                      </td>
                      <td style={S.td}>
                        <div style={S.actions}>
                          <button onClick={() => startEdit(company)} style={S.editBtn}>
                            {cfg ? '編輯' : '新增設定'}
                          </button>
                          {cfg && (
                            <>
                              <button
                                onClick={() => handleTest(company.id)}
                                disabled={testing === company.id}
                                style={S.testBtn}
                              >
                                {testing === company.id ? '測試中...' : '測試連線'}
                              </button>
                              <button onClick={() => handleDelete(company.id)} style={S.deleteBtn}>刪除</button>
                            </>
                          )}
                        </div>
                        {tr && (
                          <div style={tr.ok ? S.testOk : S.testFail}>
                            {tr.ok ? '✅' : '❌'} {tr.message}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={S.note}>
          <strong>💡 說明：</strong>
          Domain Prefix（如 <code>CORP</code>）對應 <code>CORP\username</code> 格式；
          UPN Suffix（如 <code>corp.local</code>）對應 <code>username@corp.local</code> 格式。
          至少設定其一，系統才能自動識別使用者所屬的 LDAP 伺服器。
        </div>
      </main>

      {/* Edit Modal */}
      {editing && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <h3 style={S.modalTitle}>
              {ldapMap[editing] ? '編輯' : '新增'} LDAP 設定
              <span style={S.modalCompany}>
                {companies.find(c => c.id === editing)?.name}
              </span>
            </h3>

            <div style={S.formGrid}>
              <label style={S.label}>
                LDAP 主機位址 / IP *
                <input style={S.input} value={form.ldapHost} onChange={f('ldapHost')} placeholder="192.168.1.100 或 ad.corp.local" />
              </label>
              <label style={S.label}>
                Port *
                <input style={S.input} type="number" value={form.ldapPort} onChange={f('ldapPort')} min={1} max={65535} />
              </label>
              <label style={S.checkLabel}>
                <input type="checkbox" checked={form.useSsl} onChange={f('useSsl')} />
                使用 SSL / LDAPS（Port 通常為 636）
              </label>
              <label style={S.labelFull}>
                Base DN *
                <input style={S.input} value={form.baseDn} onChange={f('baseDn')} placeholder="DC=corp,DC=local" />
              </label>
              <label style={S.label}>
                Domain Prefix
                <input style={S.input} value={form.domainPrefix} onChange={f('domainPrefix')} placeholder="CORP（對應 CORP\\user）" />
              </label>
              <label style={S.label}>
                UPN Suffix
                <input style={S.input} value={form.upnSuffix} onChange={f('upnSuffix')} placeholder="corp.local（對應 user@corp.local）" />
              </label>
              <label style={S.labelFull}>
                服務帳號 DN（Bind DN，可選）
                <input style={S.input} value={form.bindDn} onChange={f('bindDn')} placeholder="CN=svc_gitp,OU=Services,DC=corp,DC=local" />
              </label>
              <label style={S.labelFull}>
                服務帳號密碼（留空 = 保留原密碼）
                <input style={S.input} type="password" value={form.bindPassword} onChange={f('bindPassword')} placeholder="留空則不更新密碼" autoComplete="new-password" />
              </label>
              <label style={S.labelFull}>
                使用者搜尋 Base（可選，留空用 Base DN）
                <input style={S.input} value={form.userSearchBase} onChange={f('userSearchBase')} placeholder="OU=Users,DC=corp,DC=local" />
              </label>
              <label style={S.labelFull}>
                使用者篩選 Filter
                <input style={S.input} value={form.userFilter} onChange={f('userFilter')} placeholder="(sAMAccountName={0})" />
                <small style={S.hint}>{'{0}'} 會被替換為使用者名稱</small>
              </label>
              <label style={S.checkLabel}>
                <input type="checkbox" checked={form.enabled} onChange={f('enabled')} />
                啟用此 LDAP 設定
              </label>
            </div>

            {error && <div style={S.modalError}>{error}</div>}

            <div style={S.modalActions}>
              <button onClick={handleSave} disabled={saving} style={S.saveBtn}>
                {saving ? '儲存中...' : '儲存'}
              </button>
              <button onClick={() => { setEditing(null); setError('') }} style={S.cancelBtn}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const S = {
  container: { minHeight: '100vh', background: '#f5f7fa' },
  header: {
    background: '#1a1a2e', color: '#fff', padding: '0 24px', height: 60,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
  },
  logo: { fontSize: 18, fontWeight: 700 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 12 },
  userName: { fontSize: 14, opacity: 0.8 },
  navBtn: {
    background: 'rgba(255,255,255,0.1)', color: '#fff',
    border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6,
    padding: '6px 12px', cursor: 'pointer', fontSize: 13
  },
  logoutBtn: { background: 'none', color: 'rgba(255,255,255,0.7)', border: 'none', cursor: 'pointer', fontSize: 13 },
  main: { maxWidth: 1100, margin: '0 auto', padding: '24px 16px' },
  titleSection: { marginBottom: 24 },
  pageTitle: { fontSize: 22, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 },
  pageDesc: { fontSize: 14, color: '#666', lineHeight: 1.6 },
  errorBox: {
    background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b',
    padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14
  },
  loading: { textAlign: 'center', padding: 40, color: '#888' },
  tableWrap: {
    background: '#fff', borderRadius: 10,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden', marginBottom: 20
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#f8fafc' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#555', borderBottom: '1px solid #eee' },
  row: {},
  td: { padding: '14px 16px', fontSize: 14, color: '#333', borderBottom: '1px solid #f0f0f0', verticalAlign: 'top' },
  code: { background: '#f3f4f6', padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace', fontSize: 13 },
  notSet: { color: '#aaa', fontStyle: 'italic', fontSize: 13 },
  domainText: { fontSize: 13, color: '#555', fontFamily: 'monospace' },
  badgeEnabled: { background: '#dcfce7', color: '#166534', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  badgeDisabled: { background: '#fef3c7', color: '#92400e', padding: '3px 10px', borderRadius: 20, fontSize: 12 },
  badgeNone: { background: '#f3f4f6', color: '#9ca3af', padding: '3px 10px', borderRadius: 20, fontSize: 12 },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  editBtn: { padding: '5px 12px', background: '#1a56db', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 12 },
  testBtn: { padding: '5px 12px', background: '#fff', border: '1px solid #6366f1', color: '#6366f1', borderRadius: 5, cursor: 'pointer', fontSize: 12 },
  deleteBtn: { padding: '5px 12px', background: '#fff', border: '1px solid #ef4444', color: '#ef4444', borderRadius: 5, cursor: 'pointer', fontSize: 12 },
  testOk: { marginTop: 6, fontSize: 12, color: '#166534', background: '#dcfce7', padding: '4px 8px', borderRadius: 4 },
  testFail: { marginTop: 6, fontSize: 12, color: '#991b1b', background: '#fee2e2', padding: '4px 8px', borderRadius: 4 },
  note: {
    background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af',
    padding: '12px 16px', borderRadius: 8, fontSize: 13, lineHeight: 1.7
  },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: {
    background: '#fff', borderRadius: 12, padding: '28px 32px',
    width: 580, maxHeight: '90vh', overflowY: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
  },
  modalTitle: { fontSize: 17, fontWeight: 700, marginBottom: 20, color: '#1a1a1a', display: 'flex', alignItems: 'center', gap: 10 },
  modalCompany: { fontSize: 13, fontWeight: 500, color: '#6b7280', background: '#f3f4f6', padding: '2px 10px', borderRadius: 20 },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px', marginBottom: 20 },
  label: { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13, color: '#374151', fontWeight: 500 },
  labelFull: { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13, color: '#374151', fontWeight: 500, gridColumn: 'span 2' },
  checkLabel: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', gridColumn: 'span 2', cursor: 'pointer' },
  input: { padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, outline: 'none', marginTop: 2 },
  hint: { color: '#9ca3af', fontSize: 11, marginTop: 2 },
  modalError: { background: '#fee2e2', color: '#991b1b', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 14 },
  modalActions: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
  saveBtn: { padding: '9px 24px', background: '#1a56db', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 },
  cancelBtn: { padding: '9px 18px', background: '#fff', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer' }
}
