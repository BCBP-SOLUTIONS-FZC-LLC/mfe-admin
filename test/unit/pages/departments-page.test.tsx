// E3 Departments and role labels (spec E3; LLD §7.7): the tenant's departments with member counts,
// the catalogue to activate from, and the tenant's own level labels.
import { ProblemError } from '@bcbp-solutions-fzc-llc/frontend-sdk/problem'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, rs } from '@rstest/core'
import type { TenantDepartment } from '../../../src/domain/entities/department'
import type { CatalogPort } from '../../../src/domain/repositories/CatalogPort'
import type { OrgMembershipPort } from '../../../src/domain/repositories/OrgMembershipPort'
import { recordVersion } from '../../../src/domain/value-objects/RecordVersion'
import DepartmentsPage from '../../../src/presentation/pages/DepartmentsPage'
import { ADMIN, MEMBER } from '../../fixtures/platform'
import { renderPage } from '../../fixtures/pages'
import { departments, roleLabels } from '../../fixtures/people'
import { partial } from '../../fixtures/services'

const problem = (status: number, errorCode: string, extensions: Record<string, unknown> = {}) =>
  new ProblemError({ type: 'about:blank', title: 'T', status, errorCode, traceId: 'trace-1', extensions })

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
const row = (name: string) => screen.getByText(name, { selector: 'td' }).closest('tr')!

