// Accessibility of every screen and dialog, with axe-core over the rendered page (WCAG 2.1 A and AA
// rules that need no layout). Colour contrast needs real layout and styles, so it is checked in the
// browser suite (test/browser), not here. Each state is the one a user can be looking at: the page, a
// dialog open on it, an error, an empty list, a locked or "not permitted" view.
import axe from 'axe-core'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core'
import { openApp } from '../../fixtures/app'
import { createFakeIam, type FakeIam } from '../../fixtures/fakeIam'

let iam: FakeIam
beforeEach(() => {
  iam = createFakeIam()
  iam.install()
})
afterEach(() => rs.unstubAllGlobals())

/** axe over the page; fails with the rule, the impact and the first offending element of each violation. */
async function expectAccessible(label: string) {
  const result = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } }, runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } })
  const found = result.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} element(s), first: ${v.nodes[0]?.html.slice(0, 140)}`)
  expect(found, `${label}: ${found.join(' | ')}`).toEqual([])
}
const link = (name: RegExp | string) => screen.findByRole('link', { name }, { timeout: 4000 })
const heading = (name: string) => screen.findByRole('heading', { name }, { timeout: 4000 })
const dialog = (name: string | RegExp) => screen.findByRole('dialog', { name }, { timeout: 4000 })

describe('axe itself', () => {
  it('reports a violation it should (so a clean run means something)', async () => {
    document.body.innerHTML = '<img src="x.png"><button></button><input>'
    const result = await axe.run(document.body)
    expect(result.violations.map((v) => v.id)).toEqual(expect.arrayContaining(['image-alt', 'button-name', 'label']))
    document.body.innerHTML = ''
  })
})

describe('Users (E1, E1a)', () => {
  it('the member list', async () => {
    openApp()
    await link(/Ada Lovelace/)
    await expectAccessible('members')
  })

  it('the invite dialog', async () => {
    iam.state.tenant['licensed_seats'] = 10
    openApp()
    await waitFor(async () => expect(await screen.findByRole('button', { name: 'Invite user' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: 'Invite user' }))
    const d = await dialog('Invite user')
    await userEvent.click(within(d).getByRole('button', { name: 'Add department' }))
    await expectAccessible('invite dialog')
  })

  it('the invite dialog showing a refusal and a service error', async () => {
    openApp()
    await userEvent.click(await screen.findByRole('button', { name: 'Invite user' }))
    const d = await dialog('Invite user')
    await userEvent.click(within(d).getByRole('button', { name: 'Send invitation' }))
    await within(d).findByRole('alert')
    await expectAccessible('invite dialog, refused')
  })

  it('the upgrade prompt', async () => {
    iam.state.tenant['licensed_seats'] = 3
    openApp()
    await screen.findByText('All seats are in use. New invitations are blocked.', undefined, { timeout: 4000 })
    await userEvent.click(screen.getByRole('button', { name: 'Invite user' }))
    await dialog('No free seats')
    await expectAccessible('upgrade prompt')
  })

  it('pending invitations and the revoke confirmation', async () => {
    iam.state.invitations.push({ invitation_id: 'inv-1', email: 'dee@example.com', full_name: 'Dee Dee', initial_tenant_roles: ['tender_admin'], invited_by: 'u-ada', created_at: '2026-11-20T10:00:00Z', expires_at: '2026-11-27T10:00:00Z', record_version: 1, status: 'pending' })
    openApp()
    await userEvent.click(await screen.findByRole('tab', { name: 'Pending invitations' }, { timeout: 4000 }))
    await screen.findByText('dee@example.com')
    await expectAccessible('pending invitations')
    await userEvent.click(screen.getByRole('button', { name: 'Revoke' }))
    await dialog('Revoke invitation')
    await expectAccessible('revoke confirmation')
  })

  it('a failed load', async () => {
    // A refusal, not an outage: the SDK and the query cache retry an outage, which takes seconds.
    iam.failNext(/GET .*\/members$/, 403, 'DENY_ROLE_INSUFFICIENT', {}, 5)
    openApp()
    await screen.findByText(/Users could not be loaded/, undefined, { timeout: 4000 })
    await expectAccessible('members, failed')
  })

  it('an empty list', async () => {
    iam.state.members.splice(0, iam.state.members.length)
    openApp()
    await screen.findByText('Only you so far. Invite your team.', undefined, { timeout: 4000 })
    await expectAccessible('members, empty')
  })
})

describe('User detail (E2, E2a)', () => {
  const bob = async () => {
    openApp()
    await userEvent.click(await link(/Bob Builder/))
    await heading('Bob Builder')
  }

  it('the page', async () => {
    await bob()
    await expectAccessible('detail')
  })

  it('a locked page (read-only workspace)', async () => {
    openApp('/t/acme/admin/users/u-bob', { readOnly: true })
    await heading('Bob Builder')
    await expectAccessible('detail, read-only')
  })

  it('the suspend, remove and reset MFA confirmations', async () => {
    await bob()
    for (const [button, title] of [['Suspend', 'Suspend Bob Builder?'], ['Remove from workspace', 'Remove Bob Builder?'], ['Reset MFA', 'Reset MFA for Bob Builder?']] as const) {
      await userEvent.click(screen.getByRole('button', { name: button }))
      const d = await dialog(title)
      await expectAccessible(title)
      await userEvent.click(within(d).getByRole('button', { name: 'Cancel' }))
    }
  })

  it('the demotion confirmation and the resolution dialog', async () => {
    iam.state.covering.add('u-bob')
    await bob()
    await userEvent.selectOptions(await screen.findByLabelText(/Change level: QA/), 'preparator')
    await dialog("Lower this person's level?")
    await expectAccessible('demotion confirmation')
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }))
    await dialog(/covering other people/)
    await expectAccessible('resolution dialog')
  })

  it('the conflict dialog', async () => {
    await bob()
    iam.failNext(/PATCH .*members\/u-bob$/, 409, 'OPTIMISTIC_LOCK_CONFLICT', { record_version: 9 })
    await userEvent.click(screen.getByRole('button', { name: 'Suspend' }))
    await userEvent.click(within(await dialog('Suspend Bob Builder?')).getByRole('button', { name: 'Suspend' }))
    await within(screen.getByRole('dialog')).findByRole('alert')
    await expectAccessible('suspend, conflict')
  })

  it('a member that was not found', async () => {
    openApp('/t/acme/admin/users/u-ghost')
    await screen.findByText(/This member could not be loaded/, undefined, { timeout: 4000 })
    await expectAccessible('detail, not found')
  })
})

describe('Departments (E3)', () => {
  it('the page and a confirmation', async () => {
    openApp('/t/acme/admin/departments')
    await heading('Departments and role labels')
    await screen.findByRole('button', { name: 'Retire' }, { timeout: 4000 })
    await expectAccessible('departments')
    await userEvent.click(screen.getByRole('button', { name: 'Retire' }))
    await dialog(/Retire/)
    await expectAccessible('retire confirmation')
  })
})

describe('Settings (E6)', () => {
  it('both blocks, and with a refusal showing', async () => {
    openApp('/t/acme/admin/settings')
    await screen.findByLabelText('Workspace name', undefined, { timeout: 4000 })
    await screen.findByLabelText('Longest delegation (days)')
    await expectAccessible('settings')
    await userEvent.click(screen.getByRole('button', { name: 'Save workspace' }))
    await screen.findByRole('alert')
    await expectAccessible('settings, refused')
  })

  it('read-only', async () => {
    openApp('/t/acme/admin/settings', { readOnly: true })
    await screen.findByLabelText('Workspace name', undefined, { timeout: 4000 })
    await expectAccessible('settings, read-only')
  })
})

describe('Audit log (E7)', () => {
  it('the filter drawer', async () => {
    openApp('/t/acme/admin/audit')
    await userEvent.click(await screen.findByRole('button', { name: /^Filters/ }, { timeout: 4000 }))
    await dialog('Filters')
    await expectAccessible('audit filter drawer')
  })

  it('results, the entry dialog and the exports', async () => {
    openApp('/t/acme/admin/audit')
    await userEvent.click(await screen.findByRole('button', { name: 'Details: member.suspended' }, { timeout: 4000 }))
    await dialog('Audit entry')
    await expectAccessible('audit entry dialog')
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }))
    await expectAccessible('audit results')
  })

  it('a refused range', async () => {
    openApp('/t/acme/admin/audit?from=2026-11-02T00:00:00Z&to=2026-11-01T00:00:00Z')
    await screen.findByText('The start must be before the end.', undefined, { timeout: 4000 })
    await expectAccessible('audit, refused range')
  })

  it('a large search and the exports page', async () => {
    iam.state.largeSearch = true
    openApp('/t/acme/admin/audit')
    await screen.findByText(/This search is large/, undefined, { timeout: 4000 })
    await expectAccessible('audit, large search')
    await userEvent.click(screen.getByRole('link', { name: 'View exports' }))
    await screen.findByText('ex-large', undefined, { timeout: 4000 })
    await screen.findByText('Waiting to start')
    await expectAccessible('exports')
  })
})

describe('Group mappings (E5)', () => {
  it('both tables', async () => {
    openApp('/t/acme/admin/group-mappings')
    await screen.findByLabelText('Group name 1', undefined, { timeout: 4000 })
    await expectAccessible('mappings')
  })

  it('the upgrade card and the trial notice', async () => {
    iam.state.tenant['plan'] = 'starter'
    openApp('/t/acme/admin/group-mappings')
    await screen.findByText('Upgrade to use group mappings', undefined, { timeout: 4000 })
    await expectAccessible('mappings, starter')
  })

  it('a partial save', async () => {
    openApp('/t/acme/admin/group-mappings')
    await screen.findByLabelText('Group name 1', undefined, { timeout: 4000 })
    iam.failNext(/PUT .*department-roles$/, 503, 'DB_UNAVAILABLE', {}, 3)
    await userEvent.click(screen.getByRole('button', { name: 'Save department mappings' }))
    await screen.findByText(/The departments were saved, but the levels were not/, undefined, { timeout: 8000 })
    await expectAccessible('mappings, partial save')
  }, 20000)
})

describe('the area as a whole', () => {
  it('a view with a section the user may not open', async () => {
    openApp('/t/acme/admin/audit', { permissions: ['read:members'] })
    await screen.findByText("You don't have access to this section.", undefined, { timeout: 4000 })
    await expectAccessible('not permitted')
  })
})
