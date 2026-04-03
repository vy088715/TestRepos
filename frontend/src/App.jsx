import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth.js'
import Login from './pages/Login.jsx'
import TicketList from './pages/TicketList.jsx'
import SubmitTicket from './pages/SubmitTicket.jsx'
import TicketDetail from './pages/TicketDetail.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import AdminUserManagement from './pages/AdminUserManagement.jsx'
import CompanyManagement from './pages/CompanyManagement.jsx'
import ClassificationManagement from './pages/ClassificationManagement.jsx'
import TicketStats from './pages/TicketStats.jsx'
import LdapSettingsManagement from './pages/LdapSettingsManagement.jsx'
import AttachmentSettingsManagement from './pages/AttachmentSettingsManagement.jsx'
import FeedbackPage from './pages/FeedbackPage.jsx'

function ProtectedRoute({ children, adminOnly = false, itCompanyOnly = false }) {
  const { isAuthenticated, user } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (adminOnly && user?.role !== 'it_admin') return <Navigate to="/tickets" replace />
  if (itCompanyOnly && !user?.isItCompany) return <Navigate to="/tickets" replace />
  return children
}

function RootRedirect() {
  const { isAuthenticated, user } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role === 'it_admin') return <Navigate to="/admin" replace />
  return <Navigate to="/tickets" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/feedback/:token" element={<FeedbackPage />} />
        <Route path="/feedback/:token/:action" element={<FeedbackPage />} />
        <Route path="/" element={<RootRedirect />} />
        <Route path="/submit" element={
          <ProtectedRoute><SubmitTicket /></ProtectedRoute>
        } />
        <Route path="/tickets" element={
          <ProtectedRoute><TicketList /></ProtectedRoute>
        } />
        <Route path="/tickets/new" element={
          <ProtectedRoute><SubmitTicket /></ProtectedRoute>
        } />
        <Route path="/tickets/:id" element={
          <ProtectedRoute><TicketDetail /></ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>
        } />
        <Route path="/admin/users" element={
          <ProtectedRoute adminOnly><AdminUserManagement /></ProtectedRoute>
        } />
        <Route path="/admin/companies" element={
          <ProtectedRoute adminOnly><CompanyManagement /></ProtectedRoute>
        } />
        <Route path="/admin/classification" element={
          <ProtectedRoute adminOnly><ClassificationManagement /></ProtectedRoute>
        } />
        <Route path="/admin/stats" element={
          <ProtectedRoute itCompanyOnly><TicketStats /></ProtectedRoute>
        } />
        <Route path="/admin/ldap" element={
          <ProtectedRoute adminOnly><LdapSettingsManagement /></ProtectedRoute>
        } />
        <Route path="/admin/attachment-settings" element={
          <ProtectedRoute adminOnly><AttachmentSettingsManagement /></ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
