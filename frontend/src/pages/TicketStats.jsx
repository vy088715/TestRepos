import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTicketStats } from '../api/client.js'
import { useAuth } from '../hooks/useAuth.js'

const STATUS_LABELS = [
  { key: 'statusNew',            label: '新建立',       color: '#6366f1' },
  { key: 'statusProcessing',     label: '處理中',       color: '#3b82f6' },
  { key: 'statusPendingSupply',  label: '待補充',       color: '#f59e0b' },
  { key: 'statusPendingConfirm', label: '待確認',       color: '#8b5cf6' },
  { key: 'statusResolved',       label: '已解決',       color: '#10b981' },
  { key: 'statusClosed',         label: '已結案',       color: '#6b7280' },
]

function SummaryCard({ label, value, color, sub }) {
  return (
    <div style={{ ...cardStyle, borderTop: `4px solid ${color}` }}>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function StatusBar({ row }) {
  const total = row.total || 1
  return (
    <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', width: '100%', background: '#eee' }}>
      {STATUS_LABELS.map(s => {
        const val = row[s.key] || 0
        const pct = (val / total) * 100
        return pct > 0 ? (
          <div key={s.key} title={`${s.label}: ${val}`}
            style={{ width: `${pct}%`, background: s.color }} />
        ) : null
      })}
    </div>
  )
}

export default function TicketStats() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const now = new Date()
  const [period, setPeriod]   = useState('month')
  const [year, setYear]       = useState(now.getFullYear())
  const [month, setMonth]     = useState(now.getMonth() + 1)
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const fetchStats = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getTicketStats(period, year, period === 'month' ? month : undefined)
      setData(res)
    } catch (err) {
      setError(err.response?.data?.message || '載入失敗，請稍後再試')
    } finally {
      setLoading(false)
    }
  }, [period, year, month])

  useEffect(() => { fetchStats() }, [fetchStats])

  const summary = data?.summary || {}
  const byCompany = data?.byCompany || []
  const inProgress = (summary.statusNew || 0) + (summary.statusProcessing || 0)
    + (summary.statusPendingSupply || 0) + (summary.statusPendingConfirm || 0)
  const closureRate = summary.grandTotal
    ? Math.round(((summary.statusClosed || 0) / summary.grandTotal) * 100)
    : 0

  const periodLabel = period === 'month'
    ? `${year} 年 ${month} 月`
    : `${year} 年（全年）`

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      {/* Header */}
      <header style={headerStyle}>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>GITP 統計儀表板</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, opacity: 0.8 }}>{user?.name}</span>
          <button onClick={() => navigate('/admin')} style={navBtn}>管理後台</button>
          <button onClick={logout} style={{ background: 'none', color: 'rgba(255,255,255,0.7)', border: 'none', cursor: 'pointer', fontSize: 13 }}>登出</button>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
        {/* Period Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 600, fontSize: 16, color: '#1a1a2e' }}>查詢期間：</div>
          <select value={period} onChange={e => setPeriod(e.target.value)} style={selectStyle}>
            <option value="month">當月</option>
            <option value="year">當年</option>
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={selectStyle}>
            {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map(y => (
              <option key={y} value={y}>{y} 年</option>
            ))}
          </select>
          {period === 'month' && (
            <select value={month} onChange={e => setMonth(Number(e.target.value))} style={selectStyle}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{m} 月</option>
              ))}
            </select>
          )}
          <button onClick={fetchStats} disabled={loading} style={searchBtn}>
            {loading ? '載入中...' : '查詢'}
          </button>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '12px 16px', borderRadius: 8, marginBottom: 20 }}>
            {error}
          </div>
        )}

        {data && (
          <>
            <div style={{ fontSize: 14, color: '#888', marginBottom: 16 }}>
              統計範圍：{periodLabel}｜共 <strong>{summary.grandTotal || 0}</strong> 件問題
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14, marginBottom: 28 }}>
              <SummaryCard label="問題總數" value={summary.grandTotal || 0} color="#1a56db" />
              <SummaryCard label="處理中（合計）" value={inProgress} color="#f59e0b" />
              <SummaryCard label="已結案" value={summary.statusClosed || 0} color="#6b7280"
                sub={`結案率 ${closureRate}%`} />
              <SummaryCard label="新建立" value={summary.statusNew || 0} color="#6366f1" />
              <SummaryCard label="處理中" value={summary.statusProcessing || 0} color="#3b82f6" />
              <SummaryCard label="已解決" value={summary.statusResolved || 0} color="#10b981" />
            </div>

            {/* Per-Company Table */}
            <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', fontWeight: 700, fontSize: 15, color: '#1a1a2e' }}>
                各公司問題點統計
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={th}>公司名稱</th>
                      <th style={{ ...th, textAlign: 'center' }}>合計</th>
                      {STATUS_LABELS.map(s => (
                        <th key={s.key} style={{ ...th, textAlign: 'center', color: s.color }}>
                          {s.label}
                        </th>
                      ))}
                      <th style={{ ...th, textAlign: 'center' }}>處理中（合計）</th>
                      <th style={{ ...th, textAlign: 'center' }}>結案率</th>
                      <th style={{ ...th, minWidth: 120 }}>狀態分佈</th>
                      <th style={{ ...th, textAlign: 'center' }}>平均結案時數</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byCompany.length === 0 ? (
                      <tr>
                        <td colSpan={13} style={{ textAlign: 'center', padding: 30, color: '#aaa' }}>
                          此期間無任何問題提報
                        </td>
                      </tr>
                    ) : byCompany.map((row, idx) => {
                      const companyClosureRate = row.total
                        ? Math.round((row.statusClosed / row.total) * 100) : 0
                      const companyInProgress = row.inProgress
                        ?? (row.statusNew + row.statusProcessing + row.statusPendingSupply + row.statusPendingConfirm)
                      return (
                        <tr key={row.companyId} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                          <td style={{ ...td, fontWeight: 600 }}>{row.companyName}</td>
                          <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: '#1a56db' }}>{row.total}</td>
                          {STATUS_LABELS.map(s => (
                            <td key={s.key} style={{ ...td, textAlign: 'center', color: s.color, fontWeight: 500 }}>
                              {row[s.key] || 0}
                            </td>
                          ))}
                          <td style={{ ...td, textAlign: 'center', fontWeight: 600, color: '#f59e0b' }}>
                            {companyInProgress}
                          </td>
                          <td style={{ ...td, textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-block', padding: '2px 10px',
                              borderRadius: 12, fontSize: 12, fontWeight: 600,
                              background: companyClosureRate >= 80 ? '#d1fae5' : companyClosureRate >= 50 ? '#fef3c7' : '#fee2e2',
                              color: companyClosureRate >= 80 ? '#065f46' : companyClosureRate >= 50 ? '#92400e' : '#991b1b',
                            }}>
                              {companyClosureRate}%
                            </span>
                          </td>
                          <td style={{ ...td, minWidth: 120 }}>
                            <StatusBar row={row} />
                          </td>
                          <td style={{ ...td, textAlign: 'center', color: '#555' }}>
                            {row.avgCloseHours != null
                              ? `${Math.round(row.avgCloseHours)} 小時`
                              : <span style={{ color: '#ccc' }}>—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {byCompany.length > 1 && (
                    <tfoot>
                      <tr style={{ background: '#f0f4ff', fontWeight: 700 }}>
                        <td style={{ ...td }}>合計</td>
                        <td style={{ ...td, textAlign: 'center', color: '#1a56db' }}>{summary.grandTotal || 0}</td>
                        {STATUS_LABELS.map(s => (
                          <td key={s.key} style={{ ...td, textAlign: 'center', color: s.color }}>
                            {summary[s.key] || 0}
                          </td>
                        ))}
                        <td style={{ ...td, textAlign: 'center', color: '#f59e0b' }}>{inProgress}</td>
                        <td style={{ ...td, textAlign: 'center' }}>{closureRate}%</td>
                        <td style={td}></td>
                        <td style={td}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 16 }}>
              {STATUS_LABELS.map(s => (
                <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555' }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: s.color }} />
                  {s.label}
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────
const headerStyle = {
  background: '#1a1a2e', color: '#fff',
  padding: '0 24px', height: 60,
  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
}
const navBtn = {
  background: 'rgba(255,255,255,0.1)', color: '#fff',
  border: '1px solid rgba(255,255,255,0.3)',
  borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13
}
const selectStyle = {
  padding: '7px 10px', border: '1px solid #ddd', borderRadius: 6,
  fontSize: 13, background: '#fff'
}
const searchBtn = {
  padding: '7px 20px', background: '#1a56db', color: '#fff',
  border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600
}
const cardStyle = {
  background: '#fff', borderRadius: 10, padding: '16px 18px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)', textAlign: 'center'
}
const th = {
  padding: '11px 12px', textAlign: 'left', fontSize: 12,
  fontWeight: 600, color: '#555', borderBottom: '1px solid #eee', whiteSpace: 'nowrap'
}
const td = {
  padding: '11px 12px', fontSize: 13, color: '#333',
  borderBottom: '1px solid #f0f0f0', verticalAlign: 'middle'
}
