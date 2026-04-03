import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTickets, assignTicket, batchAssign, getItStaff } from '../api/client.js'
import { useAuth } from '../hooks/useAuth.js'
import StatusBadge from '../components/StatusBadge.jsx'
import ExportButton from '../components/ExportButton.jsx'
import dayjs from 'dayjs'

const STATUSES = ['新建立', '處理中', '待使用者補充', '已解決', '已結案']

export default function AdminDashboard() {
  const [tickets, setTickets] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [keyword, setKeyword] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [itStaff, setItStaff] = useState([])
  const [assignModal, setAssignModal] = useState(null)
  const [assigneeId, setAssigneeId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const pageSize = 20

  useEffect(() => {
    getItStaff().then(setItStaff).catch(console.error)
  }, [])

  const fetchTickets = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getTickets({
        page, pageSize,
        status: status || undefined,
        keyword: keyword || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      })
      setTickets(data.items)
      setTotal(data.total)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [page, status, keyword, startDate, endDate])

  useEffect(() => { fetchTickets() }, [fetchTickets])

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === tickets.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(tickets.map(t => t.id)))
    }
  }

  const handleAssign = async (isBatch = false) => {
    if (!assigneeId) return
    setAssigning(true)
    try {
      if (isBatch) {
        await batchAssign(Array.from(selected), assigneeId)
        setSelected(new Set())
      } else if (assignModal) {
        await assignTicket(assignModal, assigneeId)
      }
      setAssignModal(null)
      setAssigneeId('')
      fetchTickets()
    } catch (err) {
      console.error(err)
    } finally {
      setAssigning(false)
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.logo}>GITP 管理後台</h1>
        <div style={styles.headerRight}>
          <span style={styles.userName}>{user?.name}</span>
          <ExportButton />
          <button onClick={() => navigate('/admin/users')} style={styles.navBtn}>人員管理</button>
          <button onClick={() => navigate('/admin/companies')} style={styles.navBtn}>公司管理</button>
          <button onClick={() => navigate('/admin/classification')} style={styles.navBtn}>🏷️ 分類設定</button>
          <button onClick={() => navigate('/admin/ldap')} style={styles.navBtn}>🔐 LDAP 設定</button>
          <button onClick={() => navigate('/admin/attachment-settings')} style={styles.navBtn}>📎 附件設定</button>
          <button onClick={() => navigate('/admin/stats')} style={{ ...styles.navBtn, background: 'rgba(59,130,246,0.25)', borderColor: 'rgba(59,130,246,0.6)' }}>📊 統計儀表板</button>
          <button onClick={() => navigate('/tickets')} style={styles.navBtn}>員工介面</button>
          <button onClick={logout} style={styles.logoutBtn}>登出</button>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.filterBar}>
          <select value={status} onChange={e => setStatus(e.target.value)} style={styles.select}>
            <option value="">全部狀態</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={styles.dateInput} />
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={styles.dateInput} />
          <input
            type="text" value={keyword} onChange={e => setKeyword(e.target.value)}
            placeholder="搜尋關鍵字..." style={styles.searchInput}
          />
          <button onClick={() => { setPage(1); fetchTickets() }} style={styles.searchBtn}>搜尋</button>
          <button onClick={() => {
            setStatus(''); setKeyword(''); setStartDate(''); setEndDate(''); setPage(1)
          }} style={styles.resetBtn}>清除</button>
        </div>

        {selected.size > 0 && (
          <div style={styles.batchBar}>
            <span>已選 {selected.size} 筆</span>
            <select
              value={assigneeId}
              onChange={e => setAssigneeId(e.target.value)}
              style={styles.select}
            >
              <option value="">選擇 IT 人員</option>
              {itStaff.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
              ))}
            </select>
            <button
              onClick={() => handleAssign(true)}
              disabled={!assigneeId || assigning}
              style={styles.batchAssignBtn}
            >
              {assigning ? '指派中...' : '批次指派'}
            </button>
            <button onClick={() => setSelected(new Set())} style={styles.cancelSelBtn}>取消選取</button>
          </div>
        )}

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                <th style={{ ...styles.th, width: 40 }}>
                  <input
                    type="checkbox"
                    checked={selected.size === tickets.length && tickets.length > 0}
                    onChange={toggleAll}
                  />
                </th>
                <th style={styles.th}>案件編號</th>
                <th style={styles.th}>主旨</th>
                <th style={styles.th}>狀態</th>
                <th style={styles.th}>公司</th>
                <th style={styles.th}>提報人</th>
                <th style={styles.th}>負責人</th>
                <th style={styles.th}>提報時間</th>
                <th style={styles.th}>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 30, color: '#888' }}>載入中...</td></tr>
              ) : tickets.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 30, color: '#888' }}>無符合條件的工單</td></tr>
              ) : tickets.map(t => (
                <tr key={t.id} style={styles.row}>
                  <td style={styles.td}>
                    <input
                      type="checkbox"
                      checked={selected.has(t.id)}
                      onChange={() => toggleSelect(t.id)}
                    />
                  </td>
                  <td style={styles.td}>
                    <span
                      style={styles.ticketLink}
                      onClick={() => navigate(`/tickets/${t.id}`)}
                    >{t.ticketNo}</span>
                  </td>
                  <td style={{ ...styles.td, maxWidth: 260 }}>
                    <span style={styles.subjectText}>{t.subject}</span>
                  </td>
                  <td style={styles.td}><StatusBadge status={t.status} /></td>
                  <td style={styles.td}>{t.companyName}</td>
                  <td style={styles.td}>{t.submitterName}</td>
                  <td style={styles.td}>{t.assigneeName || <span style={{ color: '#ccc' }}>未指派</span>}</td>
                  <td style={styles.td}>{dayjs(t.createdAt).format('MM/DD HH:mm')}</td>
                  <td style={styles.td}>
                    <button
                      onClick={() => { setAssignModal(t.id); setAssigneeId('') }}
                      style={styles.assignBtn}
                    >指派</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={styles.pagination}>
          <span style={styles.totalText}>共 {total} 筆</span>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            style={{ ...styles.pageBtn, opacity: page <= 1 ? 0.4 : 1 }}>上一頁</button>
          <span style={styles.pageInfo}>第 {page} / {totalPages || 1} 頁</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
            style={{ ...styles.pageBtn, opacity: page >= totalPages ? 0.4 : 1 }}>下一頁</button>
        </div>
      </main>

      {assignModal && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>指派工單</h3>
            <select
              value={assigneeId}
              onChange={e => setAssigneeId(e.target.value)}
              style={styles.modalSelect}
            >
              <option value="">請選擇 IT 人員</option>
              {itStaff.map(s => (
                <option key={s.id} value={s.id}>{s.name} - {s.role === 'it_admin' ? '管理員' : '處理人員'}</option>
              ))}
            </select>
            <div style={styles.modalActions}>
              <button
                onClick={() => handleAssign(false)}
                disabled={!assigneeId || assigning}
                style={{ ...styles.confirmBtn, opacity: (!assigneeId || assigning) ? 0.6 : 1 }}
              >
                {assigning ? '指派中...' : '確認指派'}
              </button>
              <button onClick={() => setAssignModal(null)} style={styles.cancelModalBtn}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  container: { minHeight: '100vh', background: '#f5f7fa' },
  header: {
    background: '#1a1a2e',
    color: '#fff',
    padding: '0 24px',
    height: 60,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  logo: { fontSize: 18, fontWeight: 700 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 12 },
  userName: { fontSize: 14, opacity: 0.8 },
  navBtn: {
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: 6,
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: 13
  },
  logoutBtn: { background: 'none', color: 'rgba(255,255,255,0.7)', border: 'none', cursor: 'pointer', fontSize: 13 },
  main: { maxWidth: 1400, margin: '0 auto', padding: '20px 16px' },
  filterBar: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 16,
    alignItems: 'center'
  },
  select: { padding: '7px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, background: '#fff' },
  dateInput: { padding: '7px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13 },
  searchInput: { padding: '7px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, flex: 1, minWidth: 150 },
  searchBtn: { padding: '7px 16px', background: '#1a56db', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
  resetBtn: { padding: '7px 12px', background: '#fff', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
  batchBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: '#e8f0fe',
    padding: '10px 16px',
    borderRadius: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
    fontSize: 14,
    color: '#1a56db',
    fontWeight: 600
  },
  batchAssignBtn: { padding: '6px 16px', background: '#1a56db', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  cancelSelBtn: { padding: '6px 12px', background: '#fff', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
  tableWrap: { background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#f8fafc' },
  th: { padding: '11px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#555', borderBottom: '1px solid #eee' },
  row: { transition: 'background 0.1s' },
  td: { padding: '11px 12px', fontSize: 13, color: '#333', borderBottom: '1px solid #f0f0f0', verticalAlign: 'middle' },
  ticketLink: { color: '#1a56db', cursor: 'pointer', fontFamily: 'monospace', fontWeight: 600, fontSize: 13 },
  subjectText: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' },
  assignBtn: { padding: '4px 12px', background: '#fff', border: '1px solid #1a56db', color: '#1a56db', borderRadius: 5, cursor: 'pointer', fontSize: 12 },
  pagination: { display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end', marginTop: 14 },
  totalText: { color: '#888', fontSize: 13, marginRight: 'auto' },
  pageBtn: { padding: '5px 14px', border: '1px solid #ddd', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13 },
  pageInfo: { fontSize: 13, color: '#555' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#fff', borderRadius: 12, padding: '28px 32px', width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  modalTitle: { fontSize: 17, fontWeight: 700, marginBottom: 16, color: '#1a1a1a' },
  modalSelect: { width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, marginBottom: 20 },
  modalActions: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
  confirmBtn: { padding: '8px 20px', background: '#1a56db', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 },
  cancelModalBtn: { padding: '8px 16px', background: '#fff', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer' }
}
