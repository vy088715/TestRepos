import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createTicket } from '../api/client.js'
import { uploadAttachment } from '../api/client.js'
import { useAuth } from '../hooks/useAuth.js'
import FileUpload from '../components/FileUpload.jsx'

export default function SubmitTicket() {
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(null)
  const [error, setError] = useState('')
  const { user } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!subject.trim() || !description.trim()) {
      setError('請填寫所有必填欄位')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const ticket = await createTicket({ subject, description })
      if (file) {
        await uploadAttachment(ticket.id, file)
      }
      setSuccess(ticket)
    } catch (err) {
      setError(err.response?.data?.error || '提交失敗，請稍後再試')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div style={styles.container}>
        <div style={styles.successCard}>
          <div style={styles.successIcon}>✓</div>
          <h2 style={styles.successTitle}>工單已成功建立！</h2>
          <p style={styles.ticketNo}>案件編號：<strong>{success.ticketNo}</strong></p>
          <p style={styles.successDesc}>IT 部門將盡快處理您的問題，您可在「我的案件」查看進度。</p>
          <div style={styles.successActions}>
            <button style={styles.primaryBtn} onClick={() => navigate(`/tickets/${success.id}`)}>
              查看案件詳情
            </button>
            <button style={styles.secondaryBtn} onClick={() => navigate('/tickets')}>
              返回案件列表
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <button onClick={() => navigate(-1)} style={styles.backBtn}>← 返回</button>
          <h2 style={styles.title}>提報 IT 問題</h2>
          <p style={styles.companyBadge}>{user?.companyName}</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>問題主旨 <span style={{ color: 'red' }}>*</span></label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="請簡述問題，例如：ERP 系統無法登入"
              maxLength={200}
              required
              style={styles.input}
            />
            <small style={styles.hint}>{subject.length}/200</small>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>問題說明 <span style={{ color: 'red' }}>*</span></label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="請詳細描述問題發生的情況、時間、錯誤訊息，以便 IT 人員快速診斷"
              rows={8}
              required
              style={styles.textarea}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>附件（選填）</label>
            <FileUpload onFileSelect={setFile} />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.actions}>
            <button type="button" onClick={() => navigate(-1)} style={styles.cancelBtn}>
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{ ...styles.submitBtn, opacity: submitting ? 0.7 : 1 }}
            >
              {submitting ? '提交中...' : '提交工單'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#f5f7fa',
    padding: '24px 16px',
    display: 'flex',
    justifyContent: 'center'
  },
  card: {
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
    width: '100%',
    maxWidth: 700,
    height: 'fit-content'
  },
  cardHeader: {
    padding: '24px 32px 20px',
    borderBottom: '1px solid #eee'
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#1a56db',
    cursor: 'pointer',
    fontSize: 14,
    padding: 0,
    marginBottom: 12
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: '#1a1a1a'
  },
  companyBadge: {
    display: 'inline-block',
    background: '#e8f0fe',
    color: '#1a56db',
    padding: '3px 10px',
    borderRadius: 20,
    fontSize: 13,
    marginTop: 6
  },
  form: {
    padding: '24px 32px 32px',
    display: 'flex',
    flexDirection: 'column',
    gap: 24
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6
  },
  label: {
    fontSize: 14,
    fontWeight: 600,
    color: '#333'
  },
  input: {
    padding: '10px 14px',
    border: '1px solid #ddd',
    borderRadius: 8,
    fontSize: 15,
    outline: 'none'
  },
  textarea: {
    padding: '10px 14px',
    border: '1px solid #ddd',
    borderRadius: 8,
    fontSize: 15,
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit'
  },
  hint: { color: '#999', fontSize: 12, textAlign: 'right' },
  error: {
    background: '#fff0f0',
    color: '#e53e3e',
    padding: '10px 14px',
    borderRadius: 8,
    fontSize: 14,
    border: '1px solid #feb2b2'
  },
  actions: { display: 'flex', gap: 12, justifyContent: 'flex-end' },
  cancelBtn: {
    padding: '10px 24px',
    border: '1px solid #ddd',
    borderRadius: 8,
    background: '#fff',
    cursor: 'pointer',
    fontSize: 15
  },
  submitBtn: {
    padding: '10px 32px',
    border: 'none',
    borderRadius: 8,
    background: '#1a56db',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 15,
    fontWeight: 600
  },
  successCard: {
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
    padding: '48px 40px',
    maxWidth: 500,
    width: '100%',
    textAlign: 'center'
  },
  successIcon: {
    width: 64,
    height: 64,
    background: '#38a169',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 28,
    color: '#fff',
    margin: '0 auto 20px'
  },
  successTitle: { fontSize: 22, fontWeight: 700, color: '#1a1a1a', marginBottom: 12 },
  ticketNo: { fontSize: 18, color: '#1a56db', marginBottom: 12 },
  successDesc: { color: '#666', marginBottom: 28, lineHeight: 1.6 },
  successActions: { display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' },
  primaryBtn: {
    padding: '10px 24px',
    background: '#1a56db',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 15,
    fontWeight: 600
  },
  secondaryBtn: {
    padding: '10px 24px',
    background: '#fff',
    color: '#1a56db',
    border: '1px solid #1a56db',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 15
  }
}
