import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAdminUsers, updateUserRoles } from '../api/client.js'
import { useAuth } from '../hooks/useAuth.js'

const ALL_ROLES = [
  { key: 'it_admin',    label: '系統管理員',  desc: '可派工、接收新案通知、管理人員' },
  { key: 'it_assignee', label: 'IT 處理人員', desc: '執行被指派的工單、回覆案件' },
  { key: 'employee',    label: '一般員工',    desc: '提報問題、查詢所屬公司案件' },
]

const ROLE_COLOR = {
  it_admin:    { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  it_assignee: { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
  employee:    { bg: '#f0fdf4', color: '#166534', border: '#86efac' },
}

function parseRoles(rolesStr) {
  if (!rolesStr) return ['employee']
  return rolesStr.split(',').map(r => r.trim()).filter(Boolean)
}

export default function AdminUserManagement() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)       // { userId, roles: Set<string> }
  const [saving, setSaving] = useState(null)
  const [message, setMessage] = useState(null)
  const { user: currentUser, logout } = useAuth()
  const navigate = useNavigate()

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const data = await getAdminUsers()
      setUsers(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  const startEdit = (u) => {
    setEditing({ userId: u.id, roles: new Set(parseRoles(u.roles)) })
    setMessage(null)
  }

  const cancelEdit = () => setEditing(null)

  const toggleRole = (role) => {
    setEditing(prev => {
      const next = new Set(prev.roles)
      next.has(role) ? next.delete(role) : next.add(role)
      return { ...prev, roles: next }
    })
  }

  const saveRoles = async (u) => {
    const rolesList = Array.from(editing.roles)
    if (rolesList.length === 0) {
      setMessage({ type: 'error', text: '請至少選擇一個角色' })
      return
    }

    setSaving(u.id)
    setMessage(null)
    try {
      await updateUserRoles(u.id, rolesList)
      setUsers(prev => prev.map(x =>
        x.id === u.id ? { ...x, roles: rolesList.join(',') } : x
      ))
      setMessage({ type: 'success', text: `已更新「${u.name}」的角色` })
      setEditing(null)
    } catch (err) {
      const msg = err.response?.data?.message || '角色變更失敗，請稍後再試'
      setMessage({ type: 'error', text: msg })
    } finally {
      setSaving(null)
    }
  }

  const adminCount = users.filter(u => parseRoles(u.roles).includes('it_admin')).length

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.logo}>GITP 人員管理</h1>
        <div style={styles.headerRight}>
          <span style={styles.userName}>{currentUser?.name}</span>
          <button onClick={() => navigate('/admin')} style={styles.navBtn}>管理後台</button>
          <button onClick={() => navigate('/tickets')} style={styles.navBtn}>員工介面</button>
          <button onClick={logout} style={styles.logoutBtn}>登出</button>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.pageHeader}>
          <h2 style={styles.pageTitle}>IT 人員角色管理</h2>
          <p style={styles.pageDesc}>
            每位 IT 人員可同時擁有多個角色。點擊「編輯角色」後以勾選方式設定。
          </p>
        </div>

        {message && (
          <div style={{
            ...styles.alert,
            background: message.type === 'success' ? '#d1fae5' : '#fee2e2',
            borderColor: message.type === 'success' ? '#6ee7b7' : '#fca5a5',
            color: message.type === 'success' ? '#065f46' : '#991b1b'
          }}>
            {message.type === 'success' ? '✅' : '❌'} {message.text}
          </div>
        )}

        <div style={styles.statsRow}>
          <div style={styles.statCard}>
            <div style={styles.statNum}>{adminCount}</div>
            <div style={styles.statLabel}>系統管理員</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statNum}>{users.filter(u => parseRoles(u.roles).includes('it_assignee')).length}</div>
            <div style={styles.statLabel}>IT 處理人員</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statNum}>{users.length}</div>
            <div style={styles.statLabel}>IT 人員合計</div>
          </div>
        </div>

        <div style={styles.infoBox}>
          <strong>📧 通知規則：</strong>
          新工單提報時所有「系統管理員」收到 Email；工單指派後「IT 處理人員」收到 Email。
          一個人可同時擁有兩種 IT 角色，接收所有通知。
        </div>

        {loading ? (
          <div style={styles.loading}>載入中...</div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.thead}>
                  <th style={styles.th}>姓名</th>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>目前角色</th>
                  <th style={styles.th}>操作</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: 30, color: '#888' }}>無 IT 人員</td></tr>
                ) : users.map(u => {
                  const isSelf    = u.id === currentUser?.id
                  const userRoles = parseRoles(u.roles)
                  const isEditing = editing?.userId === u.id

                  return (
                    <tr key={u.id} style={styles.row}>
                      <td style={styles.td}>
                        <strong>{u.name}</strong>
                        {isSelf && <span style={styles.selfTag}> (自己)</span>}
                      </td>
                      <td style={styles.td}>{u.email}</td>
                      <td style={styles.td}>
                        {isEditing ? (
                          <div style={styles.checkboxGroup}>
                            {ALL_ROLES.map(r => (
                              <label key={r.key} style={styles.checkboxLabel}>
                                <input
                                  type="checkbox"
                                  checked={editing.roles.has(r.key)}
                                  onChange={() => toggleRole(r.key)}
                                  style={{ marginRight: 6 }}
                                />
                                <span style={{ fontWeight: 600 }}>{r.label}</span>
                                <span style={{ color: '#666', fontSize: 11, marginLeft: 4 }}>— {r.desc}</span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {userRoles.map(role => (
                              <span key={role} style={{ ...styles.roleBadge, ...(ROLE_COLOR[role] || {}) }}>
                                {ALL_ROLES.find(r => r.key === role)?.label || role}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={styles.td}>
                        {isSelf ? (
                          <span style={{ color: '#aaa', fontSize: 12 }}>不可更改自己</span>
                        ) : isEditing ? (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              onClick={() => saveRoles(u)}
                              disabled={saving === u.id}
                              style={{ ...styles.actionBtn, background: '#1a56db', color: '#fff', borderColor: '#1a56db' }}
                            >
                              {saving === u.id ? '儲存中...' : '✓ 儲存'}
                            </button>
                            <button onClick={cancelEdit} style={styles.actionBtn}>取消</button>
                          </div>
                        ) : (
                          <button onClick={() => startEdit(u)} style={styles.actionBtn}>
                            ✏️ 編輯角色
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
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
  logoutBtn: { background: 'none', color: 'rgba(255,255,255,0.7)', border: 'none', cursor: 'pointer', fontSize: 13 },
  main: { maxWidth: 1100, margin: '0 auto', padding: '28px 16px' },
  pageHeader: { marginBottom: 20 },
  pageTitle: { fontSize: 22, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 },
  pageDesc: { color: '#666', fontSize: 14, lineHeight: 1.6, maxWidth: 700 },
  alert: { padding: '12px 16px', borderRadius: 8, border: '1px solid', marginBottom: 16, fontSize: 14 },
  statsRow: { display: 'flex', gap: 16, marginBottom: 16 },
  statCard: {
    background: '#fff', borderRadius: 10, padding: '16px 24px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)', minWidth: 120, textAlign: 'center'
  },
  statNum: { fontSize: 28, fontWeight: 700, color: '#1a56db' },
  statLabel: { fontSize: 13, color: '#666', marginTop: 4 },
  infoBox: {
    background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8,
    padding: '12px 16px', fontSize: 13, color: '#1e40af', marginBottom: 20, lineHeight: 1.6
  },
  loading: { textAlign: 'center', padding: 40, color: '#888' },
  tableWrap: { background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#f8fafc' },
  th: { padding: '11px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#555', borderBottom: '1px solid #eee' },
  row: {},
  td: { padding: '12px 14px', fontSize: 13, color: '#333', borderBottom: '1px solid #f0f0f0', verticalAlign: 'top' },
  selfTag: { color: '#999', fontSize: 11 },
  roleBadge: {
    display: 'inline-block', padding: '3px 10px', borderRadius: 20,
    fontSize: 12, fontWeight: 600, border: '1px solid'
  },
  checkboxGroup: { display: 'flex', flexDirection: 'column', gap: 8 },
  checkboxLabel: { display: 'flex', alignItems: 'center', fontSize: 13, cursor: 'pointer' },
  actionBtn: {
    padding: '5px 14px', border: '1px solid #d1d5db', borderRadius: 6,
    cursor: 'pointer', fontSize: 12, fontWeight: 600, background: '#fff', color: '#374151'
  }
}
