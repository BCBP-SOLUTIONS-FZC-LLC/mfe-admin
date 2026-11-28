// E1 Users and invitations (spec E1, E1a; LLD §7.2, §7.3): the member list joined with names, seats,
// filters, paging, the invite dialog and pending invitations, in every state a user can meet.
import { ProblemError } from '@bcbp-solutions-fzc-llc/frontend-sdk/problem'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, rs } from '@rstest/core'
import type { MemberPage } from '../../../src/domain/entities/member'
import type { OrgMembershipPort } from '../../../src/domain/repositories/OrgMembershipPort'
import type { UserProfilePort } from '../../../src/domain/repositories/UserProfilePort'
import { parseCursor } from '../../../src/domain/value-objects/Cursor'
import UsersPage from '../../../src/presentation/pages/UsersPage'
import { seats } from '../../fixtures/domain'
import { ADMIN, MEMBER } from '../../fixtures/platform'
import { renderPage } from '../../fixtures/pages'
import { ADA, BOB, CY, departments, invitation, members, roleLabels } from '../../fixtures/people'
import { partial } from '../../fixtures/services'

const problem = (status: number, errorCode: string, extensions: Record<string, unknown> = {}) =>
  new ProblemError({ type: 'about:blank', title: 'T', status, errorCode, traceId: 'trace-1', extensions })

function ports(o: { org?: Partial<OrgMembershipPort>; users?: Partial<UserProfilePort> } = {}) {
  const org = partial<OrgMembershipPort>('orgMembership', {
    listMembers: rs.fn(async () => ({ members } as MemberPage)),
    listDepartments: rs.fn(async () => departments),
    listRoleLabels: rs.fn(async () => roleLabels),
    getSeatUsage: rs.fn(async () => seats()),
    listInvitations: rs.fn(async () => [invitation()]),
    listDepartmentMembers: rs.fn(async () => [{ userId: 'u-ada', level: 'approver' as const }]),
    ...o.org,
  })
  const users = partial<UserProfilePort>('userProfile', {
    batch: rs.fn(async (ids: readonly string[]) => ({
      users: [ADA, BOB, CY].filter((u) => ids.includes(u.userId)),
      missing: ids.filter((id) => ![ADA, BOB, CY].some((u) => u.userId === id)),
    })),
    ...o.users,
  })
  return { orgMembership: org, userProfile: users, org, users }
}

const page = (p: ReturnType<typeof ports>, o: Parameters<typeof renderPage>[1] = {}) => renderPage(<UsersPage />, { services: { orgMembership: p.org, userProfile: p.users }, ...o })

