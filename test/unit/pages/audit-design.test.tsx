// E7 as designed for the audit log screen: the filter groups and the chips of applied filters, the entry
// type pills, the details drawer and the exports list (the behaviour behind them is in audit-page.test.tsx).
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, rs } from '@rstest/core'
import type { AuditPort } from '../../../src/domain/repositories/AuditPort'
import type { OrgMembershipPort } from '../../../src/domain/repositories/OrgMembershipPort'
import type { UserProfilePort } from '../../../src/domain/repositories/UserProfilePort'
import AuditExportsPage from '../../../src/presentation/pages/AuditExportsPage'
import AuditPage from '../../../src/presentation/pages/AuditPage'
import { entry, exportJob, page } from '../../fixtures/audit'
import { renderPage } from '../../fixtures/pages'
import { ADA, BOB, CY, members } from '../../fixtures/people'
import { memoryExportJobs, partial } from '../../fixtures/services'

function ports(o: { audit?: Partial<AuditPort>; jobs?: string[] } = {}) {
  const audit = partial<AuditPort>('audit', {
    search: rs.fn(async () => page([entry('e1'), entry('e2', { action: 'login.success', entryType: 'auth.login.success', actor: { type: 'user', display: 'Bob Builder' }, target: undefined })])),
    getEntry: rs.fn(async (id: string) => entry(id)),
    requestExport: rs.fn(async () => ({ exportId: 'ex-9', status: 'pending' as const })),
    getExport: rs.fn(async (id: string) => exportJob({ exportId: id })),
    ...o.audit,
  })
  const org = partial<OrgMembershipPort>('orgMembership', { listMembers: rs.fn(async () => ({ members })) })
  const users = partial<UserProfilePort>('userProfile', { batch: rs.fn(async (ids: readonly string[]) => ({ users: [ADA, BOB, CY].filter((u) => ids.includes(u.userId)), missing: [] })) })
  const exportJobs = memoryExportJobs(o.jobs ?? [])
  return { audit, org, users, exportJobs }
}

function Where() {
  const l = useLocation()
  return <span data-testid="where">{l.pathname + l.search}</span>
}

const open = (p: ReturnType<typeof ports>, path = '/admin/audit', o: Parameters<typeof renderPage>[1] = {}) =>
  renderPage(
    <>
      <Where />
      <Routes>
        <Route path="/admin/audit" element={<AuditPage />} />
        <Route path="/admin/audit/exports" element={<AuditExportsPage />} />
      </Routes>
    </>,
    { path, services: { audit: p.audit, orgMembership: p.org, userProfile: p.users, exportJobs: p.exportJobs }, ...o },
  )

afterEach(() => rs.useRealTimers())

describe('E7 design', () => {
  it('groups the filters by time, who, what and where', async () => {
    open(ports())
    const form = await screen.findByRole('form', { name: 'Filters' })
    for (const group of ['Time range', 'Who', 'What', 'Where']) expect(within(form).getByText(group)).toBeInTheDocument()
  })

  it('shows the applied filters as chips, an actor by name, and removes one at a time', async () => {
    const p = ports()
    open(p, '/admin/audit?entry_type=auth.login&actor_id=u-bob&source_service=iam-org-membership')
    const chips = await screen.findByRole('list', { name: 'Active filters' })
    expect(within(chips).getByText('auth.login')).toBeInTheDocument()
    expect(await within(chips).findByText('Bob Builder')).toBeInTheDocument()
    expect(chips).not.toHaveTextContent('u-bob')
    await userEvent.setup().click(within(chips).getByRole('button', { name: 'Remove filter: Entry type' }))
    expect(screen.getByTestId('where').textContent).not.toContain('entry_type')
    expect(screen.getByTestId('where').textContent).toContain('source_service=iam-org-membership')
  })

  it('shows no chips without filters, and counts the entries shown', async () => {
    open(ports())
    expect(await screen.findByText('2 entries shown')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Active filters' })).not.toBeInTheDocument()
  })

  it('puts Export these results in the header beside the Exports link', async () => {
    open(ports())
    expect(await screen.findByRole('button', { name: 'Export these results' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Exports' })).toHaveAttribute('href', '/admin/audit/exports')
  })

  it('starts no export for a range the page refuses, and says why', async () => {
    const p = ports()
    open(p, '/admin/audit?from=2026-11-20T00:00:00.000Z&to=2026-11-01T00:00:00.000Z')
    expect(await screen.findByRole('alert')).toHaveTextContent('The start must be before the end.')
    const button = screen.getByRole('button', { name: 'Export these results' })
    expect(button).toBeDisabled()
    await userEvent.setup().click(button)
    expect(p.audit.requestExport).not.toHaveBeenCalled()
  })

  it('links a download only when the service\'s URL is https', async () => {
    const getExport = rs.fn(async (id: string) => exportJob({ exportId: id, status: 'ready', downloadUrl: id === 'ex-bad' ? 'javascript:alert(1)' : 'https://files.example.com/ok.csv' }))
    open(ports({ jobs: ['ex-ok', 'ex-bad'], audit: { getExport } }), '/admin/audit/exports')
    expect(await screen.findAllByText('Ready')).toHaveLength(2)
    const links = screen.getAllByRole('link', { name: 'Download' })
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', 'https://files.example.com/ok.csv')
  })

  it('opens the entry in a side drawer with the request (IP, trace) and the retention tier in words', async () => {
    open(ports({ audit: { getEntry: rs.fn(async (id: string) => entry(id, { ipAddress: '203.0.113.7', traceId: 'trace-abc', retentionTier: 'security_3y' })) } }))
    await userEvent.setup().click((await screen.findAllByRole('button', { name: /Details: member.suspended/ }))[0]!)
    const drawer = await screen.findByRole('dialog', { name: 'Audit entry' })
    expect(within(drawer).getByText('Request')).toBeInTheDocument()
    expect(await within(drawer).findByText('203.0.113.7')).toBeInTheDocument()
    expect(within(drawer).getByText('trace-abc')).toBeInTheDocument()
    expect(within(drawer).getByText('Security (3 years)')).toBeInTheDocument()
    expect(drawer).toHaveTextContent('security_3y')
  })

  it('closes the drawer on a press outside it', async () => {
    open(ports())
    await userEvent.setup().click((await screen.findAllByRole('button', { name: /Details: member.suspended/ }))[0]!)
    const drawer = await screen.findByRole('dialog', { name: 'Audit entry' })
    await userEvent.setup().click(drawer.parentElement!)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows an export\'s status as a pill, with Download when it is ready', async () => {
    open(ports({ jobs: ['ex-1'], audit: { getExport: rs.fn(async (id: string) => exportJob({ exportId: id, status: 'ready', downloadUrl: 'https://files.example.com/ex-1.csv' })) } }), '/admin/audit/exports')
    expect(await screen.findByText('Ready')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Download' })).toBeInTheDocument()
  })
})
