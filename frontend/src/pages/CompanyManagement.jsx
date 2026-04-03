import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCompanies, setCompanyItFlag } from '../api/client.js'
import { useAuth } from '../hooks/useAuth.js'

export default function CompanyManagement() {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)
  const [error, setError] = useState('')
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    loadCompanies()
  }, [])

  const loadCompanies = async () => {
    setLoading(true)
    try {
      const data = await getCompanies()
      setCompanies(data)
    } catch {
      setError('無法載入公司清單')
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (company) => {
    setUpdating(company.id)
    setError('')
    try {
      const updated = await setCompanyItFlag(company.id, !company.isItCompany)
      setCompanies(prev => prev.map(c => c.id === company.id ? updated : c))
    } catch (err) {
      setError(`更新失敗：${err.response?.data?.message || err.message}`)
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.logo}>GITP 公司管理</h1>
        <div style={styles.headerRight}>
          <span style={styles.userName}>{user?.name}</span>
          <button onClick={() => navigate('/admin')} style={styles.navBtn}>管理後台</button>
          <button onClick={() => navigate('/admin/users')} style={styles.navBtn}>人員管理</button>
          <button onClick={() => navigate('/admin/ldap')} style={styles.navBtnHighlight}>🔐 LDAP 設定</button>
          <button onClick={logout} style={styles.logoutBtn}>登出</button>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.titleSection}>
          <h2 style={styles.pageTitle}>IT 公司設定</h2>
          <p style={styles.pageDesc}>
            標記為「IT 公司」的公司，其人員才可以執行工單結案。其他公司人員僅能補充說明或轉派處理人員。
          </p>
          <div style={styles.ldapBanner}>
            <span>🔐 各子公司的 Windows 登入 LDAP 伺服器設定，請前往</span>
            <button onClick={() => navigate('/admin/ldap')} style={styles.ldapLink}>LDAP 設定</button>
          </div>
        </div>

        {error && (
          <div style={styles.errorBox}>{error}</div>
        )}

        {loading ? (
          <div style={styles.loading}>載入中...</div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.thead}>
                  <th style={styles.th}>公司名稱</th>
                  <th style={styles.th}>代碼</th>
                  <th style={styles.th}>IT 公司（可結案）</th>
                  <th style={styles.th}>操作</th>
                </tr>
              </thead>
              <tbody>
                {companies.map(company => (
                  <tr key={company.id} style={styles.row}>
                    <td style={styles.td}>{company.name}</td>
                    <td style={styles.td}>
                      <code style={styles.code}>{company.code}</code>
                    </td>
                    <td style={styles.td}>
                      {company.isItCompany ? (
                        <span style={styles.badgeIt}>✅ IT 公司</span>
                      ) : (
                        <span style={styles.badgeNormal}>一般公司</span>
                      )}
                    </td>
                    <td style={styles.td}>
                      <button
                        onClick={() => handleToggle(company)}
                        disabled={updating === company.id}
                        style={{
                          ...styles.toggleBtn,
                          background: company.isItCompany ? '#fee2e2' : '#dcfce7',
                          color: company.isItCompany ? '#991b1b' : '#166534',
                          borderColor: company.isItCompany ? '#fca5a5' : '#86efac',
                          opacity: updating === company.id ? 0.6 : 1
                        }}
                      >
                        {updating === company.id
                          ? '更新中...'
                          : company.isItCompany ? '取消 IT 公司' : '設為 IT 公司'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={styles.note}>
          <strong>⚠️ 注意：</strong>取消所有公司的 IT 公司設定，將導致無人可以結案。請至少保留一家 IT 公司。
        </div>
      </main>
    </div>
  )
}

const styles = {
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
  navBtnHighlight: {
    background: 'rgba(99,102,241,0.3)', color: '#fff',
    border: '1px solid rgba(99,102,241,0.7)', borderRadius: 6,
    padding: '6px 12px', cursor: 'pointer', fontSize: 13
  },
  logoutBtn: { background: 'none', color: 'rgba(255,255,255,0.7)', border: 'none', cursor: 'pointer', fontSize: 13 },
  main: { maxWidth: 900, margin: '0 auto', padding: '24px 16px' },
  titleSection: { marginBottom: 24 },
  pageTitle: { fontSize: 22, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 },
  pageDesc: { fontSize: 14, color: '#666', lineHeight: 1.6, marginBottom: 12 },
  ldapBanner: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af',
    padding: '10px 14px', borderRadius: 8, fontSize: 13
  },
  ldapLink: {
    background: '#1a56db', color: '#fff', border: 'none', borderRadius: 5,
    padding: '3px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600
  },
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
  th: {
    padding: '12px 16px', textAlign: 'left', fontSize: 12,
    fontWeight: 600, color: '#555', borderBottom: '1px solid #eee'
  },
  row: {},
  td: { padding: '14px 16px', fontSize: 14, color: '#333', borderBottom: '1px solid #f0f0f0' },
  code: { background: '#f3f4f6', padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace', fontSize: 13 },
  badgeIt: {
    background: '#dcfce7', color: '#166534', padding: '4px 10px',
    borderRadius: 20, fontSize: 12, fontWeight: 600
  },
  badgeNormal: {
    background: '#f3f4f6', color: '#6b7280', padding: '4px 10px',
    borderRadius: 20, fontSize: 12
  },
  toggleBtn: {
    padding: '6px 14px', border: '1px solid', borderRadius: 6,
    cursor: 'pointer', fontSize: 13, fontWeight: 500
  },
  note: {
    background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e',
    padding: '12px 16px', borderRadius: 8, fontSize: 13, lineHeight: 1.6
  }
}
