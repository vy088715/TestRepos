import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTickets } from '../api/client.js'
import { useAuth } from '../hooks/useAuth.js'
import StatusBadge from '../components/StatusBadge.jsx'
import dayjs from 'dayjs'

const STATUSES = ['新建立', '處理中', '待使用者補充', '已解決', '已結案']

export default function TicketList() {
  const [tickets, setTickets] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [activeTab, setActiveTab] = useState('my')
  const [status, setStatus] = useState('')
  const [keyword, setKeyword] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const pageSize = 20

  const fetchTickets = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        page,
        pageSize,
        myTickets: activeTab === 'my',
        status: status || undefined,
        keyword: keyword || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      }
      const data = await getTickets(params)
      setTickets(data.items)
      setTotal(data.total)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [page, activeTab, status, keyword, startDate, endDate])

  useEffect(() => { fetchTickets() }, [fetchTickets])

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
    fetchTickets()
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.logo}>GITP</h1>
        <div style={styles.headerRight}>
          <span style={styles.userName}>{user?.name} · {user?.companyName}</span>
          <button onClick={() => navigate('/tickets/new')} style={styles.newBtn}>＋ 新增工單</button>
          {user?.role === 'it_admin' && (
            <button onClick={() => navigate('/admin')} style={styles.adminBtn}>管理後台</button>
          )}
          <button onClick={logout} style={styles.logoutBtn}>登出</button>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.tabs}>
          <button
            style={{ ...styles.tab, ...(activeTab === 'my' ? styles.activeTab : {}) }}
            onClick={() => { setActiveTab('my'); setPage(1) }}
          >我的案件</button>
          <button
            style={{ ...styles.tab, ...(activeTab === 'company' ? styles.activeTab : {}) }}
            onClick={() => { setActiveTab('company'); setPage(1) }}
          >公司案件</button>
        </div>

        <form onSubmit={handleSearch} style={styles.filterBar}>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            style={styles.select}
          >
            <option value="">全部狀態</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            style={styles.dateInput}
            placeholder="開始日期"
          />
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            style={styles.dateInput}
          />
          <input
            type="text"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            placeholder="搜尋關鍵字..."
            style={styles.searchInput}
          />
          <button type="submit" style={styles.searchBtn}>搜尋</button>
          <button type="button" style={styles.resetBtn} onClick={() => {
            setStatus(''); setKeyword(''); setStartDate(''); setEndDate(''); setPage(1)
          }}>清除</button>
        </form>

        {loading ? (
          <div style={styles.loading}>載入中...</div>
        ) : tickets.length === 0 ? (
          <div style={styles.empty}>
            <p>尚無工單</p>
            <button onClick={() => navigate('/tickets/new')} style={styles.newBtn}>建立第一個工單</button>
          </div>
        ) : (
          <>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.thead}>
                    <th style={styles.th}>案件編號</th>
                    <th style={styles.th}>主旨</th>
                    <th style={styles.th}>狀態</th>
                    <th style={styles.th}>公司</th>
                    <th style={styles.th}>提報人</th>
                    <th style={styles.th}>提報時間</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map(t => (
                    <tr
                      key={t.id}
                      style={styles.row}
                      onClick={() => navigate(`/tickets/${t.id}`)}
                    >
                      <td style={styles.td}>
                        <span style={styles.ticketNo}>{t.ticketNo}</span>
                      </td>
                      <td style={{ ...styles.td, maxWidth: 300 }}>
                        <span style={styles.subject}>{t.subject}</span>
                      </td>
                      <td style={styles.td}><StatusBadge status={t.status} /></td>
                      <td style={styles.td}>{t.companyName}</td>
                      <td style={styles.td}>{t.submitterName}</td>
                      <td style={styles.td}>{dayjs(t.createdAt).format('YYYY/MM/DD HH:mm')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={styles.pagination}>
              <span style={styles.totalText}>共 {total} 筆</span>
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                style={{ ...styles.pageBtn, opacity: page <= 1 ? 0.4 : 1 }}
              >上一頁</button>
              <span style={styles.pageInfo}>第 {page} / {totalPages} 頁</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                style={{ ...styles.pageBtn, opacity: page >= totalPages ? 0.4 : 1 }}
              >下一頁</button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

const styles = {
  container: { minHeight: '100vh', background: '#f5f7fa' },
  header: {
    background: '#1a56db',
    color: '#fff',
    padding: '0 24px',
    height: 60,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
  },
  logo: { fontSize: 22, fontWeight: 700, letterSpacing: 2 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 12 },
  userName: { fontSize: 14, opacity: 0.9 },
  newBtn: {
    background: '#fff',
    color: '#1a56db',
    border: 'none',
    borderRadius: 6,
    padding: '6px 14px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 14
  },
  adminBtn: {
    background: 'rgba(255,255,255,0.2)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.5)',
    borderRadius: 6,
    padding: '6px 14px',
    cursor: 'pointer',
    fontSize: 14
  },
  logoutBtn: {
    background: 'none',
    color: 'rgba(255,255,255,0.8)',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14
  },
  main: { maxWidth: 1200, margin: '0 auto', padding: '24px 16px' },
  tabs: { display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid #e5e7eb' },
  tab: {
    padding: '10px 24px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: 15,
    color: '#666',
    borderBottom: '2px solid transparent',
    marginBottom: -2
  },
  activeTab: { color: '#1a56db', borderBottomColor: '#1a56db', fontWeight: 600 },
  filterBar: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 20,
    alignItems: 'center'
  },
  select: {
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: 6,
    fontSize: 14,
    background: '#fff'
  },
  dateInput: {
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: 6,
    fontSize: 14
  },
  searchInput: {
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: 6,
    fontSize: 14,
    flex: 1,
    minWidth: 150
  },
  searchBtn: {
    padding: '8px 20px',
    background: '#1a56db',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600
  },
  resetBtn: {
    padding: '8px 16px',
    background: '#fff',
    border: '1px solid #ddd',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14
  },
  loading: { textAlign: 'center', padding: 40, color: '#666' },
  empty: { textAlign: 'center', padding: 60, color: '#999' },
  tableWrap: {
    background: '#fff',
    borderRadius: 10,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    overflow: 'hidden'
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#f8fafc' },
  th: {
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: 13,
    fontWeight: 600,
    color: '#555',
    borderBottom: '1px solid #eee'
  },
  row: {
    cursor: 'pointer',
    transition: 'background 0.1s',
    ':hover': { background: '#f0f4ff' }
  },
  td: {
    padding: '13px 16px',
    fontSize: 14,
    color: '#333',
    borderBottom: '1px solid #f0f0f0',
    verticalAlign: 'middle'
  },
  ticketNo: { fontFamily: 'monospace', fontWeight: 600, color: '#1a56db', fontSize: 13 },
  subject: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'block'
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    justifyContent: 'flex-end',
    marginTop: 16
  },
  totalText: { color: '#888', fontSize: 14, marginRight: 'auto' },
  pageBtn: {
    padding: '6px 16px',
    border: '1px solid #ddd',
    borderRadius: 6,
    background: '#fff',
    cursor: 'pointer',
    fontSize: 14
  },
  pageInfo: { fontSize: 14, color: '#555' }
}
