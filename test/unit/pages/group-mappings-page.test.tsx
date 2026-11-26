// E5 Group mappings (spec E5; LLD §7.8): the plan gate, the department-and-level table (two writes),
// the role table, owner rows, and every refusal and failure in plain words.
import { ProblemError } from '@bcbp-solutions-fzc-llc/frontend-sdk/problem'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, rs } from '@rstest/core'
import type { GroupMappings } from '../../../src/domain/entities/groupMapping'
import type { TenantSettings } from '../../../src/domain/entities/settings'
import type { GroupMappingPort } from '../../../src/domain/repositories/GroupMappingPort'
import type { OrgMembershipPort } from '../../../src/domain/repositories/OrgMembershipPort'
import GroupMappingsPage from '../../../src/presentation/pages/GroupMappingsPage'
import { settings } from '../../fixtures/domain'
import { ADMIN } from '../../fixtures/platform'
import { renderPage } from '../../fixtures/pages'
import { departments, roleLabels } from '../../fixtures/people'
import { partial } from '../../fixtures/services'

const problem = (status: number, errorCode: string) => new ProblemError({ type: 'about:blank', title: 'T', status, errorCode, traceId: 'trace-1', extensions: {} })

const initial: GroupMappings = {
  departments: [{ groupName: 'eng', departmentId: 'd-eng' }, { groupName: 'quality', departmentId: 'd-qa' }],
  levels: [{ groupName: 'eng', level: 'reviewer' }, { groupName: 'quality', level: 'approver' }],
  tenantRoles: [{ groupName: 'owners', role: 'tenant_owner' }, { groupName: 'admins', role: 'tenant_admin' }],
}

function ports(o: { mappings?: GroupMappings; tenant?: Partial<TenantSettings>; org?: Partial<OrgMembershipPort>; groups?: Partial<GroupMappingPort> } = {}) {
  // The service keeps state, so a save changes what the next read answers (and the table reloads).
  let stored = o.mappings ?? initial
  const groupMapping = partial<GroupMappingPort>('groupMapping', {
    getAll: rs.fn(async () => stored),
    putDepartments: rs.fn(async (m) => ((stored = { ...stored, departments: [...m] }), m)),
    putLevels: rs.fn(async (m) => ((stored = { ...stored, levels: [...m] }), m)),
    putTenantRoles: rs.fn(async (m) => ((stored = { ...stored, tenantRoles: [...m] }), m)),
    ...o.groups,
  })
  const org = partial<OrgMembershipPort>('orgMembership', {
    getTenant: rs.fn(async () => settings({ plan: 'pro', status: 'active', ...o.tenant })),
    listDepartments: rs.fn(async () => departments),
    listRoleLabels: rs.fn(async () => roleLabels),
    ...o.org,
  })
  return { groupMapping, org }
}

const open = (p: ReturnType<typeof ports>, o: Parameters<typeof renderPage>[1] = {}) => renderPage(<GroupMappingsPage />, { path: '/admin/group-mappings', services: { groupMapping: p.groupMapping, orgMembership: p.org }, ...o })
const deptCard = async () => within((await screen.findByRole('heading', { name: 'Groups to departments' })).closest('section')!)
const roleCard = async () => within((await screen.findByRole('heading', { name: 'Groups to roles' })).closest('section')!)

