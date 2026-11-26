// E1 and E1a as designed for the users screen: member search over the loaded members, the seat card with
// its legend and "Upgrade plan" once nothing is free, tab counts, and the invite dialog's seat count and
// role cards (the behaviour behind them is in users-page.test.tsx).
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, rs } from '@rstest/core'
import type { MemberPage } from '../../../src/domain/entities/member'
import type { OrgMembershipPort } from '../../../src/domain/repositories/OrgMembershipPort'
import type { UserProfilePort } from '../../../src/domain/repositories/UserProfilePort'
import UsersPage from '../../../src/presentation/pages/UsersPage'
import { seats } from '../../fixtures/domain'
import { renderPage } from '../../fixtures/pages'
import { ADA, BOB, CY, departments, invitation, members, roleLabels } from '../../fixtures/people'
import { partial } from '../../fixtures/services'

function setup(seatUsage = seats()) {
  const org = partial<OrgMembershipPort>('orgMembership', {
    listMembers: rs.fn(async () => ({ members } as MemberPage)),
    listDepartments: rs.fn(async () => departments),
    listRoleLabels: rs.fn(async () => roleLabels),
    getSeatUsage: rs.fn(async () => seatUsage),
    listInvitations: rs.fn(async () => [invitation()]),
  })
  const users = partial<UserProfilePort>('userProfile', {
    batch: rs.fn(async (ids: readonly string[]) => ({
      users: [ADA, BOB, CY].filter((u) => ids.includes(u.userId)),
      missing: [],
    })),
  })
  return renderPage(<UsersPage />, { services: { orgMembership: org, userProfile: users } })
}

describe('E1 design', () => {
  it('searches the loaded members by name or email, and says how many are shown', async () => {
    setup()
    const user = userEvent.setup()
    await screen.findByRole('link', { name: /Ada Lovelace/ })
    await user.type(screen.getByRole('searchbox', { name: 'Search members' }), 'bob')
    expect(screen.queryByRole('link', { name: /Ada Lovelace/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Bob Builder/ })).toBeInTheDocument()
    expect(screen.getByText('1 shown')).toBeInTheDocument()
    await user.clear(screen.getByRole('searchbox', { name: 'Search members' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search members' }), 'zzz-nobody')
    expect(await screen.findByText('No members match these filters.')).toBeInTheDocument()
  })

  it('shows the seat card with a legend of active, invited and free seats, and no upgrade while there is room', async () => {
    setup(seats({ activeUsers: 3, pendingInvitations: 1, licensedSeats: 10 }))
    expect(await screen.findByRole('progressbar', { name: /4 of 10 seats used/ })).toHaveAttribute('aria-valuenow', '4')
    expect(screen.getByText('3 active')).toBeInTheDocument()
    expect(screen.getByText('1 invited')).toBeInTheDocument()
    expect(screen.getByText('6 free')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Upgrade plan' })).not.toBeInTheDocument()
  })

  it('offers Upgrade plan on the seat card when no seat is free, and on the prompt that replaces the form', async () => {
    const { services, calls } = setup(seats({ activeUsers: 4, pendingInvitations: 0, licensedSeats: 4 }))
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Upgrade plan' }))
    expect(calls).toContain('navigate:upgrade')
    await user.click(screen.getByRole('button', { name: 'Invite user' }))
    const dialog = await screen.findByRole('dialog', { name: 'No free seats' })
    await user.click(within(dialog).getByRole('button', { name: 'Upgrade plan' }))
    expect(calls.filter((c) => c === 'navigate:upgrade')).toHaveLength(2)
    expect(services.navigation).toBeDefined()
  })

  it('counts members and pending invitations on the tabs without changing the tabs\' names', async () => {
    setup(seats({ activeUsers: 3, pendingInvitations: 1, licensedSeats: 10 }))
    const tab = await screen.findByRole('tab', { name: 'Pending invitations' })
    expect(tab).toHaveTextContent('1')
    expect(screen.getByRole('tab', { name: 'Members' })).toHaveTextContent('3')
  })

  it('tells the inviter how many seats are free, and describes each role it offers', async () => {
    setup(seats({ activeUsers: 3, pendingInvitations: 1, licensedSeats: 10 }))
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Invite user' }))
    const dialog = await screen.findByRole('dialog', { name: 'Invite user' })
    expect(within(dialog).getByText('6 seats free')).toBeInTheDocument()
    expect(within(dialog).getByRole('checkbox', { name: 'Owner' })).toHaveAccessibleDescription('Full control of the workspace')
  })
})