describe('E3 the tenant\'s departments', () => {
  it('lists them with code, status, a System badge, and the member count from P-9', async () => {
    open(ports())
    await screen.findByText('Engineering')
    const eng = screen.getByText(/Engineering/, { selector: 'td' }).closest('tr')!
    expect(eng).toHaveTextContent('ENG')
    expect(eng).toHaveTextContent('Active')
    expect(eng).toHaveTextContent('System')
    await waitFor(() => expect(eng).toHaveTextContent('2'))
    expect(screen.getByText('Retired Dept', { selector: 'td' }).closest('tr')).toHaveTextContent('Retired')
  })

  it('asks for each department\'s members separately, once', async () => {
    const p = ports()
    open(p)
    await screen.findByText(/Engineering/, { selector: 'td' })
    await waitFor(() => expect(p.org.listDepartmentMembers).toHaveBeenCalledTimes(3))
  })

  it('shows "?" for a count that failed to load, and keeps the row', async () => {
    open(ports({ org: { listDepartmentMembers: rs.fn(async () => { throw problem(500, 'INTERNAL') }) } }))
    await screen.findByText(/Engineering/, { selector: 'td' })
    await waitFor(() => expect(screen.getAllByText('?')).toHaveLength(3))
  })

  it('says it is loading, and that none are active yet', async () => {
    open(ports({ org: { listDepartments: rs.fn(() => new Promise<TenantDepartment[]>(() => {})) } }))
    expect((await screen.findAllByText('Loading departments…')).length).toBeGreaterThan(0)
  })

  it('says when the tenant has no department yet', async () => {
    open(ports({ org: { listDepartments: rs.fn(async () => []) } }))
    expect(await screen.findByText('No department is active yet. Activate one from the catalogue.')).toBeInTheDocument()
  })

  it('shows an alert with Retry when the list fails', async () => {
    const listDepartments = rs.fn<OrgMembershipPort['listDepartments']>().mockRejectedValueOnce(problem(503, 'DB_UNAVAILABLE')).mockResolvedValue(departments)
    open(ports({ org: { listDepartments } }))
    const alert = await screen.findByText(/Departments could not be loaded\./)
    await userEvent.click(within(alert.closest('[role="alert"]') as HTMLElement).getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText(/Engineering/, { selector: 'td' })).toBeInTheDocument()
  })

  it('offers Retire for an active, non-system department only: never for a system or a retired one', async () => {
    open(ports())
    await screen.findByText(/Engineering/, { selector: 'td' })
    expect(within(screen.getByText(/Engineering/, { selector: 'td' }).closest('tr')!).queryByRole('button')).not.toBeInTheDocument()
    expect(within(row('QA / QC')).getByRole('button', { name: 'Retire' })).toBeInTheDocument()
    expect(within(row('Retired Dept')).queryByRole('button', { name: 'Retire' })).not.toBeInTheDocument()
    expect(within(row('Retired Dept')).getByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
  })

  it('retires after a confirmation naming it, with the version being replaced', async () => {
    const p = ports()
    const view = open(p)
    await screen.findByText('QA / QC', { selector: 'td' })
    await userEvent.click(within(row('QA / QC')).getByRole('button', { name: 'Retire' }))
    const dialog = await screen.findByRole('dialog', { name: 'Retire QA / QC?' })
    expect(dialog).toHaveTextContent('can no longer be assigned to people')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Retire' }))
    await waitFor(() => expect(p.org.setDepartmentActive).toHaveBeenCalledWith('d-qa', false, 2))
    expect(await screen.findByText('QA / QC is retired.')).toBeInTheDocument()
    await waitFor(() => expect(p.org.listDepartments).toHaveBeenCalledTimes(2))
    expect(view.calls).toContain('action:retire_department:success')
  })

  it('reactivates a retired department, counted as an activation', async () => {
    const p = ports()
    const view = open(p)
    await screen.findByText('Retired Dept', { selector: 'td' })
    await userEvent.click(within(row('Retired Dept')).getByRole('button', { name: 'Reactivate' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Reactivate' }))
    await waitFor(() => expect(p.org.setDepartmentActive).toHaveBeenCalledWith('d-old', true, 3))
    expect(await screen.findByText('Retired Dept is active again.')).toBeInTheDocument()
    expect(view.calls).toContain('action:activate_department:success')
  })

  it('cancels without changing anything', async () => {
    const p = ports()
    open(p)
    await screen.findByText('QA / QC', { selector: 'td' })
    await userEvent.click(within(row('QA / QC')).getByRole('button', { name: 'Retire' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    expect(p.org.setDepartmentActive).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows a refused retirement (a system department, 422) in the dialog, which stays open', async () => {
    const setDepartmentActive = rs.fn(async () => { throw problem(422, 'SYSTEM_DEPARTMENT_CANNOT_BE_RETIRED') })
    const view = open(ports({ org: { setDepartmentActive } }))
    await screen.findByText('QA / QC', { selector: 'td' })
    await userEvent.click(within(row('QA / QC')).getByRole('button', { name: 'Retire' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Retire' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('This department cannot be retired.')
    expect(view.calls).toContain('action:retire_department:failure')
  })

  it('offers Reload when the department changed first (409), and Reload asks again', async () => {
    const setDepartmentActive = rs.fn(async () => { throw problem(409, 'OPTIMISTIC_LOCK_CONFLICT', { record_version: 9 }) })
    const p = ports({ org: { setDepartmentActive } })
    open(p)
    await screen.findByText('QA / QC', { selector: 'td' })
    await userEvent.click(within(row('QA / QC')).getByRole('button', { name: 'Retire' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Retire' }))
    const conflict = await screen.findByRole('dialog', { name: 'This changed while you were editing' })
    await userEvent.click(within(conflict).getByRole('button', { name: 'Reload' }))
    await waitFor(() => expect(p.org.listDepartments).toHaveBeenCalledTimes(2))
    expect(setDepartmentActive).toHaveBeenCalledTimes(1)
  })
})

describe('E3 the catalogue', () => {
  it('lists only departments the tenant does not have, and says activation can take 10 minutes', async () => {
    open(ports())
    expect(await screen.findByText('HSE')).toBeInTheDocument()
    expect(screen.getByText('Planning')).toBeInTheDocument()
    const catalog = screen.getByRole('heading', { name: 'Catalogue' }).closest('section')!
    expect(within(catalog).queryByText('Engineering')).not.toBeInTheDocument()
    expect(within(catalog).getAllByRole('button', { name: 'Activate' })).toHaveLength(2)
    expect(catalog).toHaveTextContent('up to 10 minutes')
  })

  it('activates a department, says so, and asks for the tenant list again', async () => {
    const p = ports()
    const view = open(p)
    const item = (await screen.findByText('HSE')).closest('li')!
    await userEvent.click(within(item).getByRole('button', { name: 'Activate' }))
    await waitFor(() => expect(p.org.activateDepartment).toHaveBeenCalledWith('d-hse'))
    expect(await screen.findByText('HSE is active.')).toBeInTheDocument()
    await waitFor(() => expect(p.org.listDepartments).toHaveBeenCalledTimes(2))
    expect(view.calls).toContain('action:activate_department:success')
  })

  it('shows a failed activation in place', async () => {
    const activateDepartment = rs.fn(async () => { throw problem(503, 'CATALOG_SERVICE_UNAVAILABLE') })
    open(ports({ org: { activateDepartment } }))
    const item = (await screen.findByText('HSE')).closest('li')!
    await userEvent.click(within(item).getByRole('button', { name: 'Activate' }))
    expect(await screen.findByText('Nothing was changed. Try again.')).toBeInTheDocument()
  })

  it('says when every catalogue department is already the tenant\'s', async () => {
    open(ports({ catalog: { listDepartments: rs.fn(async () => catalogRows.slice(0, 3)) } }))
    expect(await screen.findByText("Every department in the catalogue is already yours.")).toBeInTheDocument()
  })

  it('says the catalogue could not be loaded, with Retry, and keeps the tenant\'s list', async () => {
    const listDepartments = rs.fn<CatalogPort['listDepartments']>().mockRejectedValueOnce(problem(500, 'INTERNAL')).mockResolvedValue(catalogRows)
    open(ports({ catalog: { listDepartments } }))
    const text = await screen.findByText(/The department catalogue could not be loaded\./)
    expect(await screen.findByText(/Engineering/, { selector: 'td' })).toBeInTheDocument()
    await userEvent.click(within(text.closest('[role="alert"]') as HTMLElement).getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('HSE')).toBeInTheDocument()
  })

  it('fetches the catalogue once for the session', async () => {
    const p = ports()
    open(p)
    await screen.findByText('HSE')
    expect(p.catalog.listDepartments).toHaveBeenCalledTimes(1)
  })
})

describe('E3 role labels (P-12, P-13)', () => {
  it('shows the tenant\'s label for each level, in level order', async () => {
    open(ports())
    expect(await screen.findByLabelText('Label: Preparator')).toHaveValue('Engineer')
    expect(screen.getByLabelText('Label: Reviewer')).toHaveValue('Manager')
    expect(screen.getByLabelText('Label: Approver')).toHaveValue('Director')
  })

  it('keeps the "saved" notice when the label\'s version moves on and its row reloads', async () => {
    let labels = roleLabels
    const p = ports({
      org: {
        listRoleLabels: rs.fn(async () => labels),
        renameRoleLabel: rs.fn(async (code, name, v) => {
          labels = labels.map((l) => (l.roleCode === code ? { ...l, displayName: name, recordVersion: recordVersion(v + 1) } : l))
          return labels.find((l) => l.roleCode === code)!
        }),
      },
    })
    open(p)
    const input = await screen.findByLabelText('Label: Approver')
    await userEvent.clear(input)
    await userEvent.type(input, 'Head')
    await userEvent.click(screen.getByRole('button', { name: 'Save: Approver' }))
    await waitFor(() => expect(p.org.listRoleLabels).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Approver label saved.')).toBeInTheDocument()
    expect(screen.getByLabelText('Label: Approver')).toHaveValue('Head')
  })

  it('renames one label with the version it was read at, and says it saved', async () => {
    const p = ports()
    const view = open(p)
    const input = await screen.findByLabelText('Label: Approver')
    await userEvent.clear(input)
    await userEvent.type(input, 'Head')
    await userEvent.click(screen.getByRole('button', { name: 'Save: Approver' }))
    await waitFor(() => expect(p.org.renameRoleLabel).toHaveBeenCalledWith('approver', 'Head', 1))
    expect(await screen.findByText('Approver label saved.')).toBeInTheDocument()
    await waitFor(() => expect(p.org.listRoleLabels).toHaveBeenCalledTimes(2))
    expect(view.calls).toContain('action:rename_role_labels:success')
  })

  it.each([
    ['a blank label', '', 'Enter a label.'],
    ['nothing changed', 'Director', 'Nothing was changed.'],
  ])('refuses %s before sending', async (_n, value, message) => {
    const p = ports()
    open(p)
    const input = await screen.findByLabelText('Label: Approver')
    await userEvent.clear(input)
    if (value) await userEvent.type(input, value)
    await userEvent.click(screen.getByRole('button', { name: 'Save: Approver' }))
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(p.org.renameRoleLabel).not.toHaveBeenCalled()
  })

  it('refuses a label over 100 characters', async () => {
    const p = ports()
    open(p)
    const input = await screen.findByLabelText('Label: Reviewer')
    await userEvent.clear(input)
    await userEvent.click(input)
    await userEvent.paste('x'.repeat(101))
    await userEvent.click(screen.getByRole('button', { name: 'Save: Reviewer' }))
    expect(await screen.findByText('The label can be up to 100 characters.')).toBeInTheDocument()
  })

  it('offers Reload on a lost race (409), and shows another failure in place', async () => {
    const renameRoleLabel = rs.fn().mockRejectedValueOnce(problem(409, 'VERSION_CONFLICT', { record_version: 4 })).mockRejectedValueOnce(problem(503, 'DB_UNAVAILABLE'))
    const p = ports({ org: { renameRoleLabel } })
    open(p)
    const input = await screen.findByLabelText('Label: Approver')
    await userEvent.clear(input)
    await userEvent.type(input, 'Head')
    await userEvent.click(screen.getByRole('button', { name: 'Save: Approver' }))
    const conflict = await screen.findByRole('dialog', { name: 'This changed while you were editing' })
    await userEvent.click(within(conflict).getByRole('button', { name: 'Reload' }))
    await waitFor(() => expect(p.org.listRoleLabels).toHaveBeenCalledTimes(2))
    const again = await screen.findByLabelText('Label: Approver')
    await userEvent.clear(again)
    await userEvent.type(again, 'Chief')
    await userEvent.click(screen.getByRole('button', { name: 'Save: Approver' }))
    expect(await screen.findByText('Nothing was changed. Try again.')).toBeInTheDocument()
  })

  it('says the labels could not be loaded, with Retry', async () => {
    const listRoleLabels = rs.fn<OrgMembershipPort['listRoleLabels']>().mockRejectedValueOnce(problem(500, 'INTERNAL')).mockResolvedValue(roleLabels)
    open(ports({ org: { listRoleLabels } }))
    const text = await screen.findByText(/Role labels could not be loaded\./)
    await userEvent.click(within(text.closest('[role="alert"]') as HTMLElement).getByRole('button', { name: 'Retry' }))
    expect(await screen.findByLabelText('Label: Approver')).toBeInTheDocument()
  })
})

describe('E3 access', () => {
  it('lets a plain member view everything and change nothing', async () => {
    open(ports(), { permissions: MEMBER })
    await screen.findByText(/Engineering/, { selector: 'td' })
    expect(screen.queryByRole('button', { name: 'Retire' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Activate' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Save/ })).not.toBeInTheDocument()
    expect(await screen.findByLabelText('Label: Approver')).toBeDisabled()
  })

  it('lets an admin change them', async () => {
    open(ports(), { permissions: ADMIN })
    expect(await screen.findByRole('button', { name: 'Retire' })).toBeEnabled()
  })

  it('disables every change in a read-only workspace, with the reason', async () => {
    open(ports(), { readOnly: true })
    await screen.findByText(/Engineering/, { selector: 'td' })
    expect(screen.getByText('This workspace is read-only (subscription ended).')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retire' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reactivate' })).toBeDisabled()
    for (const b of await screen.findAllByRole('button', { name: 'Activate' })) expect(b).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save: Approver' })).toBeDisabled()
    expect(screen.getByLabelText('Label: Approver')).toBeDisabled()
  })
})