describe('E5 the plan gate', () => {
  it.each([['pro'], ['enterprise']] as const)('opens the editor for a %s plan', async (plan) => {
    open(ports({ tenant: { plan } }))
    expect(await screen.findByRole('heading', { name: 'Groups to departments' })).toBeInTheDocument()
  })

  it('tells a trial workspace SSO comes after an upgrade, and shows no editor', async () => {
    const p = ports({ tenant: { status: 'trial', plan: 'pro' } })
    open(p)
    expect(await screen.findByText('SSO is available after you upgrade.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Groups to departments' })).not.toBeInTheDocument()
    expect(p.groupMapping.getAll).not.toHaveBeenCalled()
  })

  it('shows a Starter workspace an upgrade card, and asks the service for nothing', async () => {
    const p = ports({ tenant: { plan: 'starter' } })
    open(p)
    expect(await screen.findByText('Upgrade to use group mappings')).toBeInTheDocument()
    expect(screen.getByText(/Pro and Enterprise plans/)).toBeInTheDocument()
    expect(p.groupMapping.getAll).not.toHaveBeenCalled()
  })

  it('says it is checking the plan, and that the plan could not be checked (with Retry)', async () => {
    const getTenant = rs.fn<OrgMembershipPort['getTenant']>().mockRejectedValueOnce(problem(503, 'DB_UNAVAILABLE')).mockResolvedValue(settings({ plan: 'pro' }))
    open(ports({ org: { getTenant } }))
    const alert = await screen.findByText(/Your plan could not be checked\./)
    await userEvent.click(within(alert.closest('[role="alert"]') as HTMLElement).getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('heading', { name: 'Groups to departments' })).toBeInTheDocument()
  })

  it('says it is loading while the plan is not known yet', async () => {
    open(ports({ org: { getTenant: rs.fn(() => new Promise<TenantSettings>(() => {})) } }))
    expect(await screen.findByText('Loading group mappings…')).toBeInTheDocument()
  })

  it('explains how mappings work, that they only add access, and that they apply at the next sign-in', async () => {
    open(ports())
    expect(await screen.findByText(/matched against these tables/)).toBeInTheDocument()
    expect(screen.getByText(/never takes access away/)).toBeInTheDocument()
    expect(screen.getByText(/next SSO sign-in/)).toBeInTheDocument()
  })

  it('shows an alert with Retry when the mappings cannot be loaded', async () => {
    const getAll = rs.fn<GroupMappingPort['getAll']>().mockRejectedValueOnce(problem(503, 'DB_UNAVAILABLE')).mockResolvedValue(initial)
    open(ports({ groups: { getAll } }))
    const alert = await screen.findByText(/Group mappings could not be loaded\./)
    await userEvent.click(within(alert.closest('[role="alert"]') as HTMLElement).getByRole('button', { name: 'Retry' }))
    expect(await deptCard()).toBeTruthy()
  })
})

