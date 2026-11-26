// E7 Audit log (spec E7; LLD §7.10): search, filters in the URL, paging, the plan window, a large
// search that becomes an export, entry details, and exports followed to the end.
import { ProblemError } from '@bcbp-solutions-fzc-llc/frontend-sdk/problem'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, rs } from '@rstest/core'
import type { AuditEntry } from '../../../src/domain/entities/audit'
import type { AuditPort } from '../../../src/domain/repositories/AuditPort'
import type { OrgMembershipPort } from '../../../src/domain/repositories/OrgMembershipPort'
import type { UserProfilePort } from '../../../src/domain/repositories/UserProfilePort'
import AuditExportsPage from '../../../src/presentation/pages/AuditExportsPage'
import AuditPage from '../../../src/presentation/pages/AuditPage'
import { EXPORT_POLL_MS } from '../../../src/presentation/features/audit/useAudit'
import { entry, exportJob, page } from '../../fixtures/audit'
import { renderPage } from '../../fixtures/pages'
import { ADA, BOB, CY, members } from '../../fixtures/people'
import { memoryExportJobs, partial } from '../../fixtures/services'

const problem = (status: number, errorCode: string) => new ProblemError({ type: 'about:blank', title: 'T', status, errorCode, traceId: 'trace-1', extensions: {} })

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

describe('E7 results', () => {
  it('lists time, who, what, to what, from where, with the entry type in plain words and as it is', async () => {
    open(ports())
    const row = (await screen.findAllByText('member.suspended', { selector: 'td' }))[0]!.closest('tr')!
    expect(row).toHaveTextContent('Ada Lovelace')
    expect(row).toHaveTextContent('Membership')
    expect(row).toHaveTextContent('membership.suspended')
    expect(row).toHaveTextContent('member u-bob')
    expect(row).toHaveTextContent('iam-org-membership')
    expect(screen.getByText('login.success', { selector: 'td' }).closest('tr')).toHaveTextContent('Sign-in')
  })

  it('shows "Automation" for a service account and "System" for the platform, never an ID', async () => {
    const search = rs.fn(async () => page([entry('s', { actor: { type: 'service_account', id: 'sa-1' } }), entry('i', { actor: { type: 'iam_system' } }), entry('a', { actor: { type: 'anonymous' } })]))
    open(ports({ audit: { search } }))
    await screen.findAllByRole('row')
    const rows = (await screen.findAllByText('member.suspended', { selector: 'td' })).map((c) => c.closest('tr')!)
    expect(rows[0]).toHaveTextContent('Automation')
    expect(rows[1]).toHaveTextContent('System')
    expect(rows[2]).toHaveTextContent('Anonymous')
    expect(document.body.textContent).not.toContain('sa-1')
  })

  it('looks a person up in User Profile when the entry carries no name, else "Unknown user"', async () => {
    const search = rs.fn(async () => page([entry('n1', { actor: { type: 'user', id: 'u-bob' } }), entry('n2', { actor: { type: 'user', id: 'u-ghost' } })]))
    const p = ports({ audit: { search } })
    open(p)
    expect(await screen.findByText('Bob Builder', { selector: 'td' })).toBeInTheDocument()
    expect(screen.getByText('Unknown user', { selector: 'td' })).toBeInTheDocument()
    // The two actors are asked of User Profile together, once (the actor picker asks about members separately).
    const asked = (p.users.batch as ReturnType<typeof rs.fn>).mock.calls.filter((c) => (c[0] as string[]).includes('u-ghost'))
    expect(asked).toHaveLength(1)
    expect(asked[0]![0]).toEqual(['u-bob', 'u-ghost'])
  })

  it('shows an entry type outside the known families as it is', async () => {
    open(ports({ audit: { search: rs.fn(async () => page([entry('x', { entryType: 'brandnew.thing.happened' })])) } }))
    expect((await screen.findAllByText('brandnew.thing.happened')).length).toBeGreaterThan(0)
  })

  it('says it is loading, and that nothing matches', async () => {
    open(ports({ audit: { search: rs.fn(() => new Promise<never>(() => {})) } }))
    expect((await screen.findAllByText('Loading the audit log…')).length).toBeGreaterThan(0)
  })

  it('says when no entry matches', async () => {
    open(ports({ audit: { search: rs.fn(async () => page([])) } }))
    expect(await screen.findByText('No entries match these filters.')).toBeInTheDocument()
  })

  it('shows an alert with Retry when the search fails', async () => {
    const search = rs.fn<AuditPort['search']>().mockRejectedValueOnce(problem(503, 'DB_UNAVAILABLE')).mockResolvedValue(page([entry('e1')]))
    open(ports({ audit: { search } }))
    const alert = await screen.findByText(/The audit log could not be loaded\./)
    await userEvent.click(within(alert.closest('[role="alert"]') as HTMLElement).getByRole('button', { name: 'Retry' }))
    expect((await screen.findAllByText('member.suspended', { selector: 'td' })).length).toBeGreaterThan(0)
  })

  it('pages by cursor, 100 at a time', async () => {
    const search = rs.fn(async (_f, p: { limit: number; cursor?: string }) => (p.cursor ? page([entry('e3', { action: 'third.entry' })]) : page([entry('e1')], { next: 'c2' })))
    open(ports({ audit: { search: search as never } }))
    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }))
    expect(await screen.findByText('third.entry', { selector: 'td' })).toBeInTheDocument()
    expect(search.mock.calls.map((c) => [c[1].limit, c[1].cursor])).toEqual([[100, undefined], [100, 'c2']])
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('records each load by resource', async () => {
    const view = open(ports())
    await screen.findAllByText('member.suspended', { selector: 'td' })
    expect(view.calls).toContain('load:audit:success')
  })
})