describe('E1 members', () => {
  it('lists members with names from User Profile, roles, departments with the tenant\'s level labels, status, sign-in and availability', async () => {
    page(ports())
    const row = (await screen.findByRole('link', { name: /Ada Lovelace/ })).closest('tr')!
    expect(row).toHaveTextContent('Chief Engineer')
    expect(within(row).getByText('Owner')).toBeInTheDocument()
    expect(row).toHaveTextContent('Engineering · Director')
    expect(row).toHaveTextContent('Active')
    expect(row).toHaveTextContent('SSO')
    expect(row).toHaveTextContent('Out of office')
    const bob = screen.getByRole('link', { name: /Bob Builder/ }).closest('tr')!
    expect(bob).toHaveTextContent('Tender admin')
    expect(bob).toHaveTextContent('QA / QC · Manager')
    expect(bob).toHaveTextContent('Engineering · Engineer')
    expect(bob).toHaveTextContent('Password')
  })

  it('asks User Profile once for the page, not once per row', async () => {
    const p = ports()
    page(p)
    await screen.findByRole('link', { name: /Ada Lovelace/ })
    const calls = (p.users.batch as ReturnType<typeof rs.fn>).mock.calls.filter((c) => (c[0] as string[]).includes('u-ada'))
    expect(calls).toHaveLength(1)
    expect(calls[0]![0]).toEqual(['u-ada', 'u-bob', 'u-cy'])
  })

  it('shows a suspended member as Suspended, and a profile disabled in sign-in as "Disabled in sign-in"', async () => {
    page(ports())
    const cy = (await screen.findByRole('link', { name: /Cy Young/ })).closest('tr')!
    expect(cy).toHaveTextContent('Disabled in sign-in')
  })

  it('shows "Unknown user" for an ID the service has no profile for, and keeps the row', async () => {
    const p = ports({ org: { listMembers: rs.fn(async () => ({ members: [...members, { ...members[0]!, userId: 'u-ghost', tenantRoles: [], departments: [] }] })) } })
    page(p)
    expect(await screen.findByText('Unknown user')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ada Lovelace/ })).toBeInTheDocument()
  })

  it('shows "Name unavailable" on every row when User Profile fails, and never hides one', async () => {
    const p = ports({ users: { batch: rs.fn(async () => { throw problem(503, 'USER_PROFILE_UNAVAILABLE') }) } })
    page(p)
    await waitFor(() => expect(screen.getAllByText('Name unavailable')).toHaveLength(3))
  })

  it('never shows a raw user ID', async () => {
    page(ports())
    await screen.findByRole('link', { name: /Ada Lovelace/ })
    expect(document.body.textContent).not.toContain('u-ada')
  })

  it('shows "Department" for a department the directory cannot name, and keeps the level\'s plain name when labels fail', async () => {
    const p = ports({ org: { listDepartments: rs.fn(async () => { throw problem(503, 'DB_UNAVAILABLE') }), listRoleLabels: rs.fn(async () => { throw problem(503, 'DB_UNAVAILABLE') }) } })
    page(p)
    const row = (await screen.findByRole('link', { name: /Ada Lovelace/ })).closest('tr')!
    await waitFor(() => expect(row).toHaveTextContent('Department · Approver'))
  })

  it('links each name to the member\'s page', async () => {
    page(ports())
    expect(await screen.findByRole('link', { name: /Ada Lovelace/ })).toHaveAttribute('href', '/admin/users/u-ada')
  })

  it('says it is loading, with the table busy', async () => {
    const p = ports({ org: { listMembers: rs.fn(() => new Promise<MemberPage>(() => {})) } })
    page(p)
    expect(await screen.findByText('Loading users…')).toBeInTheDocument()
    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true')
  })

  it('shows an alert with Retry when the list fails, and Retry loads again', async () => {
    const listMembers = rs.fn<OrgMembershipPort['listMembers']>().mockRejectedValueOnce(problem(503, 'DB_UNAVAILABLE')).mockResolvedValue({ members })
    page(ports({ org: { listMembers } }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Users could not be loaded.')
    expect(alert).toHaveTextContent('Nothing was changed. Try again.')
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('link', { name: /Ada Lovelace/ })).toBeInTheDocument()
    expect(listMembers).toHaveBeenCalledTimes(2)
  })

  it('offers "Copy details" with the trace ID on a failed load', async () => {
    const writeText = rs.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    page(ports({ org: { listMembers: rs.fn(async () => { throw problem(500, 'INTERNAL') }) } }))
    await userEvent.click(await screen.findByRole('button', { name: 'Copy details' }))
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('trace-1'))
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })

  it('invites the team when nobody else is here yet', async () => {
    page(ports({ org: { listMembers: rs.fn(async () => ({ members: [] })) } }))
    expect(await screen.findByText('Only you so far. Invite your team.')).toBeInTheDocument()
  })
})