describe('E5 groups to departments and levels', () => {
  it('shows one row per group, joining the department and the level lists, with the tenant\'s level labels', async () => {
    open(ports())
    const card = await deptCard()
    await waitFor(() => expect(card.getByLabelText('Group name 1')).toHaveValue('eng'))
    expect(card.getByLabelText('Department 1')).toHaveValue('d-eng')
    expect(card.getByLabelText('Level 1')).toHaveValue('reviewer')
    expect(within(card.getByLabelText('Level 1')).getAllByRole('option').map((o) => o.textContent)).toEqual(['Not set', 'Engineer', 'Manager', 'Director'])
    expect(card.getByLabelText('Group name 2')).toHaveValue('quality')
    expect(card.getByLabelText('Level 2')).toHaveValue('approver')
  })

  it('keeps a group that is in only one list as a half-set row, and says a group needs both', async () => {
    open(ports({ mappings: { departments: [{ groupName: 'only-dept', departmentId: 'd-eng' }], levels: [{ groupName: 'only-level', level: 'approver' }], tenantRoles: [] } }))
    const card = await deptCard()
    await waitFor(() => expect(card.getByLabelText('Group name 1')).toHaveValue('only-dept'))
    expect(card.getByLabelText('Level 1')).toHaveValue('')
    expect(card.getByLabelText('Group name 2')).toHaveValue('only-level')
    expect(card.getByLabelText('Department 2')).toHaveValue('')
    expect(card.getAllByText('A group needs both a department and a level to grant access.')).toHaveLength(2)
  })

  it('keeps a mapped department the tenant no longer has active, and names it', async () => {
    open(ports({ mappings: { departments: [{ groupName: 'old', departmentId: 'd-old' }], levels: [], tenantRoles: [] } }))
    const card = await deptCard()
    await waitFor(() => expect(card.getByLabelText('Department 1')).toHaveValue('d-old'))
    expect(within(card.getByLabelText('Department 1')).getAllByRole('option').map((o) => o.textContent)).toContain('Retired Dept')
  })

  it('offers only active departments for a new row', async () => {
    open(ports())
    const card = await deptCard()
    await userEvent.click(card.getByRole('button', { name: 'Add group' }))
    const select = card.getByLabelText('Department 3')
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Not set', 'Engineering', 'QA / QC'])
  })

  it('says there is nothing mapped yet', async () => {
    open(ports({ mappings: { departments: [], levels: [], tenantRoles: [] } }))
    expect(await screen.findByText('No group is mapped to a department yet.')).toBeInTheDocument()
    expect(await screen.findByText('No group is mapped to a role yet.')).toBeInTheDocument()
  })

  it('writes both lists, departments first, with trimmed names, and says so; the table reloads with what was saved', async () => {
    const p = ports()
    const view = open(p)
    const card = await deptCard()
    await card.findByLabelText('Group name 1')
    await userEvent.click(card.getByRole('button', { name: 'Add group' }))
    await userEvent.type(card.getByLabelText('Group name 3'), '  tenders  ')
    await userEvent.selectOptions(card.getByLabelText('Department 3'), 'd-qa')
    await userEvent.selectOptions(card.getByLabelText('Level 3'), 'preparator')
    await userEvent.click(card.getByRole('button', { name: 'Save department mappings' }))
    await waitFor(() => expect(p.groupMapping.putLevels).toHaveBeenCalled())
    expect(p.groupMapping.putDepartments).toHaveBeenCalledWith([...initial.departments, { groupName: 'tenders', departmentId: 'd-qa' }])
    expect(p.groupMapping.putLevels).toHaveBeenCalledWith([...initial.levels, { groupName: 'tenders', level: 'preparator' }])
    const order = [(p.groupMapping.putDepartments as ReturnType<typeof rs.fn>).mock.invocationCallOrder[0]!, (p.groupMapping.putLevels as ReturnType<typeof rs.fn>).mock.invocationCallOrder[0]!]
    expect(order[0]).toBeLessThan(order[1]!)
    await waitFor(() => expect(p.groupMapping.getAll).toHaveBeenCalledTimes(2))
    expect(await (await deptCard()).findByText('Department mappings saved.')).toBeInTheDocument()
    expect((await deptCard()).getByLabelText('Group name 3')).toHaveValue('tenders')
    expect(view.calls).toContain('action:save_group_mappings:success')
  })

  it('removes a row, and writes the lists without it (an omitted row is deleted)', async () => {
    const p = ports()
    open(p)
    const card = await deptCard()
    await card.findByLabelText('Group name 1')
    await userEvent.click(card.getByRole('button', { name: 'Remove 1' }))
    await userEvent.click(card.getByRole('button', { name: 'Save department mappings' }))
    await waitFor(() => expect(p.groupMapping.putLevels).toHaveBeenCalled())
    expect(p.groupMapping.putDepartments).toHaveBeenCalledWith([{ groupName: 'quality', departmentId: 'd-qa' }])
    expect(p.groupMapping.putLevels).toHaveBeenCalledWith([{ groupName: 'quality', level: 'approver' }])
  })

  it('writes empty lists when every row is removed', async () => {
    const p = ports()
    open(p)
    const card = await deptCard()
    await card.findByLabelText('Group name 1')
    await userEvent.click(card.getByRole('button', { name: 'Remove 1' }))
    await userEvent.click(card.getByRole('button', { name: 'Remove 1' }))
    await userEvent.click(card.getByRole('button', { name: 'Save department mappings' }))
    await waitFor(() => expect(p.groupMapping.putDepartments).toHaveBeenCalledWith([]))
    expect(p.groupMapping.putLevels).toHaveBeenCalledWith([])
  })

  it.each([
    ['a row with no group name', async (c: ReturnType<typeof within>) => { await userEvent.click(c.getByRole('button', { name: 'Add group' })); await userEvent.selectOptions(c.getByLabelText('Department 3'), 'd-eng') }, 'Every row needs a group name.'],
    ['the same group twice', async (c: ReturnType<typeof within>) => { await userEvent.clear(c.getByLabelText('Group name 2')); await userEvent.type(c.getByLabelText('Group name 2'), 'eng') }, 'Each group can appear once in a list.'],
    ['a group name over 255 bytes', async (c: ReturnType<typeof within>) => { const i = c.getByLabelText('Group name 1'); await userEvent.clear(i); await userEvent.click(i); await userEvent.paste('é'.repeat(128)) }, 'A group name can be up to 255 bytes.'],
  ])('refuses %s before sending, and says why', async (_n, change, message) => {
    const p = ports()
    open(p)
    const card = await deptCard()
    await card.findByLabelText('Group name 1')
    await change(card)
    await userEvent.click(card.getByRole('button', { name: 'Save department mappings' }))
    expect(await card.findByRole('alert')).toHaveTextContent(message)
    expect(p.groupMapping.putDepartments).not.toHaveBeenCalled()
  })

  it('says which part saved when the second write fails, and retries only the rest', async () => {
    const putLevels = rs.fn().mockRejectedValueOnce(problem(503, 'DB_UNAVAILABLE')).mockResolvedValue([])
    const p = ports({ groups: { putLevels } })
    const view = open(p)
    const card = await deptCard()
    await card.findByLabelText('Group name 1')
    await userEvent.click(card.getByRole('button', { name: 'Remove 2' }))
    await userEvent.click(card.getByRole('button', { name: 'Save department mappings' }))
    const alert = await card.findByRole('alert')
    expect(alert).toHaveTextContent('The departments were saved, but the levels were not.')
    expect(alert).toHaveTextContent('Nothing was changed. Try again.')
    expect(view.calls).toContain('action:save_group_mappings:error')
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry the rest' }))
    await waitFor(() => expect(putLevels).toHaveBeenCalledTimes(2))
    expect(p.groupMapping.putDepartments).toHaveBeenCalledTimes(1)
    expect(putLevels.mock.calls[1]![0]).toEqual([{ groupName: 'eng', level: 'reviewer' }])
    expect(await (await deptCard()).findByText('Department mappings saved.')).toBeInTheDocument()
  })

  it('forgets a half-finished save when the table is edited again, so the retry offer goes away', async () => {
    const putLevels = rs.fn().mockRejectedValue(problem(503, 'DB_UNAVAILABLE'))
    open(ports({ groups: { putLevels } }))
    const card = await deptCard()
    await card.findByLabelText('Group name 1')
    await userEvent.click(card.getByRole('button', { name: 'Save department mappings' }))
    await card.findByRole('button', { name: 'Retry the rest' })
    await userEvent.type(card.getByLabelText('Group name 1'), 'x')
    expect(card.queryByRole('button', { name: 'Retry the rest' })).not.toBeInTheDocument()
  })

  it.each([
    ['409 MAPPING_CONFLICT', problem(409, 'MAPPING_CONFLICT'), 'Someone else is saving mappings. Try again.'],
    ['422 DEPARTMENT_NOT_IN_CATALOG', problem(422, 'DEPARTMENT_NOT_IN_CATALOG'), 'Pick a department from the catalogue.'],
    ['503 CATALOG_SERVICE_UNAVAILABLE', problem(503, 'CATALOG_SERVICE_UNAVAILABLE'), 'Nothing was changed. Try again.'],
  ])('shows %s in plain words, with no partial-save claim when the first write failed', async (_n, error, message) => {
    const putDepartments = rs.fn(async () => { throw error })
    const p = ports({ groups: { putDepartments } })
    open(p)
    const card = await deptCard()
    await card.findByLabelText('Group name 1')
    await userEvent.click(card.getByRole('button', { name: 'Save department mappings' }))
    const alert = await card.findByRole('alert')
    expect(alert).toHaveTextContent(message)
    expect(alert).not.toHaveTextContent('were saved')
    expect(p.groupMapping.putLevels).not.toHaveBeenCalled()
  })

  it('offers Reload when the mappings changed underneath (a lock conflict), and Reload asks again', async () => {
    const putDepartments = rs.fn(async () => { throw problem(409, 'OPTIMISTIC_LOCK_CONFLICT') })
    const p = ports({ groups: { putDepartments } })
    open(p)
    const card = await deptCard()
    await card.findByLabelText('Group name 1')
    await userEvent.click(card.getByRole('button', { name: 'Save department mappings' }))
    const dialog = await screen.findByRole('dialog', { name: 'This changed while you were editing' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reload' }))
    await waitFor(() => expect(p.groupMapping.getAll).toHaveBeenCalledTimes(2))
  })

  it('shows the table read-only in a read-only workspace, with the reason', async () => {
    open(ports(), { readOnly: true })
    const card = await deptCard()
    await waitFor(() => expect(card.getByLabelText('Group name 1')).toBeDisabled())
    expect(card.getByRole('button', { name: 'Save department mappings' })).toBeDisabled()
    expect(card.getByRole('button', { name: 'Add group' })).toBeDisabled()
    expect(screen.getByText('This workspace is read-only (subscription ended).', { selector: 'p[role="status"]' })).toBeInTheDocument()
  })
})

describe('E5 groups to roles', () => {
  it('shows the role mappings, and lets an owner edit every row including the owner row', async () => {
    open(ports())
    const card = await roleCard()
    await waitFor(() => expect(card.getByLabelText('Group name for role 1')).toHaveValue('owners'))
    expect(card.getByLabelText('Role 1')).toHaveValue('tenant_owner')
    expect(card.getByLabelText('Group name for role 1')).toBeEnabled()
    expect(within(card.getByLabelText('Role 2')).getAllByRole('option').map((o) => o.textContent)).toEqual(['Owner', 'Admin', 'Tender admin'])
  })

  it('writes the whole role list, adds a row, and says so; the table reloads with what was saved', async () => {
    const p = ports()
    const view = open(p)
    const card = await roleCard()
    await card.findByLabelText('Group name for role 1')
    await userEvent.click(card.getByRole('button', { name: 'Add group' }))
    await userEvent.type(card.getByLabelText('Group name for role 3'), 'estimators')
    await userEvent.click(card.getByRole('button', { name: 'Save role mappings' }))
    await waitFor(() => expect(p.groupMapping.putTenantRoles).toHaveBeenCalledWith([...initial.tenantRoles, { groupName: 'estimators', role: 'tender_admin' }]))
    await waitFor(() => expect(p.groupMapping.getAll).toHaveBeenCalledTimes(2))
    expect(await (await roleCard()).findByText('Role mappings saved.')).toBeInTheDocument()
    expect((await roleCard()).getByLabelText('Group name for role 3')).toHaveValue('estimators')
    expect(p.groupMapping.putDepartments).not.toHaveBeenCalled()
    expect(view.calls).toContain('action:save_group_mappings:success')
  })

  it('removes a row and changes a role', async () => {
    const p = ports()
    open(p)
    const card = await roleCard()
    await card.findByLabelText('Group name for role 1')
    await userEvent.selectOptions(card.getByLabelText('Role 2'), 'tender_admin')
    await userEvent.click(card.getByRole('button', { name: 'Remove 1' }))
    await userEvent.click(card.getByRole('button', { name: 'Save role mappings' }))
    await waitFor(() => expect(p.groupMapping.putTenantRoles).toHaveBeenCalledWith([{ groupName: 'admins', role: 'tender_admin' }]))
  })

  it.each([
    ['a row with no group name', async (c: ReturnType<typeof within>) => { await userEvent.click(c.getByRole('button', { name: 'Add group' })) }, 'Every row needs a group name.'],
    ['the same group twice', async (c: ReturnType<typeof within>) => { await userEvent.clear(c.getByLabelText('Group name for role 2')); await userEvent.type(c.getByLabelText('Group name for role 2'), 'owners') }, 'Each group can appear once in a list.'],
  ])('refuses %s before sending', async (_n, change, message) => {
    const p = ports()
    open(p)
    const card = await roleCard()
    await card.findByLabelText('Group name for role 1')
    await change(card)
    await userEvent.click(card.getByRole('button', { name: 'Save role mappings' }))
    expect(await card.findByRole('alert')).toHaveTextContent(message)
    expect(p.groupMapping.putTenantRoles).not.toHaveBeenCalled()
  })

  it('locks an owner mapping for an admin, offers no owner role, and lets the admin save the rest beside it', async () => {
    const p = ports()
    open(p, { permissions: ADMIN })
    const card = await roleCard()
    await waitFor(() => expect(card.getByLabelText('Group name for role 1')).toHaveValue('owners'))
    expect(card.getByLabelText('Group name for role 1')).toBeDisabled()
    expect(card.getByLabelText('Role 1')).toBeDisabled()
    expect(card.getByText('Only an owner can change an owner mapping.')).toBeInTheDocument()
    expect(card.queryByRole('button', { name: 'Remove 1' })).not.toBeInTheDocument()
    await userEvent.click(card.getByRole('button', { name: 'Add group' }))
    expect(within(card.getByLabelText('Role 3')).getAllByRole('option').map((o) => o.textContent)).toEqual(['Admin', 'Tender admin'])
    await userEvent.type(card.getByLabelText('Group name for role 3'), 'estimators')
    await userEvent.click(card.getByRole('button', { name: 'Save role mappings' }))
    await waitFor(() => expect(p.groupMapping.putTenantRoles).toHaveBeenCalledWith([...initial.tenantRoles, { groupName: 'estimators', role: 'tender_admin' }]))
  })

  it('lets an admin save the department table beside owner rows too', async () => {
    const p = ports()
    open(p, { permissions: ADMIN })
    const card = await deptCard()
    await card.findByLabelText('Group name 1')
    await userEvent.click(card.getByRole('button', { name: 'Save department mappings' }))
    await waitFor(() => expect(p.groupMapping.putLevels).toHaveBeenCalled())
    expect(p.groupMapping.putTenantRoles).not.toHaveBeenCalled()
  })

  it('shows the service\'s refusal when only an owner may change an owner mapping (403)', async () => {
    const putTenantRoles = rs.fn(async () => { throw problem(403, 'ROLE_ASSIGNMENT_FORBIDDEN') })
    const view = open(ports({ groups: { putTenantRoles } }))
    const card = await roleCard()
    await card.findByLabelText('Group name for role 1')
    await userEvent.click(card.getByRole('button', { name: 'Save role mappings' }))
    expect(await card.findByRole('alert')).toHaveTextContent('Only an owner can change owner mappings.')
    expect(view.calls).toContain('action:save_group_mappings:failure')
  })

  it('shows a lost lock race as Reload', async () => {
    const putTenantRoles = rs.fn(async () => { throw problem(409, 'VERSION_CONFLICT') })
    const p = ports({ groups: { putTenantRoles } })
    open(p)
    const card = await roleCard()
    await card.findByLabelText('Group name for role 1')
    await userEvent.click(card.getByRole('button', { name: 'Save role mappings' }))
    const dialog = await screen.findByRole('dialog', { name: 'This changed while you were editing' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('reloads on Reload', async () => {
    const putTenantRoles = rs.fn(async () => { throw problem(409, 'VERSION_CONFLICT') })
    const p = ports({ groups: { putTenantRoles } })
    open(p)
    const card = await roleCard()
    await card.findByLabelText('Group name for role 1')
    await userEvent.click(card.getByRole('button', { name: 'Save role mappings' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Reload' }))
    await waitFor(() => expect(p.groupMapping.getAll).toHaveBeenCalledTimes(2))
  })

  it('disables the role table in a read-only workspace', async () => {
    open(ports(), { readOnly: true })
    const card = await roleCard()
    await waitFor(() => expect(card.getByLabelText('Group name for role 2')).toBeDisabled())
    expect(card.getByRole('button', { name: 'Save role mappings' })).toBeDisabled()
  })

  it('shows a plain member no controls', async () => {
    open(ports(), { permissions: ['read:members'] })
    const card = await roleCard()
    await waitFor(() => expect(card.getByLabelText('Group name for role 1')).toBeDisabled())
    expect(card.queryByRole('button', { name: 'Save role mappings' })).not.toBeInTheDocument()
    expect((await deptCard()).queryByRole('button', { name: 'Save department mappings' })).not.toBeInTheDocument()
  })
})