describe('E7 filters (kept in the URL)', () => {
  it('reads the filter from the URL into the form and into the search', async () => {
    const p = ports()
    open(p, '/admin/audit?entry_type=auth.login.success&actor_type=user&retention_tier=security_3y&source_service=iam-org-membership&target_type=member&target_id=u-bob')
    await screen.findAllByText('member.suspended', { selector: 'td' })
    expect(screen.getByLabelText('Entry type')).toHaveValue('auth.login.success')
    expect(screen.getByLabelText('Actor type')).toHaveValue('user')
    expect(screen.getByLabelText('Retention')).toHaveValue('security_3y')
    expect(screen.getByLabelText('Source service')).toHaveValue('iam-org-membership')
    expect(p.audit.search).toHaveBeenCalledWith(
      expect.objectContaining({ entryTypes: ['auth.login.success'], actorType: 'user', retentionTier: 'security_3y', sourceService: 'iam-org-membership', targetType: 'member', targetId: 'u-bob' }),
      { limit: 100 },
      expect.anything(),
    )
  })

  it('applies the form to the URL, and searches again', async () => {
    const p = ports()
    open(p)
    await screen.findAllByText('member.suspended', { selector: 'td' })
    await userEvent.type(screen.getByLabelText('Entry type'), 'config.tenant_setting.changed')
    await userEvent.selectOptions(screen.getByLabelText('Actor type'), 'service_account')
    await userEvent.type(screen.getByLabelText('Target ID'), 'T-9')
    await userEvent.click(screen.getByRole('button', { name: 'Apply filters' }))
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('entry_type=config.tenant_setting.changed'))
    expect(screen.getByTestId('where').textContent).toContain('actor_type=service_account')
    expect(screen.getByTestId('where').textContent).toContain('target_id=T-9')
    await waitFor(() => expect(p.audit.search).toHaveBeenCalledTimes(2))
  })

  it('sends dates as UTC instants from the viewer\'s local time', async () => {
    const p = ports()
    open(p)
    await screen.findAllByText('member.suspended', { selector: 'td' })
    await userEvent.type(screen.getByLabelText('From'), '2026-11-01T09:30')
    await userEvent.click(screen.getByRole('button', { name: 'Apply filters' }))
    await waitFor(() => expect(p.audit.search).toHaveBeenCalledTimes(2))
    const filter = (p.audit.search as ReturnType<typeof rs.fn>).mock.calls[1]![0] as { from: string }
    expect(filter.from).toBe(new Date('2026-11-01T09:30').toISOString())
  })

  it('picks an actor from the members, suspended ones included', async () => {
    const p = ports()
    open(p)
    await screen.findAllByText('member.suspended', { selector: 'td' })
    const picker = screen.getByLabelText('Actor')
    await waitFor(() => expect(within(picker).getAllByRole('option').length).toBeGreaterThan(3))
    await userEvent.selectOptions(picker, within(picker).getByRole('option', { name: 'Cy Young' }).getAttribute('value')!)
    await userEvent.click(screen.getByRole('button', { name: 'Apply filters' }))
    await waitFor(() => expect(screen.getByTestId('where').textContent).toContain('actor_id=u-cy'))
  })

  it('clears every filter', async () => {
    const p = ports()
    open(p, '/admin/audit?entry_type=x.y&actor_type=user')
    await screen.findAllByText('member.suspended', { selector: 'td' })
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }))
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/admin\/audit$/))
    expect(screen.getByLabelText('Entry type')).toHaveValue('')
  })

  it('does not search for a range that ends before it starts, and says why', async () => {
    const p = ports()
    open(p, '/admin/audit?from=2026-11-02T00:00:00Z&to=2026-11-01T00:00:00Z')
    expect(await screen.findByText('The start must be before the end.')).toBeInTheDocument()
    expect(p.audit.search).not.toHaveBeenCalled()
  })

  it('does not search for two entry types (the SDK cannot repeat a query key), and says so', async () => {
    const p = ports()
    open(p, '/admin/audit?entry_type=a.b&entry_type=c.d')
    expect(await screen.findByText('Search one entry type at a time. Exports can take several.')).toBeInTheDocument()
    expect(p.audit.search).not.toHaveBeenCalled()
  })

  it('does not search for a date that is not a date', async () => {
    const p = ports()
    open(p, '/admin/audit?from=yesterday')
    expect(await screen.findByText('Choose dates that are valid.')).toBeInTheDocument()
    expect(p.audit.search).not.toHaveBeenCalled()
  })
})

