// The admin area's page outlet and nothing more (LLD §2.1, §7.12; docs/lld/app-chrome-handoff.md).
// web-shell draws the one sidebar for the whole app, including the Admin sub-menu (Users, Departments,
// Group mappings, Settings, Audit log), so this remote draws no navigation, header, user menu, theme
// picker or sign-out of its own. Each routed page is in its own MFEErrorBoundary, so a throwing page is
// replaced while the shell's sidebar still works. Which sections a user may open is decided by IAM and
// each page (useAdminAccess); the shell's sub-menu only hides what the user has no permission for.
import { Outlet, useLocation } from 'react-router-dom'
import { MFEErrorBoundary } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { APP_ID } from '../../shared/constants/app'

export default function AdminLayout() {
  const { pathname } = useLocation()
  return (
    <div className="min-h-[calc(100dvh-var(--shell-header-height,0px))] bg-aura-canvas p-4 text-aura-text md:p-6">
      <main className="min-w-0">
        <MFEErrorBoundary mfe={APP_ID} resetKeys={[pathname]}>
          <Outlet />
        </MFEErrorBoundary>
      </main>
    </div>
  )
}
