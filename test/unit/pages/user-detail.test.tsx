// E2 User detail and E2a step 2 (spec E2, E2a; LLD §7.4, §7.5): the member's profile, roles,
// departments and membership, every change an admin can make, the resolution dialog for work the
// member covers, and reset MFA behind a fresh sign-in.
import { ProblemError } from '@bcbp-solutions-fzc-llc/frontend-sdk/problem'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, rs } from '@rstest/core'
import type { Member } from '../../../src/domain/entities/member'
import type { OrgMembershipPort } from '../../../src/domain/repositories/OrgMembershipPort'
import type { UserProfilePort } from '../../../src/domain/repositories/UserProfilePort'
import { recordVersion } from '../../../src/domain/value-objects/RecordVersion'
import UserDetailPage from '../../../src/presentation/pages/UserDetailPage'
import UsersPage from '../../../src/presentation/pages/UsersPage'
import { member } from '../../fixtures/domain'
import { ADMIN, MEMBER } from '../../fixtures/platform'
import { renderPage } from '../../fixtures/pages'
import { ADA, BOB, CY, departments, roleLabels, user } from '../../fixtures/people'
import { partial } from '../../fixtures/services'

const refresh = rs.fn(async () => {})
rs.mock('../../../src/presentation/features/session/useSessionRefresh', () => ({ useSessionRefresh: () => refresh }))

const problem = (status: number, errorCode: string, extensions: Record<string, unknown> = {}) =>
  new ProblemError({ type: 'about:blank', title: 'T', status, errorCode, traceId: 'trace-1', extensions })

const resolutionRequired = (n = 3) => problem(409, 'WORKFLOW_RESOLUTION_REQUIRED', { active_workflows: n, workflow_ids: ['w1', 'w2', 'w3'], allowed_actions: ['replace_delegate', 'stop_workflows'] })

const bob: Member = member({ userId: 'u-bob', tenantRoles: ['tender_admin'], departments: [{ departmentId: 'd-qa', level: 'reviewer' }, { departmentId: 'd-eng', level: 'preparator' }], recordVersion: recordVersion(6) })
const ada: Member = member({ userId: 'u-ada', tenantRoles: ['tenant_owner'], departments: [{ departmentId: 'd-eng', level: 'approver' }], recordVersion: recordVersion(2) })
const cy: Member = member({ userId: 'u-cy', status: 'suspended', tenantRoles: [], departments: [], recordVersion: recordVersion(1) })
const all = [ada, bob, cy, member({ userId: 'u-dee', tenantRoles: [], departments: [] })]

const directory = { 'u-ada': ADA, 'u-bob': { ...BOB, recordVersion: recordVersion(9) }, 'u-cy': CY, 'u-dee': user('u-dee', 'Dee Dee') } as const

function ports(o: { org?: Partial<OrgMembershipPort>; users?: Partial<UserProfilePort>; target?: Member } = {}) {
  const target = o.target ?? bob
  const org = partial<OrgMembershipPort>('orgMembership', {
    getMember: rs.fn(async () => target),
    listDepartments: rs.fn(async () => departments),
    listRoleLabels: rs.fn(async () => roleLabels),
    listMembers: rs.fn(async () => ({ members: all })),
    setRoles: rs.fn(async (_id: string, roles) => ({ userId: target.userId, roles })),
    setMemberStatus: rs.fn(async (id: string, status, version) => ({ userId: id, status, recordVersion: recordVersion(version + 1) })),
    removeMember: rs.fn(async () => {}),
    resolveRemoval: rs.fn(async () => {}),
    assignDepartment: rs.fn(async () => {}),
    removeFromDepartment: rs.fn(async () => {}),
    resetMfa: rs.fn(async () => {}),
    getSeatUsage: rs.fn(async () => ({ activeUsers: 3, pendingInvitations: 0, licensedSeats: 10 })),
    listInvitations: rs.fn(async () => []),
    ...o.org,
  })
  const users = partial<UserProfilePort>('userProfile', {
    getUser: rs.fn(async (id: string) => directory[id as keyof typeof directory]),
    updateUser: rs.fn(async (id: string) => directory[id as keyof typeof directory]),
    batch: rs.fn(async (ids: readonly string[]) => ({ users: Object.values(directory).filter((u) => ids.includes(u.userId)), missing: [] })),
    ...o.users,
  })
  return { org, users }
}

const open = (p: ReturnType<typeof ports>, userId = 'u-bob', o: Parameters<typeof renderPage>[1] = {}) =>
  renderPage(
    <Routes>
      <Route path="/admin/users/:userId" element={<UserDetailPage />} />
      <Route path="/admin/users" element={<UsersPage />} />
    </Routes>,
    { path: `/admin/users/${userId}`, services: { orgMembership: p.org, userProfile: p.users }, ...o },
  )

