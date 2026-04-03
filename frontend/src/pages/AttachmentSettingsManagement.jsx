import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAttachmentSettings, saveAttachmentSettings } from '../api/client.js'

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(0) + ' MB'
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB'
  return bytes + ' B'
}

export default function AttachmentSettingsManagement() {
  const [settings, setSettings] = useState(null)
  const [form, setForm] = useState({
    uploadEnabled: true,
    allowedExtensions: '',
    allowedMimeTypes: '',
    maxFileSizeBytes: 20971520
  })
  const [newExt, setNewExt] = useState('')
  const [newMime, setNewMime] = useState('')
  const [sizeMb, setSizeMb] = useState(20)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    getAttachmentSettings().then(s => {
      setSettings(s)
      setForm({
        uploadEnabled: s.uploadEnabled,
        allowedExtensions: s.allowedExtensions,
        allowedMimeTypes: s.allowedMimeTypes,
        maxFileSizeBytes: s.maxFileSizeBytes
      })
      setSizeMb(Math.round(s.maxFileSizeBytes / 1024 / 1024))
    }).catch(() => setError('無法載入設定'))
  }, [])

  const extList = form.allowedExtensions
    ? form.allowedExtensions.split(',').map(e => e.trim()).filter(Boolean)
    : []

  const mimeList = form.allowedMimeTypes
    ? form.allowedMimeTypes.split(',').map(m => m.trim()).filter(Boolean)
    : []

  const removeExt = (ext) => {
    setForm(f => ({ ...f, allowedExtensions: extList.filter(e => e !== ext).join(',') }))
  }

  const addExt = () => {
    const val = newExt.trim().toLowerCase()
    if (!val) return
    const e = val.startsWith('.') ? val : '.' + val
    if (!extList.includes(e)) {
      setForm(f => ({ ...f, allowedExtensions: [...extList, e].join(',') }))
    }
    setNewExt('')
  }

  const removeMime = (mime) => {
    setForm(f => ({ ...f, allowedMimeTypes: mimeList.filter(m => m !== mime).join(',') }))
  }

  const addMime = () => {
    const val = newMime.trim().toLowerCase()
    if (!val || mimeList.includes(val)) { setNewMime(''); return }
    setForm(f => ({ ...f, allowedMimeTypes: [...mimeList, val].join(',') }))
    setNewMime('')
  }

  const handleSizeChange = (v) => {
    const mb = parseInt(v, 10)
    if (!isNaN(mb) && mb > 0) {
      setSizeMb(mb)
      setForm(f => ({ ...f, maxFileSizeBytes: mb * 1024 * 1024 }))
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess(false)
    try {
      await saveAttachmentSettings(form)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      setError('儲存失敗，請稍後再試')
    } finally {
      setSaving(false)
    }
  }

  if (!settings) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>載入中...</div>

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.logo}>GITP 管理後台</h1>
        <button onClick={() => navigate('/admin')} style={styles.backBtn}>← 返回後台</button>
      </header>

      <main style={styles.main}>
        <h2 style={styles.title}>📎 附件上傳設定</h2>
        <p style={styles.subtitle}>管理系統是否開放附件上傳、允許的檔案格式、MIME 類型及大小限制。</p>

        {error && <div style={styles.errorMsg}>{error}</div>}
        {success && <div style={styles.successMsg}>✅ 設定已儲存成功</div>}

        <div style={styles.card}>
          {/* Toggle upload enabled */}
          <div style={styles.row}>
            <div>
              <div style={styles.label}>開放附件上傳</div>
              <div style={styles.hint}>關閉後所有使用者將無法上傳任何附件</div>
            </div>
            <label style={styles.toggle}>
              <input
                type="checkbox"
                checked={form.uploadEnabled}
                onChange={e => setForm(f => ({ ...f, uploadEnabled: e.target.checked }))}
                style={{ display: 'none' }}
              />
              <div style={{
                ...styles.toggleTrack,
                background: form.uploadEnabled ? '#1a56db' : '#ccc'
              }}>
                <div style={{
                  ...styles.toggleThumb,
                  transform: form.uploadEnabled ? 'translateX(22px)' : 'translateX(2px)'
                }} />
              </div>
              <span style={{ marginLeft: 10, fontSize: 14, color: form.uploadEnabled ? '#1a56db' : '#888' }}>
                {form.uploadEnabled ? '已開放' : '已關閉'}
              </span>
            </label>
          </div>

          <hr style={styles.divider} />

          {/* Max file size */}
          <div style={styles.section}>
            <div style={styles.label}>最大檔案大小</div>
            <div style={styles.hint}>目前限制：{formatSize(form.maxFileSizeBytes)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <input
                type="number"
                value={sizeMb}
                min={1}
                max={500}
                onChange={e => handleSizeChange(e.target.value)}
                style={styles.numInput}
              />
              <span style={{ fontSize: 14, color: '#555' }}>MB</span>
            </div>
          </div>

          <hr style={styles.divider} />

          {/* Allowed extensions */}
          <div style={styles.section}>
            <div style={styles.label}>允許的副檔名</div>
            <div style={styles.hint}>新增或移除可上傳的副檔名（含點號，如 .pdf）</div>
            <div style={styles.tagList}>
              {extList.map(e => (
                <span key={e} style={styles.tag}>
                  {e}
                  <button onClick={() => removeExt(e)} style={styles.tagRemove}>✕</button>
                </span>
              ))}
              {extList.length === 0 && <span style={{ color: '#bbb', fontSize: 13 }}>（無限制）</span>}
            </div>
            <div style={styles.addRow}>
              <input
                value={newExt}
                onChange={e => setNewExt(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addExt()}
                placeholder=".pdf"
                style={styles.addInput}
              />
              <button onClick={addExt} style={styles.addBtn}>新增</button>
            </div>
          </div>

          <hr style={styles.divider} />

          {/* Allowed MIME types */}
          <div style={styles.section}>
            <div style={styles.label}>允許的 MIME Type</div>
            <div style={styles.hint}>新增或移除允許的 Content-Type，留空代表不驗證 MIME</div>
            <div style={styles.tagList}>
              {mimeList.map(m => (
                <span key={m} style={{ ...styles.tag, background: '#eef9f0', borderColor: '#a7d9b0' }}>
                  {m}
                  <button onClick={() => removeMime(m)} style={styles.tagRemove}>✕</button>
                </span>
              ))}
              {mimeList.length === 0 && <span style={{ color: '#bbb', fontSize: 13 }}>（不驗證 MIME）</span>}
            </div>
            <div style={styles.addRow}>
              <input
                value={newMime}
                onChange={e => setNewMime(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addMime()}
                placeholder="application/pdf"
                style={styles.addInput}
              />
              <button onClick={addMime} style={styles.addBtn}>新增</button>
            </div>
          </div>
        </div>

        <div style={styles.actions}>
          <button onClick={handleSave} disabled={saving} style={{ ...styles.saveBtn, opacity: saving ? 0.6 : 1 }}>
            {saving ? '儲存中...' : '💾 儲存設定'}
          </button>
        </div>
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
  backBtn: {
    background: 'rgba(255,255,255,0.1)', color: '#fff',
    border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6,
    padding: '6px 14px', cursor: 'pointer', fontSize: 13
  },
  main: { maxWidth: 720, margin: '32px auto', padding: '0 16px' },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 4, color: '#1a1a1a' },
  subtitle: { color: '#666', fontSize: 14, marginBottom: 24 },
  card: {
    background: '#fff', borderRadius: 12,
    boxShadow: '0 1px 6px rgba(0,0,0,0.08)', padding: '28px 32px'
  },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 },
  label: { fontWeight: 600, fontSize: 15, color: '#1a1a1a', marginBottom: 3 },
  hint: { fontSize: 12, color: '#888' },
  toggle: { display: 'flex', alignItems: 'center', cursor: 'pointer' },
  toggleTrack: {
    width: 46, height: 26, borderRadius: 13, position: 'relative',
    transition: 'background 0.2s', flexShrink: 0
  },
  toggleThumb: {
    position: 'absolute', top: 2, width: 22, height: 22,
    background: '#fff', borderRadius: '50%', transition: 'transform 0.2s',
    boxShadow: '0 1px 4px rgba(0,0,0,0.25)'
  },
  divider: { border: 'none', borderTop: '1px solid #f0f0f0', margin: '20px 0' },
  section: {},
  numInput: {
    width: 100, padding: '7px 10px', border: '1px solid #ddd',
    borderRadius: 6, fontSize: 14, textAlign: 'right'
  },
  tagList: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10, marginBottom: 10 },
  tag: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '4px 10px', background: '#e8f0fe', borderRadius: 20,
    border: '1px solid #c7d9ff', fontSize: 13, color: '#1a56db', fontWeight: 500
  },
  tagRemove: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#999', fontSize: 12, padding: 0, lineHeight: 1
  },
  addRow: { display: 'flex', gap: 8, marginTop: 6 },
  addInput: {
    flex: 1, padding: '7px 10px', border: '1px solid #ddd',
    borderRadius: 6, fontSize: 13
  },
  addBtn: {
    padding: '7px 16px', background: '#1a56db', color: '#fff',
    border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13
  },
  actions: { marginTop: 24, display: 'flex', justifyContent: 'flex-end' },
  saveBtn: {
    padding: '10px 28px', background: '#1a56db', color: '#fff',
    border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15, fontWeight: 600
  },
  errorMsg: {
    background: '#fff5f5', border: '1px solid #fed7d7', color: '#c53030',
    borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 14
  },
  successMsg: {
    background: '#f0fff4', border: '1px solid #9ae6b4', color: '#276749',
    borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 14
  }
}
