// E3 as designed for the departments screen: the header counts, the status pills and the three level cards
// (the behaviour behind them is in departments-page.test.tsx).
import { screen, within } from '@testing-library/react'
import { describe, expect, it, rs } from '@rstest/core'
import type { CatalogPort } from '../../../src/domain/repositories/CatalogPort'
import type { OrgMembershipPort } from '../../../src/domain/repositories/OrgMembershipPort'
import { recordVersion } from '../../../src/domain/value-objects/RecordVersion'
import DepartmentsPage from '../../../src/presentation/pages/DepartmentsPage'
import { renderPage } from '../../fixtures/pages'
import { departments, roleLabels } from '../../fixtures/people'
import { partial } from '../../fixtures/services'

const catalogRows = [
  { departmentId: 'd-eng', code: 'ENG', name: 'Engineering', isActive: true, isSystem: true },
  { departmentId: 'd-qa', code: 'QAQC', name: 'QA / QC', isActive: true, isSystem: false },
  { departmentId: 'd-old', code: 'OLD', name: 'Retired Dept', isActive: true, isSystem: false },
  { departmentId: 'd-hse', code: 'HSE', name: 'HSE', isActive: true, isSystem: false },
  { departmentId: 'd-plan', code: 'PLAN', name: 'Planning', isActive: true, isSystem: false },
]

function ports(o: { org?: Partial<OrgMembershipPort>; catalog?: Partial<CatalogPort> } = {}) {
  const org = partial<OrgMembershipPort>('orgMembership', {
    listDepartments: rs.fn(async () => departments),
    listRoleLabels: rs.fn(async () => roleLabels),
    listDepartmentMembers: rs.fn(async (id: string) => (id === 'd-eng' ? [{ userId: 'u-1', level: 'approver' as const }, { userId: 'u-2', level: 'reviewer' as const }] : [])),
    activateDepartment: rs.fn(async (id: string) => ({ departmentId: id, isActive: true, recordVersion: recordVersion(1) })),
    setDepartmentActive: rs.fn(async (id: string, isActive: boolean, v) => ({ departmentId: id, isActive, recordVersion: recordVersion(v + 1) })),
    renameRoleLabel: rs.fn(async (code, name, v) => ({ roleCode: code, displayName: name, recordVersion: recordVersion(v + 1) })),
    ...o.org,
  })
  const catalog = partial<CatalogPort>('catalog', { listDepartments: rs.fn(async () => catalogRows), ...o.catalog })
  return { org, catalog }
}

const open = (p: ReturnType<typeof ports>, o: Parameters<typeof renderPage>[1] = {}) => renderPage(<DepartmentsPage />, { path: '/admin/departments', services: { orgMembership: p.org, catalog: p.catalog }, ...o })

describe('E3 design', () => {
  it('counts the active and retired departments and what the catalogue still offers', async () => {
    open(ports())
    const active = await screen.findByText('Active departments')
    expect(active.previousElementSibling).toHaveTextContent(String(departments.filter((d) => d.isActive).length))
    expect(screen.getAllByText('Retired')[0]!.previousElementSibling).toHaveTextContent(String(departments.filter((d) => !d.isActive).length))
    const owned = new Set(departments.map((d) => d.departmentId))
    expect(screen.getByText('In the catalogue').previousElementSibling).toHaveTextContent(String(catalogRows.filter((c) => !owned.has(c.departmentId)).length))
  })

  it('shows the three levels as cards with their own labels, each its own editable name', async () => {
    open(ports())
    const section = (await screen.findByRole('heading', { name: 'Role labels' })).closest('section')!
    const cards = await within(section).findAllByRole('listitem')
    expect(cards).toHaveLength(3)
    expect(within(cards[0]!).getByLabelText(/Label: Preparator/)).toBeInTheDocument()
    expect(within(cards[2]!).getByLabelText(/Label: Approver/)).toBeInTheDocument()
  })

  it('offers each catalogue department on a card with Activate', async () => {
    open(ports())
    const catalog = (await screen.findByRole('heading', { name: 'Catalogue' })).closest('section')!
    const planning = (await within(catalog).findByText('Planning')).closest('li')!
    expect(planning).toHaveTextContent('(PLAN)')
    expect(within(planning).getByRole('button', { name: 'Activate' })).toBeInTheDocument()
  })
})
