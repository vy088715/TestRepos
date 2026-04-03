import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getIssueTypes, manageIssueType,
  getSystemsByCompany, manageCompanySystem, getCompanies
} from '../api/client'
import { useAuth } from '../hooks/useAuth'

export default function ClassificationManagement() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [issueTypes, setIssueTypes] = useState([])
  const [companies,  setCompanies]  = useState([])
  const [systems,    setSystems]    = useState([])
  const [selCoId,    setSelCoId]    = useState('')

  const [itForm,  setItForm]  = useState({ name: '', sortOrder: 0 })
  const [sysForm, setSysForm] = useState({ companyId: '', name: '', sortOrder: 0 })
  const [msg,     setMsg]     = useState(null)

  const isAdmin = user?.roles?.includes('it_admin')

  const reload = async () => {
    const [it, co] = await Promise.all([getIssueTypes(false), getCompanies()])
    setIssueTypes(it)
    setCompanies(co)
  }

  const reloadSystems = async (companyId) => {
    if (!companyId) { setSystems([]); return }
    const s = await getSystemsByCompany(companyId, false)
    setSystems(s)
  }

  useEffect(() => { reload() }, [])
  useEffect(() => { reloadSystems(selCoId) }, [selCoId])

  if (!isAdmin) return (
    <div style={{ padding: 32, textAlign: 'center', color: '#6c757d' }}>
      僅 IT 管理員可管理分類設定
    </div>
  )

  const showMsg = (text) => {
    setMsg(text)
    setTimeout(() => setMsg(null), 3000)
  }

  const handleCreateIssueType = async () => {
    if (!itForm.name.trim()) return
    try {
      await manageIssueType({ action: 'CREATE', name: itForm.name, sortOrder: itForm.sortOrder, isActive: true })
      setItForm({ name: '', sortOrder: 0 })
      await reload()
      showMsg('問題類型已新增')
    } catch (e) {
      showMsg('新增失敗：' + (e?.response?.data?.message ?? e.message))
    }
  }

  const handleToggleIssueType = async (it) => {
    await manageIssueType({ action: 'UPDATE', id: it.id, name: it.name, sortOrder: it.sortOrder, isActive: !it.isActive })
    await reload()
  }

  const handleCreateSystem = async () => {
    if (!sysForm.name.trim() || !sysForm.companyId) return
    try {
      await manageCompanySystem({ action: 'CREATE', companyId: sysForm.companyId, name: sysForm.name, sortOrder: sysForm.sortOrder, isActive: true })
      setSysForm(f => ({ ...f, name: '', sortOrder: 0 }))
      await reloadSystems(selCoId)
      showMsg('系統別已新增')
    } catch (e) {
      showMsg('新增失敗：' + (e?.response?.data?.message ?? e.message))
    }
  }

  const handleToggleSystem = async (s) => {
    await manageCompanySystem({ action: 'UPDATE', id: s.id, companyId: s.companyId, name: s.name, sortOrder: s.sortOrder, isActive: !s.isActive })
    await reloadSystems(selCoId)
  }

  const labelStyle = { fontSize: 12, color: '#6c757d', marginBottom: 4, display: 'block' }
  const inputStyle = { padding: '6px 10px', borderRadius: 4, border: '1px solid #ced4da', fontSize: 14 }
  const btnStyle   = (bg) => ({
    background: bg, color: '#fff', border: 'none',
    borderRadius: 4, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600
  })

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <button onClick={() => navigate(-1)} style={{ ...btnStyle('#6c757d'), marginBottom: 16 }}>
        ← 返回
      </button>
      <h2 style={{ marginBottom: 24 }}>🏷️ 分類設定管理</h2>

      {msg && (
        <div style={{
          background: '#d1e7dd', color: '#0a3622', borderRadius: 6,
          padding: '10px 16px', marginBottom: 16, fontSize: 14
        }}>{msg}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Issue Types */}
        <div style={{ border: '1px solid #dee2e6', borderRadius: 8, padding: 16 }}>
          <h4 style={{ marginTop: 0, marginBottom: 16 }}>問題類型</h4>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              placeholder="新增問題類型名稱"
              value={itForm.name}
              onChange={e => setItForm(f => ({ ...f, name: e.target.value }))}
              style={{ ...inputStyle, flex: 1 }}
            />
            <input
              type="number" placeholder="排序" value={itForm.sortOrder}
              onChange={e => setItForm(f => ({ ...f, sortOrder: +e.target.value }))}
              style={{ ...inputStyle, width: 60 }}
            />
            <button onClick={handleCreateIssueType} style={btnStyle('#0d6efd')}>新增</button>
          </div>
          <div>
            {issueTypes.map(it => (
              <div key={it.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 10px', borderRadius: 4, marginBottom: 4,
                background: it.isActive ? '#f8f9fa' : '#e9ecef'
              }}>
                <span style={{ fontSize: 14, color: it.isActive ? '#212529' : '#adb5bd' }}>
                  {it.name}
                  <span style={{ fontSize: 11, color: '#adb5bd', marginLeft: 6 }}>排序:{it.sortOrder}</span>
                </span>
                <button
                  onClick={() => handleToggleIssueType(it)}
                  style={{ ...btnStyle(it.isActive ? '#dc3545' : '#198754'), fontSize: 11, padding: '3px 8px' }}
                >
                  {it.isActive ? '停用' : '啟用'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Company Systems */}
        <div style={{ border: '1px solid #dee2e6', borderRadius: 8, padding: 16 }}>
          <h4 style={{ marginTop: 0, marginBottom: 12 }}>各公司系統別</h4>
          <label style={labelStyle}>選擇公司</label>
          <select
            value={selCoId}
            onChange={e => { setSelCoId(e.target.value); setSysForm(f => ({ ...f, companyId: e.target.value })) }}
            style={{ ...inputStyle, width: '100%', marginBottom: 12 }}
          >
            <option value="">— 請選擇 —</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {selCoId && (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input
                  placeholder="系統名稱"
                  value={sysForm.name}
                  onChange={e => setSysForm(f => ({ ...f, name: e.target.value }))}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <input
                  type="number" placeholder="排序" value={sysForm.sortOrder}
                  onChange={e => setSysForm(f => ({ ...f, sortOrder: +e.target.value }))}
                  style={{ ...inputStyle, width: 60 }}
                />
                <button onClick={handleCreateSystem} style={btnStyle('#0d6efd')}>新增</button>
              </div>
              <div>
                {systems.map(s => (
                  <div key={s.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 10px', borderRadius: 4, marginBottom: 4,
                    background: s.isActive ? '#f8f9fa' : '#e9ecef'
                  }}>
                    <span style={{ fontSize: 14, color: s.isActive ? '#212529' : '#adb5bd' }}>
                      {s.name}
                    </span>
                    <button
                      onClick={() => handleToggleSystem(s)}
                      style={{ ...btnStyle(s.isActive ? '#dc3545' : '#198754'), fontSize: 11, padding: '3px 8px' }}
                    >
                      {s.isActive ? '停用' : '啟用'}
                    </button>
                  </div>
                ))}
                {systems.length === 0 && (
                  <div style={{ color: '#adb5bd', fontSize: 13, textAlign: 'center', marginTop: 8 }}>
                    尚無系統別，請新增
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
