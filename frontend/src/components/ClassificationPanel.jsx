import { useState, useEffect } from 'react'
import { getIssueTypes, getSystemsByCompany, getCompanies, setTicketClassification } from '../api/client'
import PriorityMatrix from './PriorityMatrix'

/**
 * ClassificationPanel
 * Shown inside TicketDetail for users with canClassify permission.
 * Lets them set: issue type, affected company, system (dependent on company), severity, urgency.
 */
export function ClassificationPanel({ ticket, onUpdated }) {
  const [issueTypes, setIssueTypes]   = useState([])
  const [companies,  setCompanies]    = useState([])
  const [systems,    setSystems]      = useState([])
  const [saving,     setSaving]       = useState(false)
  const [error,      setError]        = useState(null)

  const [form, setForm] = useState({
    issueTypeId:       ticket.issueTypeId       ?? '',
    affectedCompanyId: ticket.affectedCompanyId ?? '',
    systemId:          ticket.systemId          ?? '',
    severity:          ticket.severity          ?? null,
    urgency:           ticket.urgency           ?? null,
  })

  useEffect(() => {
    Promise.all([getIssueTypes(), getCompanies()]).then(([it, co]) => {
      setIssueTypes(it)
      setCompanies(co)
    })
  }, [])

  useEffect(() => {
    if (form.affectedCompanyId) {
      getSystemsByCompany(form.affectedCompanyId).then(setSystems)
    } else {
      setSystems([])
      setForm(f => ({ ...f, systemId: '' }))
    }
  }, [form.affectedCompanyId])

  const handleCompanyChange = (companyId) => {
    setForm(f => ({ ...f, affectedCompanyId: companyId, systemId: '' }))
  }

  const handleMatrixSelect = (s, u) => {
    setForm(f => ({ ...f, severity: s, urgency: u }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const payload = {
        issueTypeId:       form.issueTypeId       || null,
        affectedCompanyId: form.affectedCompanyId || null,
        systemId:          form.systemId          || null,
        severity:          form.severity          || null,
        urgency:           form.urgency           || null,
      }
      const result = await setTicketClassification(ticket.id, payload)
      onUpdated && onUpdated(result.ticket)
    } catch (e) {
      setError(e?.response?.data?.message ?? '儲存失敗，請稍後再試')
    } finally {
      setSaving(false)
    }
  }

  const PRIORITY_LABELS = { 1: 'P1 緊急', 2: 'P2 高', 3: 'P3 一般' }
  const currentPriority = form.severity && form.urgency
    ? Math.ceil((form.severity + form.urgency - 1) / 2)
    : null

  return (
    <div style={{
      border: '1px solid #dee2e6', borderRadius: 8,
      padding: 16, marginTop: 16, background: '#fff'
    }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, color: '#212529' }}>
        🏷️ 問題分類設定
      </div>

      {/* Row 1: Issue Type */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 12, color: '#495057', marginBottom: 4 }}>
          問題類型
        </label>
        <select
          value={form.issueTypeId}
          onChange={e => setForm(f => ({ ...f, issueTypeId: e.target.value }))}
          style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid #ced4da', fontSize: 14 }}
        >
          <option value="">— 未設定 —</option>
          {issueTypes.map(it => (
            <option key={it.id} value={it.id}>{it.name}</option>
          ))}
        </select>
      </div>

      {/* Row 2: Affected Company */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 12, color: '#495057', marginBottom: 4 }}>
          問題所屬公司別
        </label>
        <select
          value={form.affectedCompanyId}
          onChange={e => handleCompanyChange(e.target.value)}
          style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid #ced4da', fontSize: 14 }}
        >
          <option value="">— 未設定 —</option>
          {companies.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Row 3: System (depends on company) */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, color: '#495057', marginBottom: 4 }}>
          系統別 {!form.affectedCompanyId && <span style={{ color: '#adb5bd' }}>(請先選擇公司別)</span>}
        </label>
        <select
          value={form.systemId}
          onChange={e => setForm(f => ({ ...f, systemId: e.target.value }))}
          disabled={!form.affectedCompanyId || systems.length === 0}
          style={{
            width: '100%', padding: '6px 10px', borderRadius: 4,
            border: '1px solid #ced4da', fontSize: 14,
            background: !form.affectedCompanyId ? '#f8f9fa' : '#fff'
          }}
        >
          <option value="">— 未設定 —</option>
          {systems.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Row 4: Severity × Urgency Matrix */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, color: '#495057', marginBottom: 8 }}>
          嚴重度 × 緊急度（點選方格設定）
          {currentPriority && (
            <span style={{
              marginLeft: 8, fontSize: 12, fontWeight: 700,
              color: ['','#dc3545','#fd7e14','#20c997'][currentPriority]
            }}>
              目前等級：{PRIORITY_LABELS[currentPriority]}
            </span>
          )}
        </label>
        <PriorityMatrix
          severity={form.severity}
          urgency={form.urgency}
          onSelect={handleMatrixSelect}
        />
        {form.severity && form.urgency && (
          <div style={{ marginTop: 6, fontSize: 12, color: '#6c757d' }}>
            已選：嚴重度 {form.severity} × 緊急度 {form.urgency}
            <button
              onClick={() => setForm(f => ({ ...f, severity: null, urgency: null }))}
              style={{
                marginLeft: 8, background: 'none', border: 'none',
                color: '#adb5bd', cursor: 'pointer', fontSize: 11, textDecoration: 'underline'
              }}
            >清除</button>
          </div>
        )}
      </div>

      {error && (
        <div style={{ color: '#dc3545', fontSize: 13, marginBottom: 10 }}>{error}</div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          background: '#0d6efd', color: '#fff', border: 'none',
          borderRadius: 4, padding: '8px 20px', cursor: 'pointer', fontWeight: 600
        }}
      >
        {saving ? '儲存中…' : '儲存分類設定'}
      </button>
    </div>
  )
}

export default ClassificationPanel
