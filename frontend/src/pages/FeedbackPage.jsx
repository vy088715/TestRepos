import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getFeedback, submitFeedback } from '../api/client.js'

export default function FeedbackPage() {
  const { token, action } = useParams()

  const [feedback, setFeedback] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadFeedback()
    // 若 URL 帶有 action (satisfied / unsatisfied)，自動提交
    if (action === 'satisfied' || action === 'unsatisfied') {
      handleAutoSubmit(action)
    }
  }, [token])

  async function loadFeedback() {
    try {
      const data = await getFeedback(token)
      setFeedback(data)
    } catch {
      setError('回饋連結無效或已失效。')
    } finally {
      setLoading(false)
    }
  }

  async function handleAutoSubmit(act) {
    setSubmitting(true)
    try {
      const res = await submitFeedback(token, act)
      setResult(res)
      setFeedback(res.feedback)
    } catch (e) {
      const msg = e?.response?.data?.message || '提交失敗，請稍後再試。'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmit(act) {
    setSubmitting(true)
    try {
      const res = await submitFeedback(token, act)
      setResult(res)
      setFeedback(res.feedback)
    } catch (e) {
      const msg = e?.response?.data?.message || '提交失敗，請稍後再試。'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || submitting) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.logo}>🦞 GITP</div>
          <p style={{ color: '#6b7280', textAlign: 'center' }}>
            {submitting ? '正在提交回饋…' : '載入中…'}
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.logo}>🦞 GITP</div>
          <div style={{ ...styles.banner, background: '#fef2f2', borderColor: '#fca5a5', color: '#991b1b' }}>
            ⚠️ {error}
          </div>
        </div>
      </div>
    )
  }

  // 已回覆過
  if (feedback?.result) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.logo}>🦞 GITP</div>
          <h2 style={styles.title}>滿意度回饋</h2>
          <div style={styles.ticketInfo}>
            <p><strong>案件編號：</strong>{feedback.ticketNo}</p>
            <p><strong>主旨：</strong>{feedback.subject}</p>
          </div>

          {feedback.result === 'satisfied' ? (
            <div style={{ ...styles.banner, background: '#f0fdf4', borderColor: '#86efac', color: '#166534' }}>
              ✅ 您已回覆「<strong>滿意</strong>」，感謝您的回饋！
            </div>
          ) : (
            <div style={{ ...styles.banner, background: '#fff7ed', borderColor: '#fdba74', color: '#9a3412' }}>
              ❌ 您已回覆「<strong>不滿意</strong>」。
              {feedback.followUpTicketId && (
                <p style={{ marginTop: 8 }}>
                  系統已自動建立追蹤案件 <strong>{result?.feedback?.followUpTicketNo || '（請至系統查詢）'}</strong>，IT 人員將重新處理。
                </p>
              )}
            </div>
          )}

          <p style={{ color: '#9ca3af', fontSize: 12, textAlign: 'center', marginTop: 16 }}>
            此回饋連結已失效，感謝您的參與。
          </p>
        </div>
      </div>
    )
  }

  // 等待回覆（未帶 action 的情況下，顯示選擇按鈕）
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>🦞 GITP</div>
        <h2 style={styles.title}>案件結案通知</h2>

        <div style={styles.ticketInfo}>
          <p><strong>案件編號：</strong>{feedback?.ticketNo}</p>
          <p><strong>主旨：</strong>{feedback?.subject}</p>
          <p><strong>提報人：</strong>{feedback?.submitterName}</p>
        </div>

        <p style={{ textAlign: 'center', color: '#374151', marginBottom: 24 }}>
          您的案件已正式結案，請問您對本次 IT 處理結果感到滿意嗎？
        </p>

        <div style={styles.buttonRow}>
          <button
            style={{ ...styles.btn, background: '#22c55e' }}
            disabled={submitting}
            onClick={() => handleSubmit('satisfied')}
          >
            ✅ 滿意
          </button>
          <button
            style={{ ...styles.btn, background: '#ef4444' }}
            disabled={submitting}
            onClick={() => handleSubmit('unsatisfied')}
          >
            ❌ 不滿意
          </button>
        </div>

        <p style={{ color: '#9ca3af', fontSize: 12, textAlign: 'center', marginTop: 16 }}>
          若選擇「不滿意」，系統將自動建立追蹤案件並通知 IT 人員重新處理。
        </p>
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#f3f4f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    background: '#fff',
    borderRadius: 12,
    padding: '32px 40px',
    maxWidth: 480,
    width: '100%',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
  },
  logo: {
    fontSize: 28,
    textAlign: 'center',
    marginBottom: 8,
  },
  title: {
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 700,
    color: '#111827',
    marginBottom: 20,
  },
  ticketInfo: {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: '12px 16px',
    marginBottom: 20,
    fontSize: 14,
    lineHeight: 1.8,
  },
  banner: {
    border: '1px solid',
    borderRadius: 8,
    padding: '12px 16px',
    marginBottom: 16,
    fontSize: 14,
    lineHeight: 1.6,
  },
  buttonRow: {
    display: 'flex',
    gap: 16,
    justifyContent: 'center',
  },
  btn: {
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '12px 32px',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
    minWidth: 120,
  },
}
