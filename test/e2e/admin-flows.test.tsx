// The flows LLD §14 names, through the whole App against a fake IAM at the HTTP level: the adapters,
// the mappers, the cache, the router and the screens together, moving between screens the way a user does.
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core'
import { createFakeIam, type FakeIam } from '../fixtures/fakeIam'
import { openApp } from '../fixtures/app'
import { EXPORT_POLL_MS } from '../../src/presentation/features/audit/useAudit'
import { REALM_SYNC_POLL_MS } from '../../src/presentation/features/settings/useSettings'

let iam: FakeIam

beforeEach(() => {
  iam = createFakeIam()
  iam.install()
})
afterEach(() => {
  rs.useRealTimers()
  rs.unstubAllGlobals()
})

// web-shell's sidebar draws the section links and moves the URL; the remote's router follows it (popstate).
const SECTION_PATHS: Record<string, string> = { Users: 'users', Departments: 'departments', 'Group mappings': 'group-mappings', Settings: 'settings', 'Audit log': 'audit' }
const nav = async (name: string) =>
  act(() => {
    window.history.pushState({}, '', `/t/acme/admin/${SECTION_PATHS[name]}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
const heading = (name: string) => screen.findByRole('heading', { name }, { timeout: 4000 })
const requests = (re: RegExp) => iam.requests().filter((r) => re.test(r))

describe('invite with the seat limit', () => {
  it('invites until the seats are full, gets the upgrade prompt, and invites again after revoking one', async () => {
    iam.state.tenant['licensed_seats'] = 4 // three members and one free seat
    openApp()
    await screen.findByText('3 of 4 seats used (3 active, 0 invited)', undefined, { timeout: 4000 })

    // First invitation takes the last seat.
    await userEvent.click(await screen.findByRole('button', { name: 'Invite user' }))
    let dialog = await screen.findByRole('dialog', { name: 'Invite user' })
    await userEvent.type(within(dialog).getByLabelText('Email'), 'dee@example.com')
    await userEvent.type(within(dialog).getByLabelText('Full name'), 'Dee Dee')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send invitation' }))
    expect(await within(dialog).findByText(/Invitation sent to dee@example.com/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(await screen.findByText('All seats are in use. New invitations are blocked.')).toBeInTheDocument()

    // The seat meter comes before the form: no free seat, so the upgrade prompt opens instead.
    await userEvent.click(screen.getByRole('button', { name: 'Invite user' }))
    expect(await screen.findByRole('dialog', { name: 'No free seats' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }))

    // Revoking the pending invitation frees the seat.
    await userEvent.click(screen.getByRole('tab', { name: 'Pending invitations' }))
    expect(await screen.findByText('dee@example.com')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Revoke' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Revoke' }))
    expect(await screen.findByText('Invitation revoked.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Members' }))
    await screen.findByText('3 of 4 seats used (3 active, 0 invited)')
    await userEvent.click(screen.getByRole('button', { name: 'Invite user' }))
    dialog = await screen.findByRole('dialog', { name: 'Invite user' })
    expect(within(dialog).getByLabelText('Email')).toBeInTheDocument()
  })

  it('shows the service\'s refusal when someone else took the last seat first (409 after the form was opened)', async () => {
    openApp()
    await userEvent.click(await screen.findByRole('button', { name: 'Invite user' }))
    const dialog = await screen.findByRole('dialog', { name: 'Invite user' })
    await userEvent.type(within(dialog).getByLabelText('Email'), 'late@example.com')
    await userEvent.type(within(dialog).getByLabelText('Full name'), 'Late Comer')
    iam.failNext(/POST .*\/members$/, 409, 'SEAT_LIMIT_REACHED')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send invitation' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent("You've reached your seat limit. Buy more seats to invite people.")
    expect(requests(/POST .*\/members$/)).toHaveLength(1)
    expect(iam.state.invitations).toHaveLength(0)
  })
})

describe('role change with the last owner', () => {
  it('refuses taking owner from the only owner, then allows it once another owner exists', async () => {
    openApp()
    await userEvent.click(await screen.findByRole('link', { name: /Ada Lovelace/ }))
    await heading('Ada Lovelace')
    await waitFor(() => expect(requests(/GET .*\/members$/).length).toBeGreaterThan(1)) // the owner count walks the member list, after the users list
    await userEvent.click(screen.getByRole('checkbox', { name: 'Owner' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save roles' }))
    expect(await screen.findByText('A workspace must keep at least one owner.')).toBeInTheDocument()
    expect(requests(/PUT .*\/roles$/)).toHaveLength(0)

    // Make Bob an owner, then Ada may step down.
    await nav('Users')
    await userEvent.click(await screen.findByRole('link', { name: /Bob Builder/ }))
    await heading('Bob Builder')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Owner' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save roles' }))
    expect(await screen.findByText('Roles saved.')).toBeInTheDocument()
    expect(iam.state.members.find((m) => m.user_id === 'u-bob')!.tenant_roles).toEqual(['tenant_owner', 'tender_admin'])

    await nav('Users')
    await userEvent.click(await screen.findByRole('link', { name: /Ada Lovelace/ }))
    await heading('Ada Lovelace')
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Owner' })).toBeChecked())
    await userEvent.click(screen.getByRole('checkbox', { name: 'Owner' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save roles' }))
    expect(await screen.findByText('Roles saved.')).toBeInTheDocument()
    expect(iam.state.members.find((m) => m.user_id === 'u-ada')!.tenant_roles).toEqual([])
  })
})

describe('remove with a 409 resolution and an automatic re-send', () => {
  it('asks what to do with covered work, resolves it, re-sends the removal, and returns to the list', async () => {
    iam.state.covering.add('u-bob')
    openApp()
    await userEvent.click(await screen.findByRole('link', { name: /Bob Builder/ }))
    await heading('Bob Builder')
    await userEvent.click(screen.getByRole('button', { name: 'Remove from workspace' }))
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Remove Bob Builder?' })).getByRole('button', { name: 'Remove from workspace' }))

    const resolution = await screen.findByRole('dialog', { name: "Bob Builder is covering other people's work" })
    expect(resolution).toHaveTextContent('2 workflows')
    const picker = within(resolution).getByLabelText('New cover')
    await userEvent.selectOptions(picker, await within(resolution).findByRole('option', { name: 'Cy Young' }))
    await userEvent.click(within(resolution).getByRole('button', { name: 'Apply and continue' }))

    expect(await screen.findByText('Bob Builder was removed.')).toBeInTheDocument()
    expect(await heading('Users')).toBeInTheDocument()
    // The removal was sent, refused, resolved, and sent again, in that order, with the choice in the body.
    expect(requests(/(DELETE .*\/members\/u-bob|POST .*removal-resolution)/)).toEqual([
      'DELETE /api/v1/tenants/tenant-1/members/u-bob',
      'POST /api/v1/tenants/tenant-1/users/u-bob/removal-resolution',
      'DELETE /api/v1/tenants/tenant-1/members/u-bob',
    ])
    expect(iam.calls.find((c) => c.path.endsWith('removal-resolution'))!.body).toEqual({ action: 'replace_delegate', replacement_user_id: 'u-cy' })
    expect(iam.state.members.map((m) => m.user_id)).toEqual(['u-ada', 'u-cy'])
    await waitFor(() => expect(screen.queryByRole('link', { name: /Bob Builder/ })).not.toBeInTheDocument())
  })

  it('does the same for a demotion in a department, staying on the member\'s page', async () => {
    iam.state.covering.add('u-bob')
    openApp()
    await userEvent.click(await screen.findByRole('link', { name: /Bob Builder/ }))
    await heading('Bob Builder')
    await userEvent.selectOptions(await screen.findByLabelText(/Change level: QA/), 'preparator')
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirm' }))
    const resolution = await screen.findByRole('dialog', { name: /covering other people/ })
    await userEvent.click(within(resolution).getByRole('radio', { name: 'Stop those workflows' }))
    await userEvent.click(within(resolution).getByRole('button', { name: 'Apply and continue' }))
    await waitFor(() => expect(iam.state.members.find((m) => m.user_id === 'u-bob')!.departments[0]!.level).toBe('preparator'))
    expect(requests(/PUT .*departments\/d-qa\/members\/u-bob/)).toHaveLength(2)
    expect(screen.getByRole('heading', { name: 'Bob Builder' })).toBeInTheDocument()
  })
})

describe('group mappings: the two-write partial failure', () => {
  it('says the departments were saved when the levels write fails, and retries only the rest', async () => {
    openApp()
    await nav('Group mappings')
    const card = within((await heading('Groups to departments')).closest('section')!)
    await card.findByLabelText('Group name 1')
    await userEvent.selectOptions(card.getByLabelText('Level 1'), 'approver')
    // The SDK retries an idempotent PUT that gets a 503 twice, so the outage lasts for all three of its attempts.
    iam.failNext(/PUT .*department-roles$/, 503, 'DB_UNAVAILABLE', {}, 3)
    await userEvent.click(card.getByRole('button', { name: 'Save department mappings' }))
    const alert = await card.findByRole('alert', undefined, { timeout: 8000 })
    expect(alert).toHaveTextContent('The departments were saved, but the levels were not.')
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry the rest' }))
        expect(await within((await heading('Groups to departments')).closest('section')!).findByText('Department mappings saved.', undefined, { timeout: 8000 })).toBeInTheDocument()
    // The departments were written once and never again; only the levels were sent more than once.
    expect(requests(/PUT .*group-mappings\/departments$/)).toHaveLength(1)
    expect(requests(/PUT .*department-roles$/).length).toBeGreaterThan(1)
    expect(requests(/PUT .*group-mappings/)[0]).toBe('PUT /api/v1/tenants/tenant-1/group-mappings/departments')
    expect(iam.state.mappings.levels).toEqual([{ keycloak_group_name: 'eng', role_code: 'approver' }])
  })

  it('shows a trial workspace that SSO comes after an upgrade, without asking for the mappings', async () => {
    iam.state.tenant['status'] = 'trial'
    openApp()
    await nav('Group mappings')
    expect(await screen.findByText('SSO is available after you upgrade.')).toBeInTheDocument()
    expect(requests(/group-mappings/)).toHaveLength(0)
  })
})

describe('a settings save that is still applying (202)', () => {
  it('says "Saving to sign-in settings…" and watches until the sign-in part is done', async () => {
    rs.useFakeTimers({ shouldAdvanceTime: true })
    iam.state.realmPendingReads = 3 // the save's own refetch and one poll still say pending
    openApp()
    await nav('Settings')
    const name = await screen.findByLabelText('Workspace name', undefined, { timeout: 4000 })
    await waitFor(() => expect(name).toHaveValue('Acme'))
    await userEvent.clear(name)
    await userEvent.type(name, 'Acme Ltd')
    await userEvent.click(screen.getByRole('button', { name: 'Save workspace' }))
    expect(await screen.findByText('Saving to sign-in settings…')).toBeInTheDocument()
    for (let i = 0; i < 3 && screen.queryByText('Saving to sign-in settings…'); i++) {
      await act(async () => {
        await rs.advanceTimersByTimeAsync(REALM_SYNC_POLL_MS + 100)
      })
    }
    await waitFor(() => expect(screen.queryByText('Saving to sign-in settings…')).not.toBeInTheDocument())
    expect(iam.state.tenant['name']).toBe('Acme Ltd')
    expect((await screen.findByLabelText('Workspace name')) as HTMLInputElement).toHaveValue('Acme Ltd')
  })
})

describe('the audit log: a large search becomes an export, polled to the end', () => {
  it('turns a large search (202) into a tracked export that is polled until it is ready', async () => {
    rs.useFakeTimers({ shouldAdvanceTime: true })
    iam.state.largeSearch = true
    openApp()
    await nav('Audit log')
    expect(await screen.findByText(/This search is large, so we're preparing it as a file\./, undefined, { timeout: 4000 })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'View exports' }))
    expect(await screen.findByText('ex-large', undefined, { timeout: 4000 })).toBeInTheDocument()
    await screen.findByText('Waiting to start')
    for (let i = 0; i < 2; i++) {
      await act(async () => {
        await rs.advanceTimersByTimeAsync(EXPORT_POLL_MS + 100)
      })
    }
    expect(await screen.findByText('Ready')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute('href', 'https://files.example.com/ex-large.csv')
    expect(screen.getByText('12 rows')).toBeInTheDocument()
    expect(requests(/GET .*audit\/exports\/ex-large/)).toHaveLength(3)
  })

  it('starts an export from the results, opens the exports, and follows it', async () => {
    openApp('/t/acme/admin/audit?entry_type=membership.suspended')
    await userEvent.click(await screen.findByRole('button', { name: 'Export these results' }))
    expect(await screen.findByText('Export started. It appears below.', undefined, { timeout: 4000 })).toBeInTheDocument()
    expect(await screen.findByText('ex-1')).toBeInTheDocument()
    expect(iam.calls.find((c) => c.method === 'POST' && c.path.endsWith('audit/exports'))!.body).toEqual({ entry_type: ['membership.suspended'] })
  })

  it('searches, opens an entry, and shows who did what', async () => {
    openApp('/t/acme/admin/audit')
    await userEvent.click(await screen.findByRole('button', { name: 'Details: member.suspended' }, { timeout: 4000 }))
    const dialog = await screen.findByRole('dialog', { name: 'Audit entry' })
    expect(dialog).toHaveTextContent('Ada Lovelace')
    expect(dialog).toHaveTextContent('left')
  })
})

describe('read-only mode, on every screen that changes something', () => {
  it('disables each change and says why', async () => {
    openApp('/t/acme/admin/users', { readOnly: true })
    expect(await screen.findByRole('button', { name: 'Invite user' }, { timeout: 4000 })).toBeDisabled()

    await userEvent.click(await screen.findByRole('link', { name: /Bob Builder/ }))
    await heading('Bob Builder')
    expect(screen.getByRole('button', { name: 'Suspend' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove from workspace' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Save roles' })).not.toBeInTheDocument()

    await nav('Departments')
    expect(await screen.findByRole('button', { name: 'Retire' }, { timeout: 4000 })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save: Approver' })).toBeDisabled()

    await nav('Settings')
    expect(await screen.findByRole('button', { name: 'Save workspace' }, { timeout: 4000 })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save policy' })).toBeDisabled()

    await nav('Group mappings')
    expect(await screen.findByRole('button', { name: 'Save department mappings' }, { timeout: 4000 })).toBeDisabled()
    expect(iam.calls.filter((c) => c.method !== 'GET' && c.method !== 'POST' || (c.method === 'POST' && !c.path.endsWith('users:batch')))).toEqual([])
  })
})

describe('reset MFA behind a fresh sign-in', () => {
  it('asks the admin to confirm their own sign-in first when it is older than the window, and does not call IAM', async () => {
    openApp('/t/acme/admin/users', { user: { sub: 'u-ada', email: 'ada@example.com', authTime: Math.floor(Date.now() / 1000) - 3600 }, mfaWindow: 300 })
    await userEvent.click(await screen.findByRole('link', { name: /Bob Builder/ }, { timeout: 4000 }))
    await heading('Bob Builder')
    await userEvent.click(screen.getByRole('button', { name: 'Reset MFA' }))
    const dialog = await screen.findByRole('dialog', { name: 'Reset MFA for Bob Builder?' })
    expect(within(dialog).getByText('This action needs a recent multi-factor sign-in.')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm sign-in' }))
    expect(requests(/reset-mfa/)).toHaveLength(0)
  })

  it('resets once the sign-in is fresh', async () => {
    openApp('/t/acme/admin/users', { user: { sub: 'u-ada', email: 'ada@example.com', authTime: Math.floor(Date.now() / 1000) - 10 }, mfaWindow: 300 })
    await userEvent.click(await screen.findByRole('link', { name: /Bob Builder/ }, { timeout: 4000 }))
    await heading('Bob Builder')
    await userEvent.click(screen.getByRole('button', { name: 'Reset MFA' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Reset MFA' }))
    expect(await screen.findByText("They'll set up MFA again at next sign-in.")).toBeInTheDocument()
    expect(requests(/POST .*reset-mfa/)).toEqual(['POST /api/v1/tenants/tenant-1/members/u-bob/reset-mfa'])
  })

  it('asks for a step-up when the gateway still says the MFA is stale', async () => {
    openApp()
    await userEvent.click(await screen.findByRole('link', { name: /Bob Builder/ }, { timeout: 4000 }))
    await heading('Bob Builder')
    await userEvent.click(screen.getByRole('button', { name: 'Reset MFA' }))
    iam.failNext(/POST .*reset-mfa/, 403, 'DENY_MFA_STALE')
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Reset MFA' }))
    expect(await screen.findByText('Confirm your sign-in again to continue.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm sign-in' })).toBeInTheDocument()
  })
})

describe('moving around the admin area', () => {
  it('keeps the workspace in every link and lands on the users list from the admin root', async () => {
    openApp('/t/acme/admin')
    expect(await heading('Users')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/t/acme/admin/users')
    for (const [name, path, title] of [['Departments', '/t/acme/admin/departments', 'Departments and role labels'], ['Settings', '/t/acme/admin/settings', 'Settings'], ['Audit log', '/t/acme/admin/audit', 'Audit log']] as const) {
      await nav(name)
      expect(await heading(title)).toBeInTheDocument()
      expect(window.location.pathname).toBe(path)
    }
  })

  it('shows a plain member only the sections they may open, and "not permitted" at the others', async () => {
    openApp('/t/acme/admin/audit', { permissions: ['read:members'] })
    expect(await screen.findByText("You don't have access to this section.", undefined, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument() // the shell draws the sub-menu
    expect(requests(/audit/)).toHaveLength(0)
  })
})
