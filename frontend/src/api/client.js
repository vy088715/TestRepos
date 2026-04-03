import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

// Minutes before JWT expiry to proactively refresh in request interceptor
const PROACTIVE_REFRESH_MINUTES = 5

function parseTokenExp(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload?.exp ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

function isTokenNearExpiry(token) {
  const exp = parseTokenExp(token)
  if (exp === null) return false
  return exp - Date.now() < PROACTIVE_REFRESH_MINUTES * 60 * 1000
}

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 30000
})

// ── Request interceptor ────────────────────────────────────────────────────
// Attach JWT to every request.  If the token is near expiry, refresh it first
// (best-effort; proceeds with the old token if refresh fails).
client.interceptors.request.use(async config => {
  const stored = localStorage.getItem('gitp_auth')
  if (!stored) return config

  let { token } = JSON.parse(stored) || {}
  if (!token) return config

  if (isTokenNearExpiry(token)) {
    try {
      const resp = await axios.post(
        `${BASE_URL}/users/refresh-token`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (resp.data?.token) {
        token = resp.data.token
        // Persist the refreshed token so the useAuth hook picks it up
        const current = JSON.parse(localStorage.getItem('gitp_auth') || '{}')
        localStorage.setItem('gitp_auth', JSON.stringify({ ...current, token }))
      }
    } catch {
      // Refresh failed — proceed with existing token; 401 handler will log out
    }
  }

  config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Response interceptor ───────────────────────────────────────────────────
// On 401, clear local auth and redirect to login.
client.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('gitp_auth')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// ── Auth endpoints ─────────────────────────────────────────────────────────
export const login = (email, password) =>
  client.post('/users/login', { email, password }).then(r => r.data)

export const refreshToken = () =>
  client.post('/users/refresh-token').then(r => r.data)

export const getMe = () =>
  client.get('/users/me').then(r => r.data)

export const getItStaff = () =>
  client.get('/users/it-staff').then(r => r.data)

export const getAuthConfig = () =>
  client.get('/users/auth-config').then(r => r.data)

export const windowsAuth = () =>
  client.get('/users/windows-auth', { withCredentials: true }).then(r => r.data)

export const ldapLogin = (username, password, companyId = null) =>
  client.post('/users/ldap-auth', { username, password, companyId }).then(r => r.data)

export const azureAdLogin = (idToken) =>
  client.post('/users/azure-ad-login', { idToken }).then(r => r.data)

// ── Tickets ────────────────────────────────────────────────────────────────
export const getTickets = (params) =>
  client.get('/tickets', { params }).then(r => r.data)

export const createTicket = (data) =>
  client.post('/tickets', data).then(r => r.data)

export const getTicket = (id) =>
  client.get(`/tickets/${id}`).then(r => r.data)

export const updateStatus = (id, status) =>
  client.patch(`/tickets/${id}/status`, { status }).then(r => r.data)

export const assignTicket = (id, assigneeId) =>
  client.put(`/tickets/${id}/assign`, { assigneeId }).then(r => r.data)

export const batchAssign = (ticketIds, assigneeId) =>
  client.post('/tickets/batch-assignments', { ticketIds, assigneeId }).then(r => r.data)

export const getMessages = (ticketId) =>
  client.get(`/tickets/${ticketId}/messages`).then(r => r.data)

export const addMessage = (ticketId, content) =>
  client.post(`/tickets/${ticketId}/messages`, { content }).then(r => r.data)

export const uploadAttachment = (ticketId, file) => {
  const form = new FormData()
  form.append('file', file)
  return client.post(`/tickets/${ticketId}/attachments`, form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data)
}

export const transferTicket = (ticketId, toHandlerId, note) =>
  client.put(`/tickets/${ticketId}/transfer`, { toHandlerId, note }).then(r => r.data)

export const getHandlerHistory = (ticketId) =>
  client.get(`/tickets/${ticketId}/handlers`).then(r => r.data)

// ── Reports ────────────────────────────────────────────────────────────────
export const startExport = (filters) =>
  client.post('/reports/exports', filters).then(r => r.data)

export const getExportStatus = (jobId) =>
  client.get(`/reports/exports/${jobId}`).then(r => r.data)

export const getExportDownloadUrl = (jobId) =>
  `${BASE_URL}/reports/exports/${jobId}/download`

// ── Admin: IT 人員管理 ──────────────────────────────────────────────────────
export const getAdminUsers = () =>
  client.get('/admin/users').then(r => r.data)

export const updateUserRoles = (userId, roles) =>
  client.put(`/admin/users/${userId}/roles`, { roles }).then(r => r.data)

// ── Company Management ─────────────────────────────────────────────────────
export const getCompanies = () =>
  client.get('/companies').then(r => r.data)

export const setCompanyItFlag = (companyId, isItCompany) =>
  client.put(`/companies/${companyId}/it-flag`, { isItCompany }).then(r => r.data)

// ── Classification ─────────────────────────────────────────────────────────
export const getIssueTypes = (activeOnly = true) =>
  client.get('/classification/issue-types', { params: { activeOnly } }).then(r => r.data)

export const createIssueType = (name) =>
  client.post('/classification/issue-types', { name }).then(r => r.data)

export const updateIssueType = (id, name) =>
  client.put(`/classification/issue-types/${id}`, { name }).then(r => r.data)

export const deleteIssueType = (id) =>
  client.delete(`/classification/issue-types/${id}`).then(r => r.data)

export const getSystemsByCompany = (companyId, activeOnly = true) =>
  client.get('/classification/systems', { params: { companyId, activeOnly } }).then(r => r.data)

export const createSystem = (companyId, name) =>
  client.post('/classification/systems', { companyId, name }).then(r => r.data)

export const updateSystem = (id, companyId, name) =>
  client.put(`/classification/systems/${id}`, { companyId, name }).then(r => r.data)

export const deleteSystem = (id) =>
  client.delete(`/classification/systems/${id}`).then(r => r.data)

export const setTicketClassification = (ticketId, data) =>
  client.put(`/classification/tickets/${ticketId}`, data).then(r => r.data)

// ── LDAP Settings ──────────────────────────────────────────────────────────
export const getLdapSettings = () =>
  client.get('/ldap/settings').then(r => r.data)

export const getLdapSettingsByCompany = (companyId) =>
  client.get(`/ldap/settings/${companyId}`).then(r => r.data)

export const saveLdapSettings = (companyId, data) =>
  client.put(`/ldap/settings/${companyId}`, data).then(r => r.data)

export const deleteLdapSettings = (companyId) =>
  client.delete(`/ldap/settings/${companyId}`).then(r => r.data)

export const testLdapConnection = (companyId) =>
  client.post(`/ldap/test/${companyId}`).then(r => r.data)

// ── Satisfaction Feedback (public, no auth required) ────────────────────
export const getFeedback = (token) =>
  client.get(`/feedback/${token}`).then(r => r.data)

export const submitFeedback = (token, result) =>
  client.post(`/feedback/${token}`, { result }).then(r => r.data)

// ── Dashboard Statistics ─────────────────────────────────────────────────
export const getTicketStats = (period, year, month) =>
  client.get('/dashboard/stats', { params: { period, year, month } }).then(r => r.data)

export const getAttachmentSettings = () => client.get('/attachment-settings').then(r => r.data)
export const saveAttachmentSettings = (data) => client.put('/attachment-settings', data).then(r => r.data)

export default client