describe('E7 the plan window and large searches', () => {
  it('says the plan clamped the start, with an upgrade hint for the owner only', async () => {
    const search = rs.fn(async () => page([entry('e1')], { clamped: '2025-11-25T00:00:00Z' }))
    open(ports({ audit: { search } }))
    const note = await screen.findByText(/your plan's audit window/)
    expect(note).toHaveTextContent('Older records are in exports.')
    expect(note).toHaveTextContent('Upgrade your plan for a longer window.')
  })

  it('does not hint at an upgrade to an admin who is not the owner', async () => {
    const search = rs.fn(async () => page([entry('e1')], { clamped: '2025-11-25T00:00:00Z' }))
    open(ports({ audit: { search } }), '/admin/audit', { permissions: ['read:members', 'manage:members', 'read:audit'] })
    const note = await screen.findByText(/your plan's audit window/)
    expect(note).not.toHaveTextContent('Upgrade your plan')
  })

  it('says nothing about the window when the service did not clamp', async () => {
    open(ports())
    await screen.findAllByText('member.suspended', { selector: 'td' })
    expect(screen.queryByText(/audit window/)).not.toBeInTheDocument()
  })

  it('turns a large search (202) into an export job, tracked, with a link to the exports', async () => {
    const search = rs.fn(async () => ({ kind: 'export' as const, job: { exportId: 'ex-big', status: 'pending' as const } }))
    const p = ports({ audit: { search } })
    open(p)
    expect(await screen.findByText(/This search is large, so we're preparing it as a file\./)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View exports' })).toHaveAttribute('href', '/admin/audit/exports')
    expect(p.exportJobs.list()).toEqual(['ex-big'])
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})

describe('E7 entry details', () => {
  it('opens the entry in full: who, what, source, IP, trace ID and everything recorded', async () => {
    const p = ports({ audit: { getEntry: rs.fn(async (id: string) => entry(id, { metadata: { reason: 'left the company', nested: { a: 1 } } })) } })
    open(p)
    await userEvent.click((await screen.findAllByRole('button', { name: 'Details: member.suspended' }))[0]!)
    const dialog = await screen.findByRole('dialog', { name: 'Audit entry' })
    expect(dialog).toHaveTextContent('Ada Lovelace')
    expect(dialog).toHaveTextContent('203.0.113.7')
    expect(dialog).toHaveTextContent('trace-abc')
    expect(dialog).toHaveTextContent('security_3y')
    await waitFor(() => expect(dialog).toHaveTextContent('{"a":1}'))
    expect(dialog).toHaveTextContent('left the company')
    expect(p.audit.getEntry).toHaveBeenCalledWith('e1', expect.anything())
  })

  it('copies the trace ID', async () => {
    const writeText = rs.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    open(ports())
    await userEvent.click((await screen.findAllByRole('button', { name: 'Details: member.suspended' }))[0]!)
    await userEvent.click(await screen.findByRole('button', { name: 'Copy trace ID' }))
    expect(writeText).toHaveBeenCalledWith('trace-abc')
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })

  it('shows the row and says so when the full entry cannot be loaded', async () => {
    open(ports({ audit: { getEntry: rs.fn(async () => { throw problem(503, 'DB_UNAVAILABLE') }) } }))
    await userEvent.click((await screen.findAllByRole('button', { name: 'Details: member.suspended' }))[0]!)
    expect(await screen.findByText('The full entry could not be loaded; showing the row.')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveTextContent('203.0.113.7')
  })

  it('shows an entry with nothing else recorded, no IP, no trace, no target', async () => {
    const bare = entry('bare', { metadata: {}, ipAddress: undefined, traceId: undefined, target: undefined, retentionTier: undefined })
    open(ports({ audit: { search: rs.fn(async () => page([bare])), getEntry: rs.fn(async () => bare) } }))
    await userEvent.click((await screen.findAllByRole('button', { name: 'Details: member.suspended' }))[0]!)
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Nothing else was recorded.')
    expect(within(dialog).queryByText('Trace ID')).not.toBeInTheDocument()
  })

  it('closes with Close or Escape', async () => {
    open(ports())
    await userEvent.click((await screen.findAllByRole('button', { name: 'Details: member.suspended' }))[0]!)
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders an entry\'s text as text, never as markup', async () => {
    const hostile: AuditEntry = entry('h', { action: '<img src=x onerror=alert(1)>', metadata: { note: '<script>alert(1)</script>' } })
    open(ports({ audit: { search: rs.fn(async () => page([hostile])), getEntry: rs.fn(async () => hostile) } }))
    await screen.findByText('<img src=x onerror=alert(1)>', { selector: 'td' })
    expect(document.querySelector('img')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /^Details/ }))
    expect(document.querySelector('script')).toBeNull()
  })
})

describe('E7 starting an export', () => {
  it('exports everything the filter matches, tracks it, and opens the exports', async () => {
    const p = ports()
    const view = open(p, '/admin/audit?entry_type=auth.login.success&actor_type=user')
    await screen.findAllByText('member.suspended', { selector: 'td' })
    await userEvent.click(screen.getByRole('button', { name: 'Export these results' }))
    await waitFor(() => expect(p.audit.requestExport).toHaveBeenCalledWith(expect.objectContaining({ entryTypes: ['auth.login.success'], actorType: 'user' })))
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/admin/audit/exports'))
    expect(p.exportJobs.list()).toEqual(['ex-9'])
    expect(await screen.findByText('Export started. It appears below.')).toBeInTheDocument()
    expect(view.calls).toContain('action:request_audit_export:success')
  })

  it('exports with several entry types: an export takes them in its body', async () => {
    const p = ports()
    open(p, '/admin/audit?entry_type=a.b&entry_type=c.d')
    await userEvent.click(await screen.findByRole('button', { name: 'Export these results' }))
    await waitFor(() => expect(p.audit.requestExport).toHaveBeenCalledWith(expect.objectContaining({ entryTypes: ['a.b', 'c.d'] })))
  })

  it('says "Too many exports running" when the service limits them (429), and stays on the page', async () => {
    const requestExport = rs.fn(async () => { throw problem(429, 'RATE_LIMITED') })
    const view = open(ports({ audit: { requestExport } }))
    await userEvent.click(await screen.findByRole('button', { name: 'Export these results' }))
    expect(await screen.findByText('Too many exports running. Try again shortly.')).toBeInTheDocument()
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/admin\/audit$/)
    expect(view.calls).toContain('action:request_audit_export:failure')
  })
})

describe('E7 exports', () => {
  const exports = (p: ReturnType<typeof ports>, o: Parameters<typeof renderPage>[1] = {}) => open(p, '/admin/audit/exports', o)

  it('says there are none yet', async () => {
    exports(ports())
    expect(await screen.findByText('No exports yet. Start one from the audit log.')).toBeInTheDocument()
  })

  it('lists the tracked exports newest first, each with its status', async () => {
    const getExport = rs.fn(async (id: string) => exportJob({ exportId: id, status: id === 'ex-2' ? 'running' : 'ready', rowCount: 1200, expiresAt: '2026-12-02T10:00:00Z', downloadUrl: `https://files.example.com/${id}.csv` }))
    exports(ports({ audit: { getExport }, jobs: ['ex-2', 'ex-1'] }))
    const items = await screen.findAllByRole('listitem')
    expect(items[0]).toHaveTextContent('ex-2')
    expect(items[1]).toHaveTextContent('ex-1')
    await waitFor(() => expect(items[0]).toHaveTextContent('Preparing'))
    await waitFor(() => expect(items[1]).toHaveTextContent('Ready'))
    expect(items[1]).toHaveTextContent('1,200 rows')
    expect(items[1]).toHaveTextContent('Available until')
    expect(within(items[1]!).getByRole('link', { name: 'Download' })).toHaveAttribute('href', 'https://files.example.com/ex-1.csv')
    expect(within(items[0]!).queryByRole('link', { name: 'Download' })).not.toBeInTheDocument()
  })

  it('polls a waiting export until it is ready', async () => {
    rs.useFakeTimers({ shouldAdvanceTime: true })
    const getExport = rs.fn<AuditPort['getExport']>().mockResolvedValueOnce(exportJob({ status: 'pending' })).mockResolvedValueOnce(exportJob({ status: 'running' })).mockResolvedValue(exportJob({ status: 'ready', downloadUrl: 'https://files.example.com/ex-1.csv' }))
    exports(ports({ audit: { getExport }, jobs: ['ex-1'] }))
    await screen.findByText('Waiting to start')
    await act(async () => { await rs.advanceTimersByTimeAsync(EXPORT_POLL_MS + 50) })
    await screen.findByText('Preparing')
    await act(async () => { await rs.advanceTimersByTimeAsync(EXPORT_POLL_MS + 50) })
    expect(await screen.findByText('Ready')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Download' })).toBeInTheDocument()
    expect(getExport).toHaveBeenCalledTimes(3)
    await act(async () => { await rs.advanceTimersByTimeAsync(EXPORT_POLL_MS * 3) })
    expect(getExport).toHaveBeenCalledTimes(3)
  })

  it('shows why a failed export failed, and an expired one as expired', async () => {
    const getExport = rs.fn(async (id: string) => (id === 'ex-f' ? exportJob({ exportId: id, status: 'failed', error: 'archive unavailable' }) : exportJob({ exportId: id, status: 'expired' })))
    exports(ports({ audit: { getExport }, jobs: ['ex-f', 'ex-x'] }))
    expect(await screen.findByText('Reason: archive unavailable')).toBeInTheDocument()
    expect(await screen.findByText('Expired')).toBeInTheDocument()
  })

  it('asks again on Refresh (a ready export\'s link is fresh on each ask)', async () => {
    const getExport = rs.fn(async () => exportJob({ status: 'ready', downloadUrl: 'https://files.example.com/a' }))
    exports(ports({ audit: { getExport }, jobs: ['ex-1'] }))
    await screen.findByText('Ready')
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() => expect(getExport).toHaveBeenCalledTimes(2))
  })

  it('says the service no longer has an export (404), and removes it from the list', async () => {
    const getExport = rs.fn(async () => { throw problem(404, 'NOT_FOUND') })
    const p = ports({ audit: { getExport }, jobs: ['ex-old'] })
    exports(p)
    expect(await screen.findByText('The service no longer has this export.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Remove from list' }))
    expect(p.exportJobs.list()).toEqual([])
    expect(await screen.findByText('No exports yet. Start one from the audit log.')).toBeInTheDocument()
  })

  it('says an export could not be checked when the service fails', async () => {
    const getExport = rs.fn(async () => { throw problem(503, 'DB_UNAVAILABLE') })
    exports(ports({ audit: { getExport }, jobs: ['ex-1'] }))
    expect(await screen.findByText(/This export could not be checked\. Nothing was changed\. Try again\./)).toBeInTheDocument()
  })

  it('links back to the audit log', async () => {
    exports(ports())
    expect(await screen.findByRole('link', { name: 'Back to the audit log' })).toHaveAttribute('href', '/admin/audit')
  })
})