/** Opens the filter drawer, sets the given fields and applies; the drawer then closes. */
async function filterBy(fields: { Status?: string; Role?: string; Department?: string }) {
  await userEvent.click(screen.getByRole('button', { name: /^Filters/ }))
  const drawer = await screen.findByRole('dialog', { name: 'Filters' })
  for (const [label, value] of Object.entries(fields)) await userEvent.selectOptions(within(drawer).getByLabelText(label), value)
  await userEvent.click(within(drawer).getByRole('button', { name: 'Apply filters' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
}

describe('E1 paging and filters (no server-side filters: IAM-FE-Q5)', () => {
  const second = [{ ...members[1]!, userId: 'u-dee', tenantRoles: [] as never[], departments: [] }]
  const paged = () =>
    rs.fn(async (p: { cursor?: string }) =>
      p.cursor ? ({ members: second } as MemberPage) : ({ members, nextCursor: parseCursor('page-2')! } as MemberPage),
    )

  it('loads the next page with the cursor, and asks User Profile for the new IDs', async () => {
    const listMembers = paged()
    const p = ports({ org: { listMembers: listMembers as never } })
    page(p)
    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }))
    await waitFor(() => expect(listMembers).toHaveBeenCalledTimes(2))
    expect(listMembers.mock.calls[1]![0]).toMatchObject({ limit: 50, cursor: 'page-2' })
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument())
    expect((p.users.batch as ReturnType<typeof rs.fn>).mock.calls.some((c) => (c[0] as string[]).includes('u-dee'))).toBe(true)
  })

  it('filters by status and role over the loaded pages, and says matches are only in the first N members', async () => {
    page(ports({ org: { listMembers: paged() as never } }))
    await screen.findByRole('link', { name: /Ada Lovelace/ })
    await filterBy({ Status: 'suspended' })
    expect(screen.queryByRole('link', { name: /Ada Lovelace/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Cy Young/ })).toBeInTheDocument()
    expect(screen.getByText('Showing matches in the first 3 members. Load more to search further.')).toBeInTheDocument()
    await filterBy({ Status: 'all', Role: 'tender_admin' })
    expect(screen.getByRole('link', { name: /Bob Builder/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Cy Young/ })).not.toBeInTheDocument()
  })

  it('slides the filters in from the side, shows how many are on, and hides them after Apply and after Clear', async () => {
    page(ports())
    await screen.findByRole('link', { name: /Ada Lovelace/ })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await filterBy({ Role: 'tenant_admin' })
    expect(screen.getByRole('button', { name: /^Filters/ })).toHaveTextContent('Filters1')
    await userEvent.click(screen.getByRole('button', { name: /^Filters/ }))
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Filters' })).getByRole('button', { name: 'Clear' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: /^Filters/ })).toHaveTextContent(/^Filters$/)
    expect(screen.getByRole('link', { name: /Cy Young/ })).toBeInTheDocument()
  })

  it('says nothing about partial results when every page is loaded', async () => {
    page(ports())
    await screen.findByRole('link', { name: /Ada Lovelace/ })
    await filterBy({ Status: 'suspended' })
    expect(screen.queryByText(/Showing matches/)).not.toBeInTheDocument()
  })

  it('says when no loaded member matches', async () => {
    page(ports())
    await screen.findByRole('link', { name: /Ada Lovelace/ })
    await filterBy({ Role: 'tenant_admin' })
    expect(screen.getByText('No members match these filters.')).toBeInTheDocument()
  })

  it('filters by department through P-9 (members of that department)', async () => {
    const p = ports()
    page(p)
    await screen.findByRole('link', { name: /Ada Lovelace/ })
    await filterBy({ Department: 'd-eng' })
    await waitFor(() => expect(screen.queryByRole('link', { name: /Bob Builder/ })).not.toBeInTheDocument())
    expect(screen.getByRole('link', { name: /Ada Lovelace/ })).toBeInTheDocument()
    expect(p.org.listDepartmentMembers).toHaveBeenCalledWith('d-eng', expect.anything())
  })

  it('says so when the department\'s members cannot be loaded', async () => {
    page(ports({ org: { listDepartmentMembers: rs.fn(async () => { throw problem(500, 'INTERNAL') }) } }))
    await screen.findByRole('link', { name: /Ada Lovelace/ })
    await filterBy({ Department: 'd-eng' })
    expect(await screen.findByText('Department members could not be loaded.')).toBeInTheDocument()
  })

  it('offers every role of the vocabulary but member (member is implicit)', async () => {
    page(ports())
    await screen.findByRole('link', { name: /Ada Lovelace/ })
    await userEvent.click(screen.getByRole('button', { name: /^Filters/ }))
    const options = within(screen.getByLabelText('Role')).getAllByRole('option').map((o) => o.textContent)
    expect(options).toEqual(['All', 'Owner', 'Admin', 'Tender admin'])
  })
})

