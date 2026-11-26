// E6 as designed for the settings screen: the intros, the switch for local accounts (still a labelled
// checkbox), residency as two option cards and the two-column fields (the behaviour behind them is in
// settings-page.test.tsx).
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, rs } from '@rstest/core'
import type { TenantSettings } from '../../../src/domain/entities/settings'
import type { DelegationPolicyPort } from '../../../src/domain/repositories/DelegationPolicyPort'
import type { OrgMembershipPort } from '../../../src/domain/repositories/OrgMembershipPort'
import { recordVersion } from '../../../src/domain/value-objects/RecordVersion'
import SettingsPage from '../../../src/presentation/pages/SettingsPage'
import { settings } from '../../fixtures/domain'
import { ADMIN } from '../../fixtures/platform'
import { renderPage } from '../../fixtures/pages'
import { partial } from '../../fixtures/services'

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

describe('E6 design', () => {
  it('introduces the page and each block', async () => {
    open(ports())
    expect(await screen.findByText(/How your workspace is named and signed into/)).toBeInTheDocument()
    expect(await screen.findByText('Name, language and sign-in rules for the whole workspace.')).toBeInTheDocument()
    expect(await screen.findByText('How long a delegation may run, and how long it can wait for review.')).toBeInTheDocument()
  })

  it('draws local accounts as a switch that is still a labelled checkbox, toggled with the keyboard', async () => {
    const p = ports()
    open(p)
    const ws = await workspace()
    const local = await ws.findByLabelText('Local accounts')
    expect(local).toHaveAttribute('type', 'checkbox')
    expect(local).toHaveAccessibleDescription('Takes effect when single sign-on enforcement is enabled.')
    local.focus()
    await userEvent.setup().keyboard(' ')
    expect(local).not.toBeChecked()
    await userEvent.setup().click(ws.getByRole('button', { name: 'Save workspace' }))
    await waitFor(() => expect(p.org.updateTenant).toHaveBeenCalledWith({ localAccountsEnabled: false, recordVersion: 7 }))
  })

  it('shows residency as two option cards and warns under Strict', async () => {
    open(ports())
    const ws = await workspace()
    expect(await ws.findByRole('radio', { name: 'Standard' })).toBeChecked()
    expect(ws.queryByText(/AI drafting may be unavailable/)).not.toBeInTheDocument()
    await userEvent.setup().click(ws.getByRole('radio', { name: 'Strict' }))
    expect(ws.getByRole('radio', { name: 'Standard' })).not.toBeChecked()
    expect(ws.getByText(/AI drafting may be unavailable/)).toBeInTheDocument()
  })

  it('disables the fields with the reason for someone who may not change them', async () => {
    open(ports(), { permissions: ['read:members'] })
    const ws = await workspace()
    expect(await ws.findByText('Only an owner can change these.')).toBeInTheDocument()
    expect(ws.getByLabelText('Workspace name')).toBeDisabled()
    expect(ws.getByLabelText('Local accounts')).toBeDisabled()
    expect(ws.queryByRole('button', { name: 'Save workspace' })).not.toBeInTheDocument()
  })

  it('names the languages in words, and shows a language with no name as its code', async () => {
    open(ports({ current: settings({ defaultLocale: 'xx' }) }))
    const ws = await workspace()
    const options = within(await ws.findByLabelText('Default language')).getAllByRole('option').map((o) => o.textContent)
    expect(options).toEqual(['English', 'xx'])
  })

  it('lets an admin change the delegation policy beside a locked workspace block', async () => {
    open(ports(), { permissions: ADMIN })
    const d = await delegation()
    expect(await d.findByLabelText('Longest delegation (days)')).toBeEnabled()
    expect(d.getByRole('button', { name: 'Save policy' })).toBeEnabled()
  })
})
