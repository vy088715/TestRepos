import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getTicket, updateStatus, assignTicket, transferTicket,
  getHandlerHistory, getMessages, addMessage, getItStaff
} from '../api/client'
import { useAuth } from '../hooks/useAuth'
import ClassificationPanel from '../components/ClassificationPanel'
import PriorityMatrix from '../components/PriorityMatrix'

const STATUS_LABELS = {
  '新建立':      { label: '新建立',      color: '#6c757d' },
  '處理中':      { label: '處理中',      color: '#0d6efd' },
  '待使用者補充': { label: '待補充資訊',  color: '#fd7e14' },
  '待使用者確認': { label: '待提報人確認', color: '#6610f2' },
  '已解決':      { label: '已解決',      color: '#198754' },
  '已結案':      { label: '已結案',      color: '#495057' },
}

function StatusBadge({ status }) {
  const s = STATUS_LABELS[status] || { label: status, color: '#6c757d' }
  return (
    <span style={{
      background: s.color, color: '#fff', borderRadius: 4,
      padding: '2px 8px', fontSize: 12, fontWeight: 600
    }}>{s.label}</span>
  )
}

function HandlerHistory({ history }) {
  if (!history || history.length === 0) return null
  return (
    <div style={{ marginTop: 16, padding: 12, background: '#f8f9fa', borderRadius: 6 }}>
      <strong style={{ fontSize: 13 }}>處理人員經歷</strong>
      <div style={{ marginTop: 8 }}>
        {history.map((h, i) => (
          <div key={h.id} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', background: h.releasedAt ? '#adb5bd' : '#0d6efd',
              marginTop: 6, marginRight: 10, flexShrink: 0
            }} />
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{h.handlerName}</span>
              <span style={{
                fontSize: 11, background: '#e9ecef', borderRadius: 3,
                padding: '1px 5px', marginLeft: 6
              }}>{h.actionType}</span>
              <div style={{ fontSize: 11, color: '#6c757d', marginTop: 2 }}>
                由 {h.assignedByName} 指定 · {new Date(h.assignedAt).toLocaleString('zh-TW')}
                {h.releasedAt && ` ~ ${new Date(h.releasedAt).toLocaleString('zh-TW')}`}
              </div>
              {h.note && (
                <div style={{ fontSize: 12, color: '#495057', marginTop: 2, fontStyle: 'italic' }}>
                  備註：{h.note}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MessageTimeline({ messages }) {
  return (
    <div style={{ marginTop: 12 }}>
      {messages.map(m => {
        const isSystem = m.messageType === 'system'
        if (isSystem) {
          return (
            <div key={m.id} style={{ textAlign: 'center', margin: '8px 0' }}>
              <span style={{
                fontSize: 11, color: '#6c757d', background: '#e9ecef',
                borderRadius: 10, padding: '2px 10px'
              }}>{m.content}</span>
            </div>
          )
        }
        return (
          <div key={m.id} style={{
            display: 'flex', justifyContent: m.isItReply ? 'flex-end' : 'flex-start',
            marginBottom: 10
          }}>
            <div style={{
              maxWidth: '70%', background: m.isItReply ? '#d1e7ff' : '#f8f9fa',
              borderRadius: 8, padding: '8px 12px',
              border: '1px solid ' + (m.isItReply ? '#9ecef9' : '#dee2e6')
            }}>
              <div style={{ fontSize: 11, color: '#6c757d', marginBottom: 4 }}>
                {m.authorName} · {new Date(m.createdAt).toLocaleString('zh-TW')}
                {m.isItReply && <span style={{ marginLeft: 4, color: '#0d6efd' }}>IT</span>}
              </div>
              <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{m.content}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function TicketDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isItStaff = user?.roles?.includes('it_admin') || user?.roles?.includes('it_assignee')
  const isItAdmin = user?.roles?.includes('it_admin')
  const isItCompany = user?.isItCompany === true
  const canClose = isItCompany
  const canClassify = isItAdmin || (isItStaff && isItCompany)

  const [ticket, setTicket] = useState(null)
  const [messages, setMessages] = useState([])
  const [attachments, setAttachments] = useState([])
  const [handlerHistory, setHandlerHistory] = useState([])
  const [itStaff, setItStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Reply form
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)

  // Transfer form
  const [showTransfer, setShowTransfer] = useState(false)
  const [transferTo, setTransferTo] = useState('')
  const [transferNote, setTransferNote] = useState('')
  const [transferring, setTransferring] = useState(false)

  // Assign form (admin only)
  const [showAssign, setShowAssign] = useState(false)
  const [assignTo, setAssignTo] = useState('')
  const [assigning, setAssigning] = useState(false)

  useEffect(() => {
    loadAll()
    if (isItStaff) loadHistory()
  }, [id])

  async function loadAll() {
    try {
      setLoading(true)
      const [data, staff] = await Promise.all([
        getTicket(id),
        isItStaff ? getItStaff() : Promise.resolve([])
      ])
      setTicket(data.ticket)
      setMessages(data.messages || [])
      setAttachments(data.attachments || [])
      setItStaff(staff)
    } catch (e) {
      setError('載入失敗：' + (e.response?.data?.message || e.message))
    } finally {
      setLoading(false)
    }
  }

  async function loadHistory() {
    try {
      const h = await getHandlerHistory(id)
      setHandlerHistory(h)
    } catch {}
  }

  async function handleReply(e) {
    e.preventDefault()
    if (!replyText.trim()) return
    setReplying(true)
    try {
      const msg = await addMessage(id, replyText)
      setMessages(prev => [...prev, msg])
      setReplyText('')
    } catch (e) {
      alert('回覆失敗：' + (e.response?.data?.message || e.message))
    } finally {
      setReplying(false)
    }
  }

  async function handleStatusChange(newStatus) {
    try {
      const res = await updateStatus(id, newStatus)
      setTicket(res.ticket)
      setMessages(res.messages || [])
    } catch (e) {
      alert('狀態更新失敗：' + (e.response?.data?.message || e.message))
    }
  }

  async function handleAssign(e) {
    e.preventDefault()
    if (!assignTo) return
    setAssigning(true)
    try {
      const res = await assignTicket(id, assignTo)
      setTicket(res.ticket)
      setMessages(res.messages || [])
      setShowAssign(false)
      setAssignTo('')
      loadHistory()
    } catch (e) {
      alert('指派失敗：' + (e.response?.data?.message || e.message))
    } finally {
      setAssigning(false)
    }
  }

  async function handleTransfer(e) {
    e.preventDefault()
    if (!transferTo) return
    setTransferring(true)
    try {
      const res = await transferTicket(id, transferTo, transferNote || null)
      setTicket(res.ticket)
      setMessages(res.messages || [])
      setShowTransfer(false)
      setTransferTo('')
      setTransferNote('')
      loadHistory()
    } catch (e) {
      alert('轉派失敗：' + (e.response?.data?.message || e.message))
    } finally {
      setTransferring(false)
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>載入中...</div>
  if (error) return <div style={{ padding: 40, color: 'red' }}>{error}</div>
  if (!ticket) return <div style={{ padding: 40 }}>案件不存在</div>

  const isSubmitter = user?.id === ticket.submitterId
  const isClosed = ticket.status === '已結案'
  const currentAssigneeId = ticket.assigneeId

  // Determine available status actions
  const statusActions = []
  if (isItStaff && !isClosed) {
    if (ticket.status === '處理中') {
      statusActions.push({ label: '要求補充資訊', status: '待使用者補充', color: '#fd7e14' })
      statusActions.push({ label: '請提報人確認', status: '待使用者確認', color: '#6610f2' })
      statusActions.push({ label: '標記已解決', status: '已解決', color: '#198754' })
    }
    if (ticket.status === '待使用者補充') {
      statusActions.push({ label: '重啟處理中', status: '處理中', color: '#0d6efd' })
    }
    if (ticket.status === '待使用者確認') {
      statusActions.push({ label: '重啟處理中', status: '處理中', color: '#0d6efd' })
    }
    if (ticket.status === '已解決' && canClose) {
      statusActions.push({ label: '結案', status: '已結案', color: '#495057' })
    }
  }
  if (!isItStaff && isSubmitter && !isClosed) {
    if (ticket.status === '待使用者補充') {
      statusActions.push({ label: '已補充，繼續處理', status: '處理中', color: '#0d6efd' })
    }
    if (ticket.status === '待使用者確認') {
      // Only IT company users can close; non-IT users can reject resolution
      if (canClose) {
        statusActions.push({ label: '確認解決，結案', status: '已結案', color: '#198754' })
      }
      statusActions.push({ label: '問題仍未解決', status: '處理中', color: '#dc3545' })
    }
    if (ticket.status === '已解決' && canClose) {
      statusActions.push({ label: '確認結案', status: '已結案', color: '#198754' })
    }
  }

  const transferableStaff = itStaff.filter(s => s.id !== currentAssigneeId)

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      {/* Back button */}
      <button onClick={() => navigate(-1)} style={{ marginBottom: 16, cursor: 'pointer', background: 'none', border: 'none', color: '#0d6efd', fontSize: 14 }}>
        ← 返回
      </button>

      {/* Ticket header */}
      <div style={{ background: '#fff', border: '1px solid #dee2e6', borderRadius: 8, padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 12, color: '#6c757d', marginBottom: 4 }}>{ticket.ticketNo} · {ticket.companyName}</div>
            <h2 style={{ margin: 0, fontSize: 20 }}>{ticket.subject}</h2>
          </div>
          <StatusBadge status={ticket.status} />
        </div>
        <div style={{ marginTop: 12, fontSize: 14, color: '#495057', whiteSpace: 'pre-wrap' }}>
          {ticket.description}
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: '#6c757d', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span>提報人：{ticket.submitterName}</span>
          <span>負責人：{ticket.assigneeName || '未指派'}</span>
          <span>提報時間：{new Date(ticket.createdAt).toLocaleString('zh-TW')}</span>
        </div>

        {/* Handler history */}
        {isItStaff && <HandlerHistory history={handlerHistory} />}

        {/* Classification info (read-only display) */}
        {(ticket.issueTypeName || ticket.affectedCompanyName || ticket.systemName || ticket.severity) && (
          <div style={{
            marginTop: 12, padding: 10, background: '#f8f9fa',
            borderRadius: 6, fontSize: 13, color: '#495057',
            display: 'flex', flexWrap: 'wrap', gap: 12
          }}>
            {ticket.issueTypeName && (
              <span>🏷️ <strong>類型：</strong>{ticket.issueTypeName}</span>
            )}
            {ticket.affectedCompanyName && (
              <span>🏢 <strong>公司別：</strong>{ticket.affectedCompanyName}</span>
            )}
            {ticket.systemName && (
              <span>💻 <strong>系統別：</strong>{ticket.systemName}</span>
            )}
            {ticket.severity && ticket.urgency && (
              <span>⚠️ <strong>優先等級：</strong>
                <span style={{
                  fontWeight: 700,
                  color: ['','#dc3545','#fd7e14','#20c997'][ticket.priorityLevel || Math.ceil((ticket.severity + ticket.urgency - 1) / 2)]
                }}>
                  P{ticket.priorityLevel || Math.ceil((ticket.severity + ticket.urgency - 1) / 2)}
                </span>
                {' '}（嚴重度{ticket.severity} × 緊急度{ticket.urgency}）
              </span>
            )}
          </div>
        )}

        {/* Action buttons */}
        {!isClosed && (
          <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Status actions */}
            {statusActions.map(a => (
              <button key={a.status} onClick={() => handleStatusChange(a.status)} style={{
                background: a.color, color: '#fff', border: 'none', borderRadius: 4,
                padding: '6px 14px', cursor: 'pointer', fontSize: 13
              }}>{a.label}</button>
            ))}
            {/* Remind non-IT-company users they cannot close */}
            {!canClose && isItStaff && ['已解決', '待使用者確認'].includes(ticket.status) && (
              <span style={{ fontSize: 12, color: '#92400e', background: '#fffbeb',
                border: '1px solid #fde68a', borderRadius: 4, padding: '4px 8px' }}>
                ⚠️ 只有 IT 公司人員可結案
              </span>
            )}

            {/* Assign (admin only) */}
            {isItAdmin && ticket.status === '新建立' && (
              <button onClick={() => setShowAssign(!showAssign)} style={{
                background: '#0d6efd', color: '#fff', border: 'none', borderRadius: 4,
                padding: '6px 14px', cursor: 'pointer', fontSize: 13
              }}>指派處理人員</button>
            )}

            {/* Transfer (IT staff) */}
            {isItStaff && ticket.status !== '新建立' && transferableStaff.length > 0 && (
              <button onClick={() => setShowTransfer(!showTransfer)} style={{
                background: '#6f42c1', color: '#fff', border: 'none', borderRadius: 4,
                padding: '6px 14px', cursor: 'pointer', fontSize: 13
              }}>轉派處理人員</button>
            )}
          </div>
        )}

        {/* Assign form */}
        {showAssign && (
          <form onSubmit={handleAssign} style={{
            marginTop: 12, padding: 12, background: '#e7f5ff',
            borderRadius: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap'
          }}>
            <select value={assignTo} onChange={e => setAssignTo(e.target.value)} style={{ padding: '4px 8px', fontSize: 13, flex: 1 }}>
              <option value="">選擇處理人員...</option>
              {itStaff.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
              ))}
            </select>
            <button type="submit" disabled={assigning || !assignTo} style={{
              background: '#0d6efd', color: '#fff', border: 'none', borderRadius: 4,
              padding: '4px 12px', cursor: 'pointer', fontSize: 13
            }}>{assigning ? '指派中...' : '確認指派'}</button>
            <button type="button" onClick={() => setShowAssign(false)} style={{
              background: '#6c757d', color: '#fff', border: 'none', borderRadius: 4,
              padding: '4px 12px', cursor: 'pointer', fontSize: 13
            }}>取消</button>
          </form>
        )}

        {/* Transfer form */}
        {showTransfer && (
          <form onSubmit={handleTransfer} style={{
            marginTop: 12, padding: 12, background: '#f3e8ff',
            borderRadius: 6, display: 'flex', gap: 8, flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={transferTo} onChange={e => setTransferTo(e.target.value)} style={{ padding: '4px 8px', fontSize: 13, flex: 1 }}>
                <option value="">選擇轉派對象...</option>
                {transferableStaff.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                ))}
              </select>
            </div>
            <input
              type="text"
              placeholder="轉派備註（選填）"
              value={transferNote}
              onChange={e => setTransferNote(e.target.value)}
              style={{ padding: '4px 8px', fontSize: 13, borderRadius: 4, border: '1px solid #dee2e6' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={transferring || !transferTo} style={{
                background: '#6f42c1', color: '#fff', border: 'none', borderRadius: 4,
                padding: '4px 12px', cursor: 'pointer', fontSize: 13
              }}>{transferring ? '轉派中...' : '確認轉派'}</button>
              <button type="button" onClick={() => setShowTransfer(false)} style={{
                background: '#6c757d', color: '#fff', border: 'none', borderRadius: 4,
                padding: '4px 12px', cursor: 'pointer', fontSize: 13
              }}>取消</button>
            </div>
          </form>
        )}
      </div>

      {/* Messages */}
      <div style={{ background: '#fff', border: '1px solid #dee2e6', borderRadius: 8, padding: 20 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>對話紀錄</h3>
        <MessageTimeline messages={messages} />

        {/* Reply form */}
        {!isClosed && (
          <form onSubmit={handleReply} style={{ marginTop: 16 }}>
            <textarea
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder="輸入回覆訊息..."
              rows={3}
              style={{
                width: '100%', padding: 8, fontSize: 14, borderRadius: 4,
                border: '1px solid #dee2e6', resize: 'vertical', boxSizing: 'border-box'
              }}
            />
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" disabled={replying || !replyText.trim()} style={{
                background: '#0d6efd', color: '#fff', border: 'none', borderRadius: 4,
                padding: '6px 16px', cursor: 'pointer', fontSize: 14
              }}>{replying ? '送出中...' : '送出回覆'}</button>
            </div>
          </form>
        )}
      </div>

      {/* Attachments */}
      {attachments.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #dee2e6', borderRadius: 8, padding: 20, marginTop: 16 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>附件</h3>
          {attachments.map(a => (
            <div key={a.id} style={{ fontSize: 13, padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
              {a.filename} <span style={{ color: '#6c757d' }}>({Math.round(a.sizeBytes / 1024)} KB)</span>
            </div>
          ))}
        </div>
      )}

      {/* Classification Panel (only for authorized users) */}
      {canClassify && !isClosed && (
        <ClassificationPanel
          ticket={ticket}
          onUpdated={(updated) => setTicket(updated)}
        />
      )}
    </div>
  )
}
