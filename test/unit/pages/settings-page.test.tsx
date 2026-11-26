// E6 Tenant settings (spec E6; LLD §7.9): the workspace block (an owner's) and the delegation policy
// block (an admin's or owner's), each loading and failing on its own.
import { ProblemError } from '@bcbp-solutions-fzc-llc/frontend-sdk/problem'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, rs } from '@rstest/core'
import type { TenantSettings } from '../../../src/domain/entities/settings'
import type { DelegationPolicyPort } from '../../../src/domain/repositories/DelegationPolicyPort'
import type { OrgMembershipPort } from '../../../src/domain/repositories/OrgMembershipPort'
import { recordVersion } from '../../../src/domain/value-objects/RecordVersion'
import SettingsPage from '../../../src/presentation/pages/SettingsPage'
import { REALM_SYNC_POLL_MS } from '../../../src/presentation/features/settings/useSettings'
import { settings } from '../../fixtures/domain'
import { ADMIN, MEMBER } from '../../fixtures/platform'
import { renderPage } from '../../fixtures/pages'
import { partial } from '../../fixtures/services'

const problem = (status: number, errorCode: string, extensions: Record<string, unknown> = {}) =>
  new ProblemError({ type: 'about:blank', title: 'T', status, errorCode, traceId: 'trace-1', extensions })

function ports(o: { org?: Partial<OrgMembershipPort>; delegation?: Partial<DelegationPolicyPort>; current?: TenantSettings } = {}) {
  // The service keeps state: a save changes what the next read returns, and bumps the version, as
  // the real one does (a fixed answer would hide what a version change does to the form).
  let current = o.current ?? settings()
  let policy = { maxDurationDays: 90, reviewWindowDays: 90 }
  const org = partial<OrgMembershipPort>('orgMembership', {
    getTenant: rs.fn(async () => current),
    updateTenant: rs.fn(async (patch) => {
      current = { ...current, ...patch, recordVersion: recordVersion(current.recordVersion + 1) } as TenantSettings
      return { settings: current, realmSyncPending: false }
    }),
    ...o.org,
  })
  const delegation = partial<DelegationPolicyPort>('delegationPolicy', {
    get: rs.fn(async () => policy),
    put: rs.fn(async (next) => ((policy = next), policy)),
    ...o.delegation,
  })
  return { org, delegation }
}

const open = (p: ReturnType<typeof ports>, o: Parameters<typeof renderPage>[1] = {}) => renderPage(<SettingsPage />, { path: '/admin/settings', services: { orgMembership: p.org, delegationPolicy: p.delegation }, ...o })
const workspace = async () => within((await screen.findByRole('heading', { name: 'Workspace' })).closest('section')!)
const delegation = async () => within((await screen.findByRole('heading', { name: 'Delegation policy' })).closest('section')!)

afterEach(() => rs.useRealTimers())

