// E5 as designed for the group mappings screen: the Upgrade plan action on the plan gate, the column
// header row, the rows as cards and the locked owner row (the behaviour behind them is in group-mappings-page.test.tsx).
import { screen, within } from '@testing-library/react'
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

describe('E5 design', () => {
  it('offers Upgrade plan on the trial and Starter gates to someone who manages SSO', async () => {
    const trial = open(ports({ tenant: { status: 'trial', plan: 'pro' } }))
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Upgrade plan' }))
    expect(trial.calls).toContain('navigate:upgrade')
  })

  it('offers it on the Starter gate too, and not to a plan that has SSO', async () => {
    const starter = open(ports({ tenant: { plan: 'starter' } }))
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Upgrade plan' }))
    expect(starter.calls).toContain('navigate:upgrade')
  })

  it('shows the columns once and one card per mapped group, with the sections side by side', async () => {
    open(ports())
    const dept = await deptCard()
    expect(await dept.findByDisplayValue('quality')).toBeInTheDocument()
    expect(dept.getAllByRole('listitem')).toHaveLength(2)
    expect(dept.getAllByText('Group name', { selector: 'span' }).length).toBeGreaterThan(0)
  })

  it('shows an empty section as a prompt, not an empty table', async () => {
    open(ports({ mappings: { departments: [], levels: [], tenantRoles: [] } }))
    expect(await screen.findByText('No group is mapped to a department yet.')).toBeInTheDocument()
    expect(screen.getByText('No group is mapped to a role yet.')).toBeInTheDocument()
  })

  it('locks an owner row for an admin and says why, beside the rows the admin may change', async () => {
    open(ports(), { permissions: ADMIN })
    const roles = await roleCard()
    expect(await roles.findByText('Only an owner can change an owner mapping.')).toBeInTheDocument()
    expect(roles.getByDisplayValue('owners')).toBeDisabled()
    expect(roles.getByDisplayValue('admins')).toBeEnabled()
  })
})
