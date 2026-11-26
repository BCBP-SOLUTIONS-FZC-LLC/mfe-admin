// The module the shell mounts (./App), and the page the standalone build renders (bootstrap/main.tsx).
// No props: the user, session context, sign-out and step-up come from the platform SDK (LLD §4.3).
// The remote runs its own router under the shell's workspace prefix, as the SDK does not share
// react-router-dom (LLD §4.4).
import { BrowserRouter, Navigate, Route, Routes, useInRouterContext } from 'react-router-dom'
import AdminProviders from './providers/AdminProviders'
import { AdminRoutes, workspaceBasename } from './routes'
import '../infrastructure/configuration/messages'
import './styles/index.css'

export { workspaceBasename }

export default function App() {
  return (
    <AdminProviders>
      <AppRoutes />
    </AdminProviders>
  )
}

function AppRoutes() {
  if (useInRouterContext()) return <AdminRoutes />
  const basename = workspaceBasename(window.location.pathname)
  return (
    <BrowserRouter {...(basename ? { basename } : {})}>
      <Routes>
        <Route path="/admin/*" element={<AdminRoutes />} />
        <Route path="*" element={<Navigate to="/admin/users" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
