// The remote's routes under the shell's /t/<slug>/admin (or /admin standalone), and the workspace
// basename. Each page names its route template for telemetry (LLD §4.4).
import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { slugFromPath } from '@bcbp-solutions-fzc-llc/frontend-sdk/auth'
import { tryGetConfig } from '@bcbp-solutions-fzc-llc/frontend-sdk/config'
import { useRouteTemplate, useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { useAdminAccess, type AdminSection } from '../../presentation/features/access/useAdminAccess'
import SectionPlaceholder from '../../presentation/components/SectionPlaceholder'
import AuditExportsPage from '../../presentation/pages/AuditExportsPage'
import AuditPage from '../../presentation/pages/AuditPage'
import DepartmentsPage from '../../presentation/pages/DepartmentsPage'
import GroupMappingsPage from '../../presentation/pages/GroupMappingsPage'
import SettingsPage from '../../presentation/pages/SettingsPage'
import UserDetailPage from '../../presentation/pages/UserDetailPage'
import UsersPage from '../../presentation/pages/UsersPage'
import { APP_ID } from '../../shared/constants/app'
import AdminLayout from '../layouts/AdminLayout'

type SectionProps = { id: AdminSection; template: `/${string}`; title: string; children?: ReactNode }

/**
 * A section page: registers its route template, then renders the screen (placeholders until each
 * is built), or "not permitted" when the user may not open it (a page, never a redirect).
 */
function Section({ id, template, title, children }: SectionProps) {
  useRouteTemplate(template)
  const t = useT(APP_ID)
  const { sections } = useAdminAccess()
  if (!sections[id]) {
    // The page keeps its title (a level-one heading: every page has one) and says why there is nothing under it.
    return (
      <section>
        <h1 className="text-xl font-semibold">{t(title)}</h1>
        <p role="alert">{t('section.notPermitted')}</p>
      </section>
    )
  }
  return children ?? <SectionPlaceholder title={t(title)} />
}

/** The page titles (catalogue keys). The shell's sidebar draws the section links. */
const TITLES = {
  users: 'nav.users',
  departments: 'nav.departments',
  groupMappings: 'nav.groupMappings',
  settings: 'nav.settings',
  audit: 'nav.audit',
} as const

export function AdminRoutes() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Navigate to="users" replace />} />
        <Route path="users" element={<Section id="users" template="/t/:slug/admin/users" title={TITLES.users}><UsersPage /></Section>} />
        <Route path="users/:userId" element={<Section id="users" template="/t/:slug/admin/users/:userId" title={TITLES.users}><UserDetailPage /></Section>} />
        <Route path="departments" element={<Section id="departments" template="/t/:slug/admin/departments" title={TITLES.departments}><DepartmentsPage /></Section>} />
        <Route path="group-mappings" element={<Section id="groupMappings" template="/t/:slug/admin/group-mappings" title={TITLES.groupMappings}><GroupMappingsPage /></Section>} />
        <Route path="settings" element={<Section id="settings" template="/t/:slug/admin/settings" title={TITLES.settings}><SettingsPage /></Section>} />
        <Route path="audit" element={<Section id="audit" template="/t/:slug/admin/audit" title={TITLES.audit}><AuditPage /></Section>} />
        <Route path="audit/exports" element={<Section id="audit" template="/t/:slug/admin/audit/exports" title={TITLES.audit}><AuditExportsPage /></Section>} />
        {/* An unknown nested path (an old bookmark, a typo) goes to the users list, not a blank page. */}
        <Route path="*" element={<Navigate to=".." relative="route" replace />} />
      </Route>
    </Routes>
  )
}

/** The shell's router basename for `pathname`: '<workspacePathPrefix><slug>', or '' outside a workspace. */
export function workspaceBasename(pathname: string): string {
  const auth = tryGetConfig()?.auth
  const slug = auth && slugFromPath(pathname, auth)
  return slug ? `${auth.workspacePathPrefix}${slug}` : ''
}