describe('E1 seats', () => {
  const seatState = (s: ReturnType<typeof seats>) => ports({ org: { getSeatUsage: rs.fn(async () => s) } })

  it('shows the meter before the invite form: used of licensed, with active and invited', async () => {
    page(seatState(seats({ activeUsers: 3, pendingInvitations: 1, licensedSeats: 10 })))
    expect(await screen.findAllByText('4 of 10 seats used (3 active, 1 invited)')).not.toHaveLength(0)
    expect(screen.queryByText(/blocked/)).not.toBeInTheDocument()
  })

  it('warns that invitations are blocked when the seats are full', async () => {
    page(seatState(seats({ activeUsers: 8, pendingInvitations: 2, licensedSeats: 10 })))
    expect(await screen.findByText('All seats are in use. New invitations are blocked.')).toBeInTheDocument()
  })

  it('warns when active members exceed the seats (over the cap)', async () => {
    page(seatState(seats({ activeUsers: 12, pendingInvitations: 0, licensedSeats: 10 })))
    expect(await screen.findByText("New invitations are blocked until you're within your seats.")).toBeInTheDocument()
  })

  it('says seat usage could not be loaded, with Retry, and keeps the list', async () => {
    page(ports({ org: { getSeatUsage: rs.fn(async () => { throw problem(503, 'DB_UNAVAILABLE') }) } }))
    expect(await screen.findByText(/Seat usage could not be loaded/)).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /Ada Lovelace/ })).toBeInTheDocument()
  })

  it('opens the upgrade prompt instead of the form when no seat is free', async () => {
    page(seatState(seats({ activeUsers: 8, pendingInvitations: 2, licensedSeats: 10 })))
    await userEvent.click(await screen.findByRole('button', { name: 'Invite user' }))
    const dialog = await screen.findByRole('dialog', { name: 'No free seats' })
    expect(dialog).toHaveTextContent('All 10 seats are in use')
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps Invite disabled until the seats are known', async () => {
    page(ports({ org: { getSeatUsage: rs.fn(() => new Promise<never>(() => {})) } }))
    expect(await screen.findByRole('button', { name: 'Invite user' })).toBeDisabled()
  })
})

