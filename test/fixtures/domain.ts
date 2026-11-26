// Builders for domain values, with overrides: a test names only what it cares about.
import type { Invitation } from '../../src/domain/entities/invitation'
import type { Member } from '../../src/domain/entities/member'
import type { SeatUsage } from '../../src/domain/entities/seats'
import type { TenantSettings } from '../../src/domain/entities/settings'
import { recordVersion } from '../../src/domain/value-objects/RecordVersion'

export const member = (o: Partial<Member> = {}): Member => ({
  userId: 'u-1',
  status: 'active',
  tenantRoles: [],
  departments: [],
  recordVersion: recordVersion(3),
  ...o,
})

export const seats = (o: Partial<SeatUsage> = {}): SeatUsage => ({ activeUsers: 3, pendingInvitations: 1, licensedSeats: 10, ...o })

export const settings = (o: Partial<TenantSettings> = {}): TenantSettings => ({
  name: 'Acme',
  defaultLocale: 'en',
  mfaFreshnessSeconds: 300,
  localAccountsEnabled: true,
  residencyMode: 'standard',
  recordVersion: recordVersion(7),
  status: 'active',
  plan: 'pro',
  realmSyncPending: false,
  ...o,
})

export const invitation = (o: Partial<Invitation> = {}): Invitation => ({
  invitationId: 'inv-1',
  email: 'ada@example.com',
  fullName: 'Ada Lovelace',
  initialRoles: [],
  invitedBy: 'u-0',
  sentAt: '2026-11-20T10:00:00Z',
  expiresAt: '2026-11-27T10:00:00Z',
  recordVersion: recordVersion(1),
  ...o,
})