describe('E6 workspace block', () => {
  it('shows the settings, and the plan and status read-only', async () => {
    open(ports())
    const ws = await workspace()
    await waitFor(() => expect(ws.getByLabelText('Workspace name')).toHaveValue('Acme'))
    expect(ws.getByLabelText('Default language')).toHaveValue('en')
    expect(ws.getByLabelText('Approver MFA freshness (seconds)')).toHaveValue(300)
    expect(ws.getByLabelText('Local accounts')).toBeChecked()
    expect(ws.getByRole('radio', { name: 'Standard' })).toBeChecked()
    expect(ws.getByText(/Pro/)).toBeInTheDocument()
    expect(ws.getByText(/Active/)).toBeInTheDocument()
    expect(ws.getByText('Takes effect when single sign-on enforcement is enabled.')).toBeInTheDocument()
  })

  it('sends only what changed, with the version it was read at, and says it saved', async () => {
    const p = ports()
    const view = open(p)
    const ws = await workspace()
    const name = await ws.findByLabelText('Workspace name')
    await userEvent.clear(name)
    await userEvent.type(name, 'Acme Ltd')
    const mfa = ws.getByLabelText('Approver MFA freshness (seconds)')
    await userEvent.clear(mfa)
    await userEvent.type(mfa, '600')
    await userEvent.click(ws.getByRole('button', { name: 'Save workspace' }))
    await waitFor(() => expect(p.org.updateTenant).toHaveBeenCalledWith({ name: 'Acme Ltd', mfaFreshnessSeconds: 600, recordVersion: 7 }))
    await waitFor(() => expect(p.org.getTenant).toHaveBeenCalledTimes(2))
    // The version moved on (7 → 8), so the form reloaded with the saved values, and the notice survived that.
    expect(await (await workspace()).findByText('Settings saved.')).toBeInTheDocument()
    expect((await workspace()).getByLabelText('Workspace name')).toHaveValue('Acme Ltd')
    expect(view.calls).toContain('action:save_settings:success')
  })

  it('sends a changed language, local accounts and residency, and warns about strict', async () => {
    const p = ports({ current: settings({ defaultLocale: 'fr' }) })
    open(p)
    const ws = await workspace()
    await waitFor(() => expect(ws.getByLabelText('Default language')).toHaveValue('fr'))
    expect(within(ws.getByLabelText('Default language')).getAllByRole('option').map((o) => o.textContent)).toEqual(['English', 'French'])
    await userEvent.selectOptions(ws.getByLabelText('Default language'), 'en')
    await userEvent.click(ws.getByLabelText('Local accounts'))
    await userEvent.click(ws.getByRole('radio', { name: 'Strict' }))
    expect(ws.getByText(/AI drafting may be unavailable/)).toBeInTheDocument()
    await userEvent.click(ws.getByRole('button', { name: 'Save workspace' }))
    await waitFor(() => expect(p.org.updateTenant).toHaveBeenCalledWith({ defaultLocale: 'en', localAccountsEnabled: false, residencyMode: 'strict', recordVersion: 7 }))
  })

  it('says "Saving to sign-in settings…" while the realm part applies (202), and polls until it is done', async () => {
    rs.useFakeTimers({ shouldAdvanceTime: true })
    const base = settings()
    const getTenant = rs
      .fn<OrgMembershipPort['getTenant']>()
      .mockResolvedValueOnce(base)
      .mockResolvedValueOnce({ ...base, name: 'Acme Ltd', recordVersion: recordVersion(8), realmSyncPending: true })
      .mockResolvedValue({ ...base, name: 'Acme Ltd', recordVersion: recordVersion(8), realmSyncPending: false })
    const p = ports({ org: { getTenant, updateTenant: rs.fn(async () => ({ settings: base, realmSyncPending: true })) } })
    open(p)
    const ws = await workspace()
    const name = await ws.findByLabelText('Workspace name')
    await userEvent.clear(name)
    await userEvent.type(name, 'Acme Ltd')
    await userEvent.click(ws.getByRole('button', { name: 'Save workspace' }))
    expect(await (await workspace()).findByText('Saving to sign-in settings…')).toBeInTheDocument()
    expect((await workspace()).queryByText('Settings saved.')).not.toBeInTheDocument()
    await act(async () => {
      await rs.advanceTimersByTimeAsync(REALM_SYNC_POLL_MS + 100)
    })
    await waitFor(async () => expect((await workspace()).queryByText('Saving to sign-in settings…')).not.toBeInTheDocument())
    expect(getTenant).toHaveBeenCalledTimes(3)
  })

  it.each([
    ['a blank name', (ws: ReturnType<typeof within>) => userEvent.clear(ws.getByLabelText('Workspace name')), 'Enter a workspace name.'],
    ['an MFA window under 60', async (ws: ReturnType<typeof within>) => { await userEvent.clear(ws.getByLabelText('Approver MFA freshness (seconds)')); await userEvent.type(ws.getByLabelText('Approver MFA freshness (seconds)'), '59') }, 'Enter a whole number of seconds from 60 to 900.'],
    ['an MFA window over 900', async (ws: ReturnType<typeof within>) => { await userEvent.clear(ws.getByLabelText('Approver MFA freshness (seconds)')); await userEvent.type(ws.getByLabelText('Approver MFA freshness (seconds)'), '901') }, 'Enter a whole number of seconds from 60 to 900.'],
    ['nothing changed', async () => {}, 'Nothing was changed.'],
  ])('refuses %s before sending', async (_n, change, message) => {
    const p = ports()
    open(p)
    const ws = await workspace()
    await waitFor(() => expect(ws.getByLabelText('Workspace name')).toHaveValue('Acme'))
    await change(ws)
    await userEvent.click(ws.getByRole('button', { name: 'Save workspace' }))
    expect(await ws.findByRole('alert')).toHaveTextContent(message)
    expect(p.org.updateTenant).not.toHaveBeenCalled()
  })

  it('offers Reload on a lost race (409), and shows another failure in place', async () => {
    const updateTenant = rs.fn().mockRejectedValueOnce(problem(409, 'OPTIMISTIC_LOCK_CONFLICT', { record_version: 8 })).mockRejectedValueOnce(problem(503, 'REALM_PROVISIONER_UNAVAILABLE'))
    const p = ports({ org: { updateTenant } })
    const view = open(p)
    const ws = await workspace()
    const name = await ws.findByLabelText('Workspace name')
    await userEvent.clear(name)
    await userEvent.type(name, 'New name')
    await userEvent.click(ws.getByRole('button', { name: 'Save workspace' }))
    const conflict = await screen.findByRole('dialog', { name: 'This changed while you were editing' })
    await userEvent.click(within(conflict).getByRole('button', { name: 'Reload' }))
    await waitFor(() => expect(p.org.getTenant).toHaveBeenCalledTimes(2))
    await userEvent.click(ws.getByRole('button', { name: 'Save workspace' }))
    expect(await ws.findByText('Nothing was changed. Try again.')).toBeInTheDocument()
    expect(view.calls).toContain('action:save_settings:failure')
    expect(view.calls).toContain('action:save_settings:error')
  })

  it('shows an alert with Retry when the settings cannot be loaded, and still shows the delegation block', async () => {
    const getTenant = rs.fn<OrgMembershipPort['getTenant']>().mockRejectedValueOnce(problem(503, 'DB_UNAVAILABLE')).mockResolvedValue(settings())
    open(ports({ org: { getTenant } }))
    const alert = await screen.findByText(/Workspace settings could not be loaded\./)
    expect(await delegation()).toBeTruthy()
    await userEvent.click(within(alert.closest('[role="alert"]') as HTMLElement).getByRole('button', { name: 'Retry' }))
    expect(await (await workspace()).findByLabelText('Workspace name')).toBeInTheDocument()
  })

  it('says it is loading', async () => {
    open(ports({ org: { getTenant: rs.fn(() => new Promise<TenantSettings>(() => {})) } }))
    expect((await screen.findAllByText('Loading settings…')).length).toBeGreaterThan(0)
  })

  it('shows an admin the workspace block read-only, with a note that it is the owner\'s', async () => {
    open(ports(), { permissions: ADMIN })
    const ws = await workspace()
    await waitFor(() => expect(ws.getByLabelText('Workspace name')).toBeDisabled())
    expect(ws.getByText('Only an owner can change these.')).toBeInTheDocument()
    expect(ws.queryByRole('button', { name: 'Save workspace' })).not.toBeInTheDocument()
  })

  it('disables everything in a read-only workspace, with the reason', async () => {
    open(ports(), { readOnly: true })
    const ws = await workspace()
    await waitFor(() => expect(ws.getByLabelText('Workspace name')).toBeDisabled())
    expect(ws.getByLabelText('Local accounts')).toBeDisabled()
    expect(ws.getByRole('button', { name: 'Save workspace' })).toBeDisabled()
    expect(ws.getByRole('button', { name: 'Save workspace' })).toHaveAttribute('title', 'This workspace is read-only (subscription ended).')
    expect(screen.getByText('This workspace is read-only (subscription ended).', { selector: 'p[role="status"]' })).toBeInTheDocument()
  })
})

