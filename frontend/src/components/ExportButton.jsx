import { useState } from 'react'
import { startExport, getExportStatus, getExportDownloadUrl } from '../api/client.js'

const STATUSES = ['新建立', '處理中', '待使用者補充', '已解決', '已結案']

export default function ExportButton() {
  const [showModal, setShowModal] = useState(false)
  const [companyId, setCompanyId] = useState('')
  const [status, setStatus] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState('')
  const [jobId, setJobId] = useState(null)

  const handleExport = async () => {
    setExporting(true)
    setProgress('建立匯出工作...')
    try {
      const job = await startExport({
        companyId: companyId || undefined,
        status: status || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      })
      setJobId(job.id)
      setProgress('處理中，請稍候...')
      pollStatus(job.id)
    } catch (err) {
      setProgress('匯出失敗：' + (err.response?.data?.error || '請稍後再試'))
      setExporting(false)
    }
  }

  const pollStatus = (id) => {
    const interval = setInterval(async () => {
      try {
        const job = await getExportStatus(id)
        if (job.status === 'completed') {
          clearInterval(interval)
          setProgress('匯出完成！')
          setExporting(false)
          const url = getExportDownloadUrl(id)
          window.open(url, '_blank')
          setTimeout(() => {
            setShowModal(false)
            setProgress('')
            setJobId(null)
          }, 2000)
        } else if (job.status === 'failed') {
          clearInterval(interval)
          setProgress('匯出失敗，請重試')
          setExporting(false)
        } else {
          setProgress('處理中...')
        }
      } catch {
        clearInterval(interval)
        setProgress('查詢狀態失敗')
        setExporting(false)
      }
    }, 2000)
  }

  return (
    <>
      <button onClick={() => setShowModal(true)} style={styles.exportBtn}>
        📊 匯出報表
      </button>

      {showModal && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={styles.title}>匯出工單報表</h3>
            <p style={styles.desc}>匯出為 Excel 格式，包含所有符合條件的工單</p>

            <div style={styles.form}>
              <div style={styles.field}>
                <label style={styles.label}>狀態篩選</label>
                <select value={status} onChange={e => setStatus(e.target.value)} style={styles.select}>
                  <option value="">全部狀態</option>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>開始日期</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={styles.input} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>結束日期</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={styles.input} />
              </div>
            </div>

            {progress && (
              <div style={styles.progress}>
                {exporting && <span style={styles.spinner}>⏳ </span>}
                {progress}
              </div>
            )}

            <div style={styles.actions}>
              {!exporting && (
                <button onClick={handleExport} style={styles.confirmBtn}>
                  開始匯出
                </button>
              )}
              <button
                onClick={() => {
                  if (!exporting) {
                    setShowModal(false)
                    setProgress('')
                    setJobId(null)
                  }
                }}
                disabled={exporting}
                style={{ ...styles.cancelBtn, opacity: exporting ? 0.5 : 1 }}
              >
                {progress && !exporting ? '關閉' : '取消'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const styles = {
  exportBtn: {
    background: 'rgba(255,255,255,0.15)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.4)',
    borderRadius: 6,
    padding: '6px 14px',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modal: {
    background: '#fff',
    borderRadius: 12,
    padding: '28px 32px',
    width: 400,
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
  },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 6, color: '#1a1a1a' },
  desc: { fontSize: 13, color: '#888', marginBottom: 20 },
  form: { display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 13, fontWeight: 600, color: '#444' },
  select: { padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14 },
  input: { padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14 },
  progress: {
    background: '#f0f9ff',
    border: '1px solid #bae6fd',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 14,
    color: '#0369a1',
    marginBottom: 16
  },
  spinner: { marginRight: 4 },
  actions: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
  confirmBtn: {
    padding: '8px 20px',
    background: '#1a56db',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 14
  },
  cancelBtn: {
    padding: '8px 16px',
    background: '#fff',
    border: '1px solid #ddd',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14
  }
}