const heading = (name: string) => screen.findByRole('heading', { name })

beforeEach(() => {
  refresh.mockClear()
})

describe('E2 header and states', () => {
  it('shows the person with status, sign-in type, availability and roles', async () => {
    open(ports({ target: ada }), 'u-ada')
    expect(await heading('Ada Lovelace')).toBeInTheDocument()
    await screen.findByText('SSO')
    expect(screen.getByText('Out of office')).toBeInTheDocument()
    expect(screen.getAllByText('Owner').length).toBeGreaterThan(0)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('shows a suspended member as Suspended, and a profile disabled in sign-in as such', async () => {
    open(ports({ target: cy }), 'u-cy')
    await heading('Cy Young')
    expect(screen.getByText('Disabled in sign-in')).toBeInTheDocument()
  })

  it('says it is loading, with the page busy', async () => {
    open(ports({ org: { getMember: rs.fn(() => new Promise<Member>(() => {})) } }))
    expect(await screen.findByText('Loading member…')).toBeInTheDocument()
  })

  it('says a member was not found (404), with a way back, and retry', async () => {
    const getMember = rs.fn(async () => { throw problem(404, 'MEMBER_NOT_FOUND') })
    open(ports({ org: { getMember } }), 'u-ghost')
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('This member could not be loaded.')
    expect(alert).toHaveTextContent('This member was not found. They may have been removed.')
    expect(screen.getByRole('link', { name: 'Back to users' })).toHaveAttribute('href', '/admin/users')
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(getMember).toHaveBeenCalledTimes(2)
  })

  it('keeps the page and says so when only the profile fails to load', async () => {
    open(ports({ users: { getUser: rs.fn(async () => { throw problem(503, 'USER_PROFILE_UNAVAILABLE') }) } }))
    expect(await screen.findByText('This member could not be loaded.', { exact: false })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Tenant roles' })).toBeInTheDocument()
    expect(screen.getByText('Name unavailable')).toBeInTheDocument()
  })

  it('shows a plain member the page with every control disabled or absent', async () => {
    open(ports(), 'u-bob', { permissions: MEMBER })
    await heading('Bob Builder')
    expect(screen.queryByRole('button', { name: 'Suspend' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save roles' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add department' })).not.toBeInTheDocument()
    for (const box of screen.getAllByRole('checkbox')) expect(box).toBeDisabled()
    expect(screen.getByLabelText('Name')).toBeDisabled()
  })

  it('says the workspace is read-only and disables every change', async () => {
    open(ports(), 'u-bob', { readOnly: true })
    await heading('Bob Builder')
    expect(screen.getByText('This workspace is read-only (subscription ended).')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Suspend' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove from workspace' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reset MFA' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Save roles' })).not.toBeInTheDocument()
  })
})

describe('E2 roles (P-28, full replacement)', () => {
  it('sends the whole list, and says it saved', async () => {
    const p = ports()
    open(p)
    await heading('Bob Builder')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Admin' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save roles' }))
    await waitFor(() => expect(p.org.setRoles).toHaveBeenCalledWith('u-bob', ['tenant_admin', 'tender_admin']))
    expect(await screen.findByText('Roles saved.')).toBeInTheDocument()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('keeps the "saved" notice when the member\'s version moves on and the form reloads', async () => {
    let current = bob
    const p = ports({
      org: {
        getMember: rs.fn(async () => current),
        setRoles: rs.fn(async (_id: string, roles) => {
          current = { ...current, tenantRoles: [...roles], recordVersion: recordVersion(current.recordVersion + 1) }
          return { userId: 'u-bob', roles }
        }),
      },
    })
    open(p)
    await heading('Bob Builder')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Admin' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save roles' }))
    await waitFor(() => expect(p.org.getMember).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Roles saved.')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Admin' })).toBeChecked()
  })

  it('keeps Save disabled until something changes', async () => {
    open(ports())
    await heading('Bob Builder')
    expect(screen.getByRole('button', { name: 'Save roles' })).toBeDisabled()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Tender admin' }))
    expect(screen.getByRole('button', { name: 'Save roles' })).toBeEnabled()
  })

  it('lets an admin grant tender admin but not owner or admin (an owner\'s to grant)', async () => {
    open(ports(), 'u-bob', { permissions: ADMIN })
    await heading('Bob Builder')
    expect(screen.getByRole('checkbox', { name: 'Owner' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'Admin' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'Tender admin' })).toBeEnabled()
  })

  it('asks for fresh permission hints after changing your own roles', async () => {
    const self = member({ userId: 'test-user', tenantRoles: ['tender_admin'], recordVersion: recordVersion(1) })
    const p = ports({ target: self, users: { getUser: rs.fn(async () => user('test-user', 'Test User')) } })
    open(p, 'test-user')
    await heading('Test User')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Tender admin' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save roles' }))
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
  })

  it('refuses taking owner from the last owner before sending anything, and says why', async () => {
    const p = ports({ target: ada, org: { listMembers: rs.fn(async () => ({ members: [ada, bob, cy] })) } })
    open(p, 'u-ada')
    await heading('Ada Lovelace')
    await waitFor(() => expect(p.org.listMembers).toHaveBeenCalled())
    await userEvent.click(screen.getByRole('checkbox', { name: 'Owner' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save roles' }))
    expect(await screen.findByText('A workspace must keep at least one owner.')).toBeInTheDocument()
    expect(p.org.setRoles).not.toHaveBeenCalled()
  })

  it('allows taking owner from one of several owners', async () => {
    const second = member({ userId: 'u-eve', tenantRoles: ['tenant_owner'] })
    const p = ports({ target: ada, org: { listMembers: rs.fn(async () => ({ members: [ada, second] })) } })
    open(p, 'u-ada')
    await heading('Ada Lovelace')
    await waitFor(() => expect(p.org.listMembers).toHaveBeenCalled())
    await userEvent.click(screen.getByRole('checkbox', { name: 'Owner' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save roles' }))
    await waitFor(() => expect(p.org.setRoles).toHaveBeenCalledWith('u-ada', []))
  })

  it('walks every page to count owners, and lets the service refuse when it cannot be counted', async () => {
    const listMembers = rs.fn(async () => { throw problem(503, 'DB_UNAVAILABLE') })
    const setRoles = rs.fn(async () => { throw problem(422, 'LAST_OWNER_REMOVAL') })
    open(ports({ target: ada, org: { listMembers, setRoles } }), 'u-ada')
    await heading('Ada Lovelace')
    expect(await screen.findByText(/We couldn't check how many owners there are/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Owner' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save roles' }))
    expect(await screen.findByText('A workspace must keep at least one owner.')).toBeInTheDocument()
    expect(setRoles).toHaveBeenCalledTimes(1)
  })

  it('reads the owner count from every page', async () => {
    const listMembers = rs.fn(async (page: { cursor?: string }) => (page.cursor ? { members: [member({ userId: 'u-eve', tenantRoles: ['tenant_owner'] })] } : { members: [ada], nextCursor: 'p2' as never }))
    const p = ports({ target: ada, org: { listMembers: listMembers as never } })
    open(p, 'u-ada')
    await heading('Ada Lovelace')
    await waitFor(() => expect(listMembers).toHaveBeenCalledTimes(2))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Owner' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save roles' }))
    await waitFor(() => expect(p.org.setRoles).toHaveBeenCalled())
  })

  it('does not count owners for a member who is not an owner', async () => {
    const p = ports()
    open(p)
    await heading('Bob Builder')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Tender admin' }))
    expect(p.org.listMembers).not.toHaveBeenCalled()
  })

  it('shows a service error in place, with Copy details', async () => {
    const setRoles = rs.fn(async () => { throw problem(403, 'DENY_ROLE_INSUFFICIENT') })
    const view = open(ports({ org: { setRoles } }))
    await heading('Bob Builder')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Admin' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save roles' }))
    const alert = await screen.findByText("You don't have permission to do this.")
    expect(alert).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy details' })).toBeInTheDocument()
    expect(view.calls).toContain('action:change_roles:failure')
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})

describe('E2 departments (P-10, P-11) and the impact review (E2a step 2)', () => {
  const row = (name: string) => screen.getByText(name, { selector: 'span' }).closest('li')!

  it('lists the departments with the tenant\'s level labels', async () => {
    open(ports())
    await heading('Bob Builder')
    await waitFor(() => expect(within(row('QA / QC')).getByLabelText(/Change level/)).toHaveValue('reviewer'))
    expect(within(within(row('QA / QC')).getByLabelText(/Change level/)).getAllByRole('option').map((o) => o.textContent)).toEqual(['Engineer', 'Manager', 'Director'])
  })

  it('says when the member is in no department', async () => {
    open(ports({ target: cy }), 'u-cy')
    await heading('Cy Young')
    expect(screen.getByText('Not in any department.')).toBeInTheDocument()
  })

  it('raises a level at once, with no review', async () => {
    const p = ports()
    open(p)
    await heading('Bob Builder')
    await waitFor(() => expect(within(row('QA / QC')).getByLabelText(/Change level/)).toBeInTheDocument())
    await userEvent.selectOptions(within(row('QA / QC')).getByLabelText(/Change level/), 'approver')
    await waitFor(() => expect(p.org.assignDepartment).toHaveBeenCalledWith('d-qa', 'u-bob', 'approver'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('confirms a demotion first, saying the workflow check is not available in advance', async () => {
    const p = ports()
    open(p)
    await heading('Bob Builder')
    await userEvent.selectOptions(within(row('QA / QC')).getByLabelText(/Change level/), 'preparator')
    const dialog = await screen.findByRole('dialog', { name: "Lower this person's level?" })
    expect(dialog).toHaveTextContent('Moving Bob Builder to Engineer in QA / QC can affect work assigned to them.')
    expect(dialog).toHaveTextContent("We can't check this person's workflows in advance yet")
    expect(p.org.assignDepartment).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(p.org.assignDepartment).toHaveBeenCalledWith('d-qa', 'u-bob', 'preparator'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('cancels a demotion without sending anything', async () => {
    const p = ports()
    open(p)
    await heading('Bob Builder')
    await userEvent.selectOptions(within(row('QA / QC')).getByLabelText(/Change level/), 'preparator')
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    expect(p.org.assignDepartment).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('asks what to do with covered work when IAM answers 409, hands it on, and re-sends the demotion', async () => {
    const assignDepartment = rs.fn().mockRejectedValueOnce(resolutionRequired(3)).mockResolvedValue(undefined)
    const p = ports({ org: { assignDepartment } })
    open(p)
    await heading('Bob Builder')
    await userEvent.selectOptions(within(row('QA / QC')).getByLabelText(/Change level/), 'preparator')
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirm' }))
    const dialog = await screen.findByRole('dialog', { name: "Bob Builder is covering other people's work" })
    expect(dialog).toHaveTextContent('covering work for others on 3 workflows')
    await userEvent.selectOptions(within(dialog).getByLabelText('New cover'), await within(dialog).findByRole('option', { name: 'Dee Dee' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Apply and continue' }))
    await waitFor(() => expect(p.org.resolveRemoval).toHaveBeenCalledWith('u-bob', { action: 'replace_delegate', replacementUserId: 'u-dee' }))
    await waitFor(() => expect(assignDepartment).toHaveBeenCalledTimes(2))
    expect(assignDepartment.mock.calls[1]).toEqual(['d-qa', 'u-bob', 'preparator'])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('shows no generic error behind the resolution dialog, nor after Cancel (a blocked call is not a failure)', async () => {
    const assignDepartment = rs.fn().mockRejectedValueOnce(resolutionRequired(3)).mockResolvedValue(undefined)
    open(ports({ org: { assignDepartment } }))
    await heading('Bob Builder')
    await userEvent.selectOptions(within(row('QA / QC')).getByLabelText(/Change level/), 'preparator')
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirm' }))
    const dialog = await screen.findByRole('dialog', { name: "Bob Builder is covering other people's work" })
    expect(screen.queryByText('Something went wrong. Try again.')).not.toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.queryByText('Something went wrong. Try again.')).not.toBeInTheDocument()
  })

  it('offers everyone but the member as cover, and only active ones', async () => {
    const assignDepartment = rs.fn().mockRejectedValueOnce(resolutionRequired()).mockResolvedValue(undefined)
    open(ports({ org: { assignDepartment } }))
    await heading('Bob Builder')
    await userEvent.selectOptions(within(row('QA / QC')).getByLabelText(/Change level/), 'preparator')
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirm' }))
    const dialog = await screen.findByRole('dialog', { name: /covering other people/ })
    const picker = within(dialog).getByLabelText('New cover')
    await waitFor(() => expect(within(picker).getAllByRole('option').map((o) => o.textContent)).toEqual(['Choose a member', 'Ada Lovelace', 'Dee Dee']))
  })

  it('stops the workflows when that is chosen, then re-sends', async () => {
    const assignDepartment = rs.fn().mockRejectedValueOnce(resolutionRequired()).mockResolvedValue(undefined)
    const p = ports({ org: { assignDepartment } })
    open(p)
    await heading('Bob Builder')
    await userEvent.selectOptions(within(row('QA / QC')).getByLabelText(/Change level/), 'preparator')
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirm' }))
    const dialog = await screen.findByRole('dialog', { name: /covering other people/ })
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Stop those workflows' }))
    expect(within(dialog).getByText('The workflows are stopped. This cannot be undone.')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Apply and continue' }))
    await waitFor(() => expect(p.org.resolveRemoval).toHaveBeenCalledWith('u-bob', { action: 'stop_workflows' }))
    await waitFor(() => expect(assignDepartment).toHaveBeenCalledTimes(2))
  })

  it('refuses "hand it on" with nobody chosen, and says so, without calling IAM', async () => {
    const assignDepartment = rs.fn().mockRejectedValueOnce(resolutionRequired())
    const p = ports({ org: { assignDepartment } })
    open(p)
    await heading('Bob Builder')
    await userEvent.selectOptions(within(row('QA / QC')).getByLabelText(/Change level/), 'preparator')
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirm' }))
    const dialog = await screen.findByRole('dialog', { name: /covering other people/ })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Apply and continue' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Choose an active member of this workspace.')
    expect(p.org.resolveRemoval).not.toHaveBeenCalled()
  })

  it('says "Pick an active member" when IAM refuses the replacement (422), and keeps the dialog open', async () => {
    const assignDepartment = rs.fn().mockRejectedValueOnce(resolutionRequired())
    const resolveRemoval = rs.fn(async () => { throw problem(422, 'INVALID_REPLACEMENT') })
    open(ports({ org: { assignDepartment, resolveRemoval } }))
    await heading('Bob Builder')
    await userEvent.selectOptions(within(row('QA / QC')).getByLabelText(/Change level/), 'preparator')
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirm' }))
    const dialog = await screen.findByRole('dialog', { name: /covering other people/ })
    await userEvent.selectOptions(within(dialog).getByLabelText('New cover'), await within(dialog).findByRole('option', { name: 'Dee Dee' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Apply and continue' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Pick an active member of this workspace.')
    expect(assignDepartment).toHaveBeenCalledTimes(1)
  })

  it('says nothing was changed when the Workflow service is unavailable (503)', async () => {
    const assignDepartment = rs.fn().mockRejectedValueOnce(resolutionRequired())
    const resolveRemoval = rs.fn(async () => { throw problem(503, 'WORKFLOW_SERVICE_UNAVAILABLE') })
    open(ports({ org: { assignDepartment, resolveRemoval } }))
    await heading('Bob Builder')
    await userEvent.selectOptions(within(row('QA / QC')).getByLabelText(/Change level/), 'preparator')
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirm' }))
    const dialog = await screen.findByRole('dialog', { name: /covering other people/ })
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Stop those workflows' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Apply and continue' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Nothing was changed. Try again.')
  })

  it('keeps asking when more work appeared after the choice (a second 409), with the new numbers', async () => {
    const assignDepartment = rs.fn().mockRejectedValueOnce(resolutionRequired(3)).mockRejectedValueOnce(resolutionRequired(5)).mockResolvedValue(undefined)
    open(ports({ org: { assignDepartment } }))
    await heading('Bob Builder')
    await userEvent.selectOptions(within(row('QA / QC')).getByLabelText(/Change level/), 'preparator')
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirm' }))
    const dialog = await screen.findByRole('dialog', { name: /covering other people/ })
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Stop those workflows' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Apply and continue' }))
    await waitFor(() => expect(dialog).toHaveTextContent('on 5 workflows'))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Apply and continue' }))
    await waitFor(() => expect(assignDepartment).toHaveBeenCalledTimes(3))
  })

  it('cancels the resolution without changing anything', async () => {
    const assignDepartment = rs.fn().mockRejectedValueOnce(resolutionRequired())
    const p = ports({ org: { assignDepartment } })
    open(p)
    await heading('Bob Builder')
    await userEvent.selectOptions(within(row('QA / QC')).getByLabelText(/Change level/), 'preparator')
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirm' }))
    await userEvent.click(within(await screen.findByRole('dialog', { name: /covering other people/ })).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(p.org.resolveRemoval).not.toHaveBeenCalled()
  })

  it('adds a department: only active ones the member is not already in, with a level', async () => {
    const p = ports({ target: member({ userId: 'u-bob', tenantRoles: [], departments: [{ departmentId: 'd-eng', level: 'preparator' }], recordVersion: recordVersion(1) }) })
    open(p)
    await heading('Bob Builder')
    await userEvent.click(await screen.findByRole('button', { name: 'Add department' }))
    const pick = screen.getByLabelText('Department')
    expect(within(pick).getAllByRole('option').map((o) => o.textContent)).toEqual(['QA / QC'])
    await userEvent.selectOptions(screen.getByLabelText('Level'), 'approver')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(p.org.assignDepartment).toHaveBeenCalledWith('d-qa', 'u-bob', 'approver'))
    expect(screen.queryByLabelText('Level')).not.toBeInTheDocument()
  })

  it('has nothing to add when the member is in every active department', async () => {
    open(ports())
    await heading('Bob Builder')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add department' })).toBeDisabled())
  })

  it('removes a department after a confirmation naming both, with the same review', async () => {
    const removeFromDepartment = rs.fn().mockRejectedValueOnce(resolutionRequired()).mockResolvedValue(undefined)
    const p = ports({ org: { removeFromDepartment } })
    open(p)
    await heading('Bob Builder')
    await userEvent.click(screen.getByRole('button', { name: 'Remove: QA / QC' }))
    const dialog = await screen.findByRole('dialog', { name: 'Remove from department?' })
    expect(dialog).toHaveTextContent('Remove Bob Builder from QA / QC?')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove' }))
    const resolution = await screen.findByRole('dialog', { name: /covering other people/ })
    await userEvent.click(within(resolution).getByRole('radio', { name: 'Stop those workflows' }))
    await userEvent.click(within(resolution).getByRole('button', { name: 'Apply and continue' }))
    await waitFor(() => expect(removeFromDepartment).toHaveBeenCalledTimes(2))
    expect(removeFromDepartment.mock.calls[1]).toEqual(['d-qa', 'u-bob'])
  })

  it('shows a failed removal in the confirmation, which stays open', async () => {
    const removeFromDepartment = rs.fn(async () => { throw problem(503, 'DB_UNAVAILABLE') })
    const view = open(ports({ org: { removeFromDepartment } }))
    await heading('Bob Builder')
    await userEvent.click(screen.getByRole('button', { name: 'Remove: QA / QC' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Nothing was changed. Try again.')
    expect(view.calls).toContain('action:remove_from_department:error')
  })

  it('says a department the tenant retired cannot be assigned (the rule refuses before sending)', async () => {
    const retiredMember = member({ userId: 'u-bob', tenantRoles: [], departments: [{ departmentId: 'd-old', level: 'reviewer' }], recordVersion: recordVersion(1) })
    const p = ports({ target: retiredMember })
    open(p)
    await heading('Bob Builder')
    await waitFor(() => expect(screen.getByText('Retired Dept', { selector: 'span' })).toBeInTheDocument())
    await userEvent.selectOptions(screen.getByLabelText(/Change level: Retired Dept/), 'approver')
    expect(await screen.findByText('Activate the department first.')).toBeInTheDocument()
    expect(p.org.assignDepartment).not.toHaveBeenCalled()
  })

  it('shows "Department" for a department the directory cannot name', async () => {
    const p = ports({ org: { listDepartments: rs.fn(async () => { throw problem(503, 'DB_UNAVAILABLE') }) } })
    open(p)
    await heading('Bob Builder')
    await waitFor(() => expect(screen.getAllByText('Department', { selector: 'span' })).toHaveLength(2))
  })
})

describe('E2 membership', () => {
  it('suspends after a confirmation that says work stays with them, with the version being replaced', async () => {
    const p = ports()
    const view = open(p)
    await heading('Bob Builder')
    await userEvent.click(screen.getByRole('button', { name: 'Suspend' }))
    const dialog = await screen.findByRole('dialog', { name: 'Suspend Bob Builder?' })
    expect(dialog).toHaveTextContent('Their assigned work stays with them. Reassign it from the tender if needed.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Suspend' }))
    await waitFor(() => expect(p.org.setMemberStatus).toHaveBeenCalledWith('u-bob', 'suspended', 6))
    expect(await screen.findByText('Bob Builder is suspended.')).toBeInTheDocument()
    expect(view.calls).toContain('action:suspend:success')
  })

  it('reactivates a suspended member', async () => {
    const p = ports({ target: cy })
    const view = open(p, 'u-cy')
    await heading('Cy Young')
    await userEvent.click(screen.getByRole('button', { name: 'Reactivate' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Reactivate' }))
    await waitFor(() => expect(p.org.setMemberStatus).toHaveBeenCalledWith('u-cy', 'active', 1))
    expect(await screen.findByText('Cy Young is active again.')).toBeInTheDocument()
    expect(view.calls).toContain('action:reactivate:success')
  })

  it('disables Reset MFA for a suspended member: reactivate first', async () => {
    open(ports({ target: cy }), 'u-cy')
    await heading('Cy Young')
    expect(screen.getByRole('button', { name: 'Reset MFA' })).toBeDisabled()
  })

  it('refuses suspending or removing the last owner before sending, and says why', async () => {
    const p = ports({ target: ada, org: { listMembers: rs.fn(async () => ({ members: [ada, bob] })) } })
    open(p, 'u-ada')
    await heading('Ada Lovelace')
    await waitFor(() => expect(p.org.listMembers).toHaveBeenCalled())
    await userEvent.click(screen.getByRole('button', { name: 'Suspend' }))
    expect(await screen.findByText('A workspace must keep at least one owner.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Remove from workspace' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(p.org.setMemberStatus).not.toHaveBeenCalled()
    expect(p.org.removeMember).not.toHaveBeenCalled()
  })

  it('shows a failed suspension in the dialog, which stays open', async () => {
    const setMemberStatus = rs.fn(async () => { throw problem(409, 'OPTIMISTIC_LOCK_CONFLICT', { record_version: 7 }) })
    open(ports({ org: { setMemberStatus } }))
    await heading('Bob Builder')
    await userEvent.click(screen.getByRole('button', { name: 'Suspend' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Suspend' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Someone else changed this. Reload to see the latest version.')
  })

  it('removes after a confirmation naming the person, then returns to the list saying so', async () => {
    const p = ports()
    const view = open(p)
    await heading('Bob Builder')
    await userEvent.click(screen.getByRole('button', { name: 'Remove from workspace' }))
    const dialog = await screen.findByRole('dialog', { name: 'Remove Bob Builder?' })
    expect(dialog).toHaveTextContent('Bob Builder loses access to this workspace. Their seat is freed.')
    expect(dialog).toHaveTextContent("We can't check this person's workflows in advance yet")
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove from workspace' }))
    await waitFor(() => expect(p.org.removeMember).toHaveBeenCalledWith('u-bob'))
    expect(await screen.findByText('Bob Builder was removed.')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument()
    expect(view.calls).toContain('action:remove:success')
  })

  it('asks what to do with covered work (409), then removes and returns to the list', async () => {
    const removeMember = rs.fn().mockRejectedValueOnce(resolutionRequired(2)).mockResolvedValue(undefined)
    const p = ports({ org: { removeMember } })
    open(p)
    await heading('Bob Builder')
    await userEvent.click(screen.getByRole('button', { name: 'Remove from workspace' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove from workspace' }))
    const resolution = await screen.findByRole('dialog', { name: "Bob Builder is covering other people's work" })
    expect(screen.queryByRole('dialog', { name: 'Remove Bob Builder?' })).not.toBeInTheDocument()
    await userEvent.click(within(resolution).getByRole('radio', { name: 'Stop those workflows' }))
    await userEvent.click(within(resolution).getByRole('button', { name: 'Apply and continue' }))
    await waitFor(() => expect(removeMember).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Bob Builder was removed.')).toBeInTheDocument()
  })

  it('shows another failed removal in the dialog, and does not leave the page', async () => {
    const removeMember = rs.fn(async () => { throw problem(422, 'LAST_OWNER_REMOVAL') })
    open(ports({ org: { removeMember } }))
    await heading('Bob Builder')
    await userEvent.click(screen.getByRole('button', { name: 'Remove from workspace' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove from workspace' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('A workspace must keep at least one owner.')
    expect(screen.getByRole('heading', { name: 'Bob Builder' })).toBeInTheDocument()
  })
})

describe('E2 reset MFA (P-34) behind a fresh sign-in', () => {
  it('resets after a confirmation, and says they will set up MFA again', async () => {
    const p = ports()
    const view = open(p)
    await heading('Bob Builder')
    await userEvent.click(screen.getByRole('button', { name: 'Reset MFA' }))
    const dialog = await screen.findByRole('dialog', { name: 'Reset MFA for Bob Builder?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reset MFA' }))
    await waitFor(() => expect(p.org.resetMfa).toHaveBeenCalledWith('u-bob'))
    expect(await screen.findByText("They'll set up MFA again at next sign-in.")).toBeInTheDocument()
    expect(view.calls).toContain('action:reset_mfa:success')
    expect(view.calls).not.toContain('stepUp:reset_mfa')
  })

  it('steps up first when the admin\'s own sign-in is older than the window, and does not call IAM yet', async () => {
    const p = ports()
    const view = open(p, 'u-bob', { user: { sub: 'test-user', email: 'owner@example.com', authTime: Math.floor(Date.now() / 1000) - 3600 }, mfeWindowSeconds: 300 })
    await heading('Bob Builder')
    await userEvent.click(screen.getByRole('button', { name: 'Reset MFA' }))
    const dialog = await screen.findByRole('dialog', { name: 'Reset MFA for Bob Builder?' })
    expect(within(dialog).getByText('This action needs a recent multi-factor sign-in.')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm sign-in' }))
    await waitFor(() => expect(view.calls).toContain('stepUp:reset_mfa'))
    expect(p.org.resetMfa).not.toHaveBeenCalled()
  })

  it('offers a step-up when the gateway says the MFA is stale after the call (DENY_MFA_STALE)', async () => {
    const resetMfa = rs.fn(async () => { throw problem(403, 'DENY_MFA_STALE') })
    const view = open(ports({ org: { resetMfa } }))
    await heading('Bob Builder')
    await userEvent.click(screen.getByRole('button', { name: 'Reset MFA' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reset MFA' }))
    expect(await within(dialog).findByText('Confirm your sign-in again to continue.')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm sign-in' }))
    await waitFor(() => expect(view.calls).toContain('stepUp:reset_mfa'))
  })

  it.each([
    ['422 MEMBER_NOT_ACTIVE', problem(422, 'MEMBER_NOT_ACTIVE'), "We couldn't reset MFA. Reactivate the user first."],
    ['503 REALM_PROVISIONER_UNAVAILABLE', problem(503, 'REALM_PROVISIONER_UNAVAILABLE'), "We couldn't reset MFA. Nothing was changed. Try again."],
  ])('says what happened on %s, and nothing succeeded', async (_name, error, message) => {
    const resetMfa = rs.fn(async () => { throw error })
    const view = open(ports({ org: { resetMfa } }))
    await heading('Bob Builder')
    await userEvent.click(screen.getByRole('button', { name: 'Reset MFA' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reset MFA' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(message)
    expect(screen.queryByText("They'll set up MFA again at next sign-in.")).not.toBeInTheDocument()
    expect(view.calls.some((c) => c.startsWith('action:reset_mfa:'))).toBe(true)
  })
})

describe('E2 profile (PATCH /users/:id with expected_version)', () => {
  it('sends only the changed name, with the version being replaced', async () => {
    const p = ports()
    open(p)
    await heading('Bob Builder')
    const name = screen.getByLabelText('Name')
    await userEvent.clear(name)
    await userEvent.type(name, 'Robert Builder')
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }))
    await waitFor(() => expect(p.users.updateUser).toHaveBeenCalledWith('u-bob', { displayName: 'Robert Builder', expectedVersion: 9 }))
    expect(await screen.findByText('Profile saved.')).toBeInTheDocument()
  })

  it.each([
    ['a blank name', '', 'Estimator', 'Enter a name.'],
    ['nothing changed', 'Bob Builder', 'Estimator', 'Nothing was changed.'],
  ])('refuses %s before sending', async (_n, nameValue, title, message) => {
    const p = ports()
    open(p)
    await heading('Bob Builder')
    const name = screen.getByLabelText('Name')
    await userEvent.clear(name)
    if (nameValue) await userEvent.type(name, nameValue)
    const jobTitle = screen.getByLabelText('Job title')
    await userEvent.clear(jobTitle)
    await userEvent.type(jobTitle, title)
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }))
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(p.users.updateUser).not.toHaveBeenCalled()
  })

  it('offers "Revert to directory value" for a federated user whose name was overridden', async () => {
    const federated = { ...ADA, displayNameOverridden: true, jobTitleOverridden: true, recordVersion: recordVersion(4) }
    const p = ports({ target: ada, users: { getUser: rs.fn(async () => federated) } })
    open(p, 'u-ada')
    await heading('Ada Lovelace')
    expect(screen.getByText(/signs in with SSO/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Revert name to directory value' }))
    await waitFor(() => expect(p.users.updateUser).toHaveBeenCalledWith('u-ada', { revertDisplayName: true, expectedVersion: 4 }))
    await userEvent.click(screen.getByRole('button', { name: 'Revert job title to directory value' }))
    await waitFor(() => expect(p.users.updateUser).toHaveBeenCalledWith('u-ada', { revertJobTitle: true, expectedVersion: 4 }))
  })

  it('offers no revert for a local user, or a federated user who has not been overridden', async () => {
    open(ports())
    await heading('Bob Builder')
    expect(screen.queryByRole('button', { name: /Revert/ })).not.toBeInTheDocument()
  })

  it('offers Reload when someone else edited the profile first (409), and Reload asks again', async () => {
    const updateUser = rs.fn(async () => { throw problem(409, 'VERSION_CONFLICT', { record_version: 10 }) })
    const p = ports({ users: { updateUser } })
    open(p)
    await heading('Bob Builder')
    const name = screen.getByLabelText('Name')
    await userEvent.clear(name)
    await userEvent.type(name, 'Robert')
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }))
    const conflict = await screen.findByRole('dialog', { name: 'This changed while you were editing' })
    await userEvent.click(within(conflict).getByRole('button', { name: 'Reload' }))
    await waitFor(() => expect(p.users.getUser).toHaveBeenCalledTimes(2))
    expect(updateUser).toHaveBeenCalledTimes(1)
  })

  it('shows another failure in place', async () => {
    const view = open(ports({ users: { updateUser: rs.fn(async () => { throw problem(503, 'USER_PROFILE_UNAVAILABLE') }) } }))
    await heading('Bob Builder')
    const name = screen.getByLabelText('Name')
    await userEvent.clear(name)
    await userEvent.type(name, 'Robert')
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }))
    expect(await screen.findByText('Nothing was changed. Try again.')).toBeInTheDocument()
    expect(view.calls).toContain('action:update_profile:error')
  })
})