describe('E6 delegation policy block', () => {
  it('shows the policy and saves both lengths, saying so', async () => {
    const p = ports()
    const view = open(p)
    const d = await delegation()
    await waitFor(() => expect(d.getByLabelText('Longest delegation (days)')).toHaveValue(90))
    expect(d.getByLabelText('Review window (days)')).toHaveValue(90)
    const max = d.getByLabelText('Longest delegation (days)')
    await userEvent.clear(max)
    await userEvent.type(max, '30')
    await userEvent.click(d.getByRole('button', { name: 'Save policy' }))
    await waitFor(() => expect(p.delegation.put).toHaveBeenCalledWith({ maxDurationDays: 30, reviewWindowDays: 90 }))
    await waitFor(() => expect(p.delegation.get).toHaveBeenCalledTimes(2))
    // The values changed, so the form reloaded with them, and the notice survived that.
    expect(await (await delegation()).findByText('Delegation policy saved.')).toBeInTheDocument()
    expect((await delegation()).getByLabelText('Longest delegation (days)')).toHaveValue(30)
    expect(view.calls).toContain('action:save_delegation_policy:success')
  })

  it.each([['0'], ['181'], ['1.5'], ['']])('refuses %j days', async (value) => {
    const p = ports()
    open(p)
    const d = await delegation()
    const review = await d.findByLabelText('Review window (days)')
    await userEvent.clear(review)
    if (value) await userEvent.type(review, value)
    await userEvent.click(d.getByRole('button', { name: 'Save policy' }))
    expect(await d.findByRole('alert')).toHaveTextContent('Enter a whole number of days from 1 to 180.')
    expect(review).toHaveAttribute('aria-invalid', 'true')
    expect(p.delegation.put).not.toHaveBeenCalled()
  })

  it('accepts 1 and 180', async () => {
    const p = ports()
    open(p)
    const d = await delegation()
    const max = await d.findByLabelText('Longest delegation (days)')
    await userEvent.clear(max)
    await userEvent.type(max, '180')
    const review = d.getByLabelText('Review window (days)')
    await userEvent.clear(review)
    await userEvent.type(review, '1')
    await userEvent.click(d.getByRole('button', { name: 'Save policy' }))
    await waitFor(() => expect(p.delegation.put).toHaveBeenCalledWith({ maxDurationDays: 180, reviewWindowDays: 1 }))
  })

  it('shows a failed save in place', async () => {
    const put = rs.fn(async () => { throw problem(503, 'DB_UNAVAILABLE') })
    open(ports({ delegation: { put } }))
    const d = await delegation()
    const max = await d.findByLabelText('Longest delegation (days)')
    await userEvent.clear(max)
    await userEvent.type(max, '10')
    await userEvent.click(d.getByRole('button', { name: 'Save policy' }))
    expect(await d.findByText('Nothing was changed. Try again.')).toBeInTheDocument()
  })

  it('shows an alert with Retry when it cannot be loaded, and still shows the workspace block', async () => {
    const get = rs.fn<DelegationPolicyPort['get']>().mockRejectedValueOnce(problem(500, 'INTERNAL')).mockResolvedValue({ maxDurationDays: 90, reviewWindowDays: 90 })
    open(ports({ delegation: { get } }))
    const alert = await screen.findByText(/The delegation policy could not be loaded\./)
    expect(await workspace()).toBeTruthy()
    await userEvent.click(within(alert.closest('[role="alert"]') as HTMLElement).getByRole('button', { name: 'Retry' }))
    expect(await (await delegation()).findByLabelText('Longest delegation (days)')).toBeInTheDocument()
  })

  it('lets an admin change it', async () => {
    open(ports(), { permissions: ADMIN })
    const d = await delegation()
    await waitFor(() => expect(d.getByLabelText('Longest delegation (days)')).toBeEnabled())
    expect(d.getByRole('button', { name: 'Save policy' })).toBeEnabled()
  })

  it('shows a plain member the values and no control, with a note', async () => {
    open(ports(), { permissions: MEMBER })
    const d = await delegation()
    await waitFor(() => expect(d.getByLabelText('Longest delegation (days)')).toBeDisabled())
    expect(d.getByText('Only an admin or owner can change this.')).toBeInTheDocument()
    expect(d.queryByRole('button', { name: 'Save policy' })).not.toBeInTheDocument()
  })

  it('disables the save in a read-only workspace', async () => {
    open(ports(), { readOnly: true })
    const d = await delegation()
    await waitFor(() => expect(d.getByLabelText('Longest delegation (days)')).toBeDisabled())
    expect(d.getByRole('button', { name: 'Save policy' })).toBeDisabled()
  })
})