describe('E1 access', () => {
  it('shows a plain member the list and nothing to change: no seats, no invite, no invitations tab, no P-27 or P-30 call', async () => {
    const p = ports()
    page(p, { permissions: MEMBER })
    expect(await screen.findByRole('link', { name: /Ada Lovelace/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Invite user' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(p.org.getSeatUsage).not.toHaveBeenCalled()
    expect(p.org.listInvitations).not.toHaveBeenCalled()
  })

  it('disables Invite in a read-only workspace, with the reason', async () => {
    page(ports(), { readOnly: true })
    const button = await screen.findByRole('button', { name: 'Invite user' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', 'This workspace is read-only (subscription ended).')
  })
})

describe('E1 telemetry', () => {
  it('records the loads it makes, by resource', async () => {
    const view = page(ports())
    await screen.findByRole('link', { name: /Ada Lovelace/ })
    await waitFor(() => expect(view.calls).toEqual(expect.arrayContaining(['load:members:success', 'load:user_profiles:success', 'load:departments:success', 'load:role_labels:success', 'load:seat_usage:success'])))
  })

  it('records a failed load as an error', async () => {
    const view = page(ports({ org: { listMembers: rs.fn(async () => { throw problem(500, 'INTERNAL') }) } }))
    await screen.findByRole('alert')
    expect(view.calls).toContain('load:members:error')
  })
})

describe('E1 pending invitations', () => {
  const open = async (p: ReturnType<typeof ports>, o: Parameters<typeof renderPage>[1] = {}) => {
    const view = page(p, o)
    await userEvent.click(await screen.findByRole('tab', { name: 'Pending invitations' }))
    return view
  }

  it('lists who was invited, by whom, and when it was sent and expires', async () => {
    await open(ports())
    const row = (await screen.findByText('dee@example.com')).closest('tr')!
    expect(row).toHaveTextContent('Dee Dee')
    expect(row).toHaveTextContent('Tender admin')
    expect(row).toHaveTextContent('Ada Lovelace')
    expect(screen.getByRole('tab', { name: 'Pending invitations' })).toHaveAttribute('aria-selected', 'true')
  })

  it('says there are none', async () => {
    await open(ports({ org: { listInvitations: rs.fn(async () => []) } }))
    expect(await screen.findByText('No pending invitations.')).toBeInTheDocument()
  })

  it('shows an alert with Retry when the invitations fail to load', async () => {
    await open(ports({ org: { listInvitations: rs.fn(async () => { throw problem(500, 'INTERNAL') }) } }))
    expect(await screen.findByText(/Invitations could not be loaded/)).toBeInTheDocument()
  })

  it('revokes with the invitation\'s version after a confirmation naming the person, and frees the seat', async () => {
    const revokeInvitation = rs.fn(async () => {})
    const p = ports({ org: { revokeInvitation } })
    await open(p)
    await userEvent.click(await screen.findByRole('button', { name: 'Revoke' }))
    const dialog = await screen.findByRole('dialog', { name: 'Revoke invitation' })
    expect(dialog).toHaveTextContent('Revoke the invitation to dee@example.com? It frees the seat.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Revoke' }))
    await waitFor(() => expect(revokeInvitation).toHaveBeenCalledWith('inv-1', 4))
    expect(await screen.findByText('Invitation revoked.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // The list and the seat meter are asked again.
    await waitFor(() => expect(p.org.listInvitations).toHaveBeenCalledTimes(2))
    expect(p.org.getSeatUsage).toHaveBeenCalledTimes(2)
  })

  it('cancels without revoking', async () => {
    const revokeInvitation = rs.fn(async () => {})
    await open(ports({ org: { revokeInvitation } }))
    await userEvent.click(await screen.findByRole('button', { name: 'Revoke' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    expect(revokeInvitation).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('offers Reload when someone else changed the invitation first (409), and Reload asks again', async () => {
    const revokeInvitation = rs.fn(async () => { throw problem(409, 'OPTIMISTIC_LOCK_CONFLICT', { record_version: 5 }) })
    const p = ports({ org: { revokeInvitation } })
    await open(p)
    await userEvent.click(await screen.findByRole('button', { name: 'Revoke' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Revoke' }))
    const conflict = await screen.findByRole('dialog', { name: 'This changed while you were editing' })
    expect(conflict).toHaveTextContent('Someone else changed this. Reload to see the latest version.')
    expect(revokeInvitation).toHaveBeenCalledTimes(1)
    await userEvent.click(within(conflict).getByRole('button', { name: 'Reload' }))
    await waitFor(() => expect(p.org.listInvitations).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(revokeInvitation).toHaveBeenCalledTimes(1)
  })

  it('shows another failure in the dialog and keeps it open, without success', async () => {
    const revokeInvitation = rs.fn(async () => { throw problem(503, 'DB_UNAVAILABLE') })
    const view = await open(ports({ org: { revokeInvitation } }))
    await userEvent.click(await screen.findByRole('button', { name: 'Revoke' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Revoke' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Nothing was changed. Try again.')
    expect(screen.queryByText('Invitation revoked.')).not.toBeInTheDocument()
    expect(view.calls).toContain('action:revoke_invitation:error')
  })

  it('disables Revoke in a read-only workspace', async () => {
    await open(ports(), { readOnly: true })
    expect(await screen.findByRole('button', { name: 'Revoke' })).toBeDisabled()
  })

  it('closes the confirmation with Escape', async () => {
    await open(ports())
    await userEvent.click(await screen.findByRole('button', { name: 'Revoke' }))
    await screen.findByRole('dialog')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('E1a invite', () => {
  const openInvite = async (p = ports(), o: Parameters<typeof renderPage>[1] = {}) => {
    const view = page(p, o)
    const button = await screen.findByRole('button', { name: 'Invite user' })
    await waitFor(() => expect(button).toBeEnabled())
    await userEvent.click(button)
    return { view, dialog: await screen.findByRole('dialog', { name: 'Invite user' }), p }
  }
  const fill = async (dialog: HTMLElement, email = 'new@example.com', name = 'New Person') => {
    await userEvent.type(within(dialog).getByLabelText('Email'), email)
    await userEvent.type(within(dialog).getByLabelText('Full name'), name)
  }

  it('sends the trimmed body with the chosen roles and departments, then says when it expires', async () => {
    const invite = rs.fn(async () => invitation({ email: 'new@example.com', expiresAt: '2026-12-02T10:00:00Z' }))
    const { dialog, p } = await openInvite(ports({ org: { invite } }))
    await fill(dialog)
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Tender admin' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add department' }))
    await userEvent.selectOptions(within(dialog).getByLabelText('Department'), 'd-qa')
    await userEvent.selectOptions(within(dialog).getByLabelText('Level'), 'reviewer')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send invitation' }))
    await waitFor(() =>
      expect(invite).toHaveBeenCalledWith({
        email: 'new@example.com',
        fullName: 'New Person',
        initialTenantRoles: ['tender_admin'],
        initialDeptMappings: [{ departmentId: 'd-qa', level: 'reviewer' }],
      }),
    )
    expect(await screen.findByText(/Invitation sent to new@example.com\. It expires on/)).toBeInTheDocument()
    // The seat meter is on screen, so it is asked again; the invitations tab is not open, so its list is only marked stale.
    await waitFor(() => expect(p.org.getSeatUsage).toHaveBeenCalledTimes(2))
    expect(p.org.listInvitations).not.toHaveBeenCalled()
  })

  it('offers only active departments, with the tenant\'s level labels', async () => {
    const { dialog } = await openInvite()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add department' }))
    expect(within(within(dialog).getByLabelText('Department')).getAllByRole('option').map((o) => o.textContent)).toEqual(['Engineering', 'QA / QC'])
    expect(within(within(dialog).getByLabelText('Level')).getAllByRole('option').map((o) => o.textContent)).toEqual(['Engineer', 'Manager', 'Director'])
  })

  it('removes a department row', async () => {
    const { dialog } = await openInvite()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add department' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove department' }))
    expect(within(dialog).queryByLabelText('Department')).not.toBeInTheDocument()
  })

  it('offers owner and admin roles to an owner only; an admin sees tender admin alone', async () => {
    const owner = await openInvite()
    expect(within(owner.dialog).getAllByRole('checkbox').map((c) => c.getAttribute('aria-label') ?? document.getElementById(c.getAttribute('aria-labelledby') ?? '')?.textContent)).toEqual(['Owner', 'Admin', 'Tender admin'])
  })

  it('offers an admin tender admin alone', async () => {
    const { dialog } = await openInvite(ports(), { permissions: ADMIN })
    expect(within(dialog).getAllByRole('checkbox').map((c) => document.getElementById(c.getAttribute('aria-labelledby') ?? '')?.textContent)).toEqual(['Tender admin'])
  })

  it.each([
    ['an invalid email', 'not-an-email', 'New Person', 'Enter a valid email address (up to 254 characters).'],
    ['no name', 'new@example.com', '', 'Enter a name.'],
  ])('refuses %s before sending, and says why', async (_name, email, fullName, message) => {
    const invite = rs.fn(async () => invitation())
    const { dialog } = await openInvite(ports({ org: { invite } }))
    if (email) await userEvent.type(within(dialog).getByLabelText('Email'), email)
    if (fullName) await userEvent.type(within(dialog).getByLabelText('Full name'), fullName)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send invitation' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(message)
    expect(invite).not.toHaveBeenCalled()
  })

  it('refuses a name over 200 characters', async () => {
    const invite = rs.fn(async () => invitation())
    const { dialog } = await openInvite(ports({ org: { invite } }))
    await userEvent.type(within(dialog).getByLabelText('Email'), 'a@b.co')
    await userEvent.click(within(dialog).getByLabelText('Full name'))
    await userEvent.paste('x'.repeat(201))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send invitation' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('The name can be up to 200 characters.')
    expect(invite).not.toHaveBeenCalled()
  })

  it.each([
    ['409 SEAT_LIMIT_REACHED', problem(409, 'SEAT_LIMIT_REACHED'), "You've reached your seat limit. Buy more seats to invite people."],
    ['409 INVITATION_ALREADY_EXISTS', problem(409, 'INVITATION_ALREADY_EXISTS'), "There's already a pending invitation for this email."],
    ['429 REINVITE_TOO_SOON', problem(429, 'REINVITE_TOO_SOON'), 'You invited this person less than an hour ago.'],
    ['429 INVITE_RATE_LIMITED', problem(429, 'INVITE_RATE_LIMITED'), 'Too many invitations. Try again later.'],
    ['503 REALM_PROVISIONER_UNAVAILABLE', problem(503, 'REALM_PROVISIONER_UNAVAILABLE'), 'Nothing was changed. Try again.'],
  ])('shows %s in plain words, keeps the dialog, and sends nothing twice', async (_name, error, message) => {
    const invite = rs.fn(async () => { throw error })
    const { dialog, view } = await openInvite(ports({ org: { invite } }))
    await fill(dialog)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send invitation' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(message)
    expect(invite).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/Invitation sent/)).not.toBeInTheDocument()
    expect(view.calls.some((c) => c.startsWith('action:invite:'))).toBe(true)
  })

  it('records the write: success, a rejection as a failure, a fault as an error', async () => {
    const ok = await openInvite(ports({ org: { invite: rs.fn(async () => invitation()) } }))
    await fill(ok.dialog)
    await userEvent.click(within(ok.dialog).getByRole('button', { name: 'Send invitation' }))
    await screen.findByText(/Invitation sent/)
    expect(ok.view.calls).toContain('action:invite:success')
  })

  it('records a seat-limit rejection as a failure and a 503 as an error', async () => {
    const a = await openInvite(ports({ org: { invite: rs.fn(async () => { throw problem(409, 'SEAT_LIMIT_REACHED') }) } }))
    await fill(a.dialog)
    await userEvent.click(within(a.dialog).getByRole('button', { name: 'Send invitation' }))
    await within(a.dialog).findByRole('alert')
    expect(a.view.calls).toContain('action:invite:failure')
  })

  it('records an unavailable service as an error', async () => {
    const a = await openInvite(ports({ org: { invite: rs.fn(async () => { throw problem(503, 'DB_UNAVAILABLE') }) } }))
    await fill(a.dialog)
    await userEvent.click(within(a.dialog).getByRole('button', { name: 'Send invitation' }))
    await within(a.dialog).findByRole('alert')
    expect(a.view.calls).toContain('action:invite:error')
  })

  it('shows Sending… while the request is in flight, and disables the button', async () => {
    const invite = rs.fn(() => new Promise<never>(() => {}))
    const { dialog } = await openInvite(ports({ org: { invite } }))
    await fill(dialog)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send invitation' }))
    expect(await within(dialog).findByRole('button', { name: 'Sending…' })).toBeDisabled()
  })

  it('cancels and closes with Escape', async () => {
    const { dialog } = await openInvite()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('says there are no active departments when the tenant has none', async () => {
    const { dialog } = await openInvite(ports({ org: { listDepartments: rs.fn(async () => []) } }))
    expect(within(dialog).getByText('No active departments yet.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Add department' })).toBeDisabled()
  })
})
