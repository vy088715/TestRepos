import { useState, useEffect, useRef } from 'react'
import { getAttachmentSettings } from '../api/client.js'

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

export default function FileUpload({ onFileSelect }) {
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [settings, setSettings] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    getAttachmentSettings().then(s => setSettings(s)).catch(() => {
      // fallback defaults if API fails
      setSettings({
        uploadEnabled: true,
        allowedExtensions: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.bmp,.zip',
        allowedMimeTypes: '',
        maxFileSizeBytes: 20971520
      })
    })
  }, [])

  const extList = settings
    ? settings.allowedExtensions.split(',').map(e => e.trim()).filter(Boolean)
    : []

  const validateFile = (f) => {
    if (!settings) return '設定載入中，請稍候'
    if (!settings.uploadEnabled) return '系統目前不開放附件上傳'
    if (f.size > settings.maxFileSizeBytes)
      return `檔案過大，最大允許 ${formatSize(settings.maxFileSizeBytes)}（目前：${formatSize(f.size)}）`
    const ext = '.' + f.name.split('.').pop().toLowerCase()
    if (extList.length > 0 && !extList.includes(ext))
      return `不支援的檔案類型：${ext}`
    return null
  }

  const handleFile = (f) => {
    if (!f) return
    setError('')
    const err = validateFile(f)
    if (err) { setError(err); return }
    setFile(f)
    onFileSelect(f)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) handleFile(dropped)
  }

  const handleRemove = () => {
    setFile(null)
    setError('')
    onFileSelect(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  if (settings && !settings.uploadEnabled) {
    return (
      <div style={styles.disabledBox}>
        🚫 系統目前不開放附件上傳
      </div>
    )
  }

  const hintText = settings
    ? `支援：${extList.join(', ')}（最大 ${formatSize(settings.maxFileSizeBytes)}）`
    : '載入中...'

  return (
    <div>
      {!file ? (
        <div
          style={{ ...styles.dropZone, ...(dragging ? styles.dragging : {}) }}
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onClick={() => inputRef.current?.click()}
        >
          <span style={styles.uploadIcon}>📁</span>
          <p style={styles.dropText}>點擊選擇或拖曳檔案至此</p>
          <p style={styles.hintText}>{hintText}</p>
          <input
            ref={inputRef}
            type="file"
            style={{ display: 'none' }}
            accept={extList.join(',')}
            onChange={e => handleFile(e.target.files[0])}
          />
        </div>
      ) : (
        <div style={styles.fileSelected}>
          <span style={styles.fileIcon}>📄</span>
          <div style={styles.fileInfo}>
            <span style={styles.fileName}>{file.name}</span>
            <span style={styles.fileSize}>{formatSize(file.size)}</span>
          </div>
          <button type="button" onClick={handleRemove} style={styles.removeBtn} title="移除">✕</button>
        </div>
      )}
      {error && <p style={styles.error}>{error}</p>}
    </div>
  )
}

const styles = {
  disabledBox: {
    border: '2px dashed #fed7d7', borderRadius: 10, padding: '28px 20px',
    textAlign: 'center', background: '#fff5f5', color: '#c53030', fontSize: 14
  },
  dropZone: {
    border: '2px dashed #d1d5db', borderRadius: 10, padding: '28px 20px',
    textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', background: '#fafafa'
  },
  dragging: { borderColor: '#1a56db', background: '#e8f0fe' },
  uploadIcon: { fontSize: 28 },
  dropText: { fontSize: 14, color: '#555', margin: '8px 0 4px' },
  hintText: { fontSize: 12, color: '#aaa' },
  fileSelected: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
    background: '#f0f4ff', borderRadius: 8, border: '1px solid #c7d9ff'
  },
  fileIcon: { fontSize: 22, flexShrink: 0 },
  fileInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 },
  fileName: { fontSize: 14, color: '#333', fontWeight: 600 },
  fileSize: { fontSize: 12, color: '#888' },
  removeBtn: {
    background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 16, padding: '2px 4px', borderRadius: 4
  },
  error: { color: '#e53e3e', fontSize: 12, marginTop: 6 }
}
