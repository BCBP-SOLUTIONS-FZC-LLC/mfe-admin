// Members, users and departments for the screen tests.
import type { Member } from '../../src/domain/entities/member'
import type { Invitation } from '../../src/domain/entities/invitation'
import type { TenantDepartment, RoleLabel } from '../../src/domain/entities/department'
import type { UserSummary } from '../../src/domain/entities/user'
import { recordVersion } from '../../src/domain/value-objects/RecordVersion'
import { member } from './domain'

export const user = (id: string, name: string, o: Partial<UserSummary> = {}): UserSummary => ({
  userId: id,
  displayName: name,
  email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
  source: 'local',
  status: 'active',
  provisional: false,
  recordVersion: recordVersion(1),
  ...o,
})

export const ADA = user('u-ada', 'Ada Lovelace', { jobTitle: 'Chief Engineer', source: 'federated', availability: 'ooo' })
export const BOB = user('u-bob', 'Bob Builder', { jobTitle: 'Estimator' })
export const CY = user('u-cy', 'Cy Young', { status: 'disabled' })

export const members: Member[] = [
  member({ userId: 'u-ada', tenantRoles: ['tenant_owner'], departments: [{ departmentId: 'd-eng', level: 'approver' }] }),
  member({ userId: 'u-bob', tenantRoles: ['tender_admin'], departments: [{ departmentId: 'd-qa', level: 'reviewer' }, { departmentId: 'd-eng', level: 'preparator' }] }),
  member({ userId: 'u-cy', status: 'suspended', tenantRoles: [], departments: [] }),
]

export const departments: TenantDepartment[] = [
  { departmentId: 'd-eng', code: 'ENG', name: 'Engineering', isActive: true, isSystem: true, recordVersion: recordVersion(1) },
  { departmentId: 'd-qa', code: 'QAQC', name: 'QA / QC', isActive: true, isSystem: false, recordVersion: recordVersion(2) },
  { departmentId: 'd-old', code: 'OLD', name: 'Retired Dept', isActive: false, isSystem: false, recordVersion: recordVersion(3) },
]

export const roleLabels: RoleLabel[] = [
  { roleCode: 'preparator', displayName: 'Engineer', recordVersion: recordVersion(1) },
  { roleCode: 'reviewer', displayName: 'Manager', recordVersion: recordVersion(1) },
  { roleCode: 'approver', displayName: 'Director', recordVersion: recordVersion(1) },
]

export const invitation = (o: Partial<Invitation> = {}): Invitation => ({
  invitationId: 'inv-1',
  email: 'dee@example.com',
  fullName: 'Dee Dee',
  initialRoles: ['tender_admin'],
  invitedBy: 'u-ada',
  sentAt: '2026-11-20T10:00:00Z',
  expiresAt: '2026-11-27T10:00:00Z',
  recordVersion: recordVersion(4),
  ...o,
})
