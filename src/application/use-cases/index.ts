// The application layer's use cases: one class per operation, built over the domain's repository
// ports. Presentation calls `execute()`; it never reaches a port or an adapter directly (ADR 0004).
import type { AuditPort } from '../../domain/repositories/AuditPort'
import type { CatalogPort } from '../../domain/repositories/CatalogPort'
import type { DelegationPolicyPort } from '../../domain/repositories/DelegationPolicyPort'
import type { GroupMappingPort } from '../../domain/repositories/GroupMappingPort'
import type { OrgMembershipPort } from '../../domain/repositories/OrgMembershipPort'
import type { UserProfilePort } from '../../domain/repositories/UserProfilePort'
import { GetTenantUseCase } from './GetTenantUseCase'
import { UpdateTenantUseCase } from './UpdateTenantUseCase'
import { ListDepartmentsUseCase } from './ListDepartmentsUseCase'
import { ActivateDepartmentUseCase } from './ActivateDepartmentUseCase'
import { SetDepartmentActiveUseCase } from './SetDepartmentActiveUseCase'
import { ListDepartmentMembersUseCase } from './ListDepartmentMembersUseCase'
import { AssignDepartmentUseCase } from './AssignDepartmentUseCase'
import { RemoveFromDepartmentUseCase } from './RemoveFromDepartmentUseCase'
import { ListMembersUseCase } from './ListMembersUseCase'
import { GetMemberUseCase } from './GetMemberUseCase'
import { InviteUseCase } from './InviteUseCase'
import { ListInvitationsUseCase } from './ListInvitationsUseCase'
import { RevokeInvitationUseCase } from './RevokeInvitationUseCase'
import { SetMemberStatusUseCase } from './SetMemberStatusUseCase'
import { RemoveMemberUseCase } from './RemoveMemberUseCase'
import { ResolveRemovalUseCase } from './ResolveRemovalUseCase'
import { SetRolesUseCase } from './SetRolesUseCase'
import { ResetMfaUseCase } from './ResetMfaUseCase'
import { GetSeatUsageUseCase } from './GetSeatUsageUseCase'
import { ListRoleLabelsUseCase } from './ListRoleLabelsUseCase'
import { RenameRoleLabelUseCase } from './RenameRoleLabelUseCase'
import { BatchUserProfilesUseCase } from './BatchUserProfilesUseCase'
import { GetUserProfileUseCase } from './GetUserProfileUseCase'
import { UpdateUserProfileUseCase } from './UpdateUserProfileUseCase'
import { ListCatalogDepartmentsUseCase } from './ListCatalogDepartmentsUseCase'
import { GetGroupMappingsUseCase } from './GetGroupMappingsUseCase'
import { PutDepartmentMappingsUseCase } from './PutDepartmentMappingsUseCase'
import { PutLevelMappingsUseCase } from './PutLevelMappingsUseCase'
import { PutTenantRoleMappingsUseCase } from './PutTenantRoleMappingsUseCase'
import { SearchAuditUseCase } from './SearchAuditUseCase'
import { GetAuditEntryUseCase } from './GetAuditEntryUseCase'
import { RequestAuditExportUseCase } from './RequestAuditExportUseCase'
import { GetAuditExportUseCase } from './GetAuditExportUseCase'
import { GetDelegationPolicyUseCase } from './GetDelegationPolicyUseCase'
import { PutDelegationPolicyUseCase } from './PutDelegationPolicyUseCase'

/** The repository ports the use cases are built over (the composition root supplies the adapters). */
export interface AdminRepositories {
  readonly orgMembership: OrgMembershipPort
  readonly userProfile: UserProfilePort
  readonly catalog: CatalogPort
  readonly groupMapping: GroupMappingPort
  readonly audit: AuditPort
  readonly delegationPolicy: DelegationPolicyPort
}

export interface AdminUseCases {
  readonly getTenant: GetTenantUseCase
  readonly updateTenant: UpdateTenantUseCase
  readonly listDepartments: ListDepartmentsUseCase
  readonly activateDepartment: ActivateDepartmentUseCase
  readonly setDepartmentActive: SetDepartmentActiveUseCase
  readonly listDepartmentMembers: ListDepartmentMembersUseCase
  readonly assignDepartment: AssignDepartmentUseCase
  readonly removeFromDepartment: RemoveFromDepartmentUseCase
  readonly listMembers: ListMembersUseCase
  readonly getMember: GetMemberUseCase
  readonly invite: InviteUseCase
  readonly listInvitations: ListInvitationsUseCase
  readonly revokeInvitation: RevokeInvitationUseCase
  readonly setMemberStatus: SetMemberStatusUseCase
  readonly removeMember: RemoveMemberUseCase
  readonly resolveRemoval: ResolveRemovalUseCase
  readonly setRoles: SetRolesUseCase
  readonly resetMfa: ResetMfaUseCase
  readonly getSeatUsage: GetSeatUsageUseCase
  readonly listRoleLabels: ListRoleLabelsUseCase
  readonly renameRoleLabel: RenameRoleLabelUseCase
  readonly batchUserProfiles: BatchUserProfilesUseCase
  readonly getUserProfile: GetUserProfileUseCase
  readonly updateUserProfile: UpdateUserProfileUseCase
  readonly listCatalogDepartments: ListCatalogDepartmentsUseCase
  readonly getGroupMappings: GetGroupMappingsUseCase
  readonly putDepartmentMappings: PutDepartmentMappingsUseCase
  readonly putLevelMappings: PutLevelMappingsUseCase
  readonly putTenantRoleMappings: PutTenantRoleMappingsUseCase
  readonly searchAudit: SearchAuditUseCase
  readonly getAuditEntry: GetAuditEntryUseCase
  readonly requestAuditExport: RequestAuditExportUseCase
  readonly getAuditExport: GetAuditExportUseCase
  readonly getDelegationPolicy: GetDelegationPolicyUseCase
  readonly putDelegationPolicy: PutDelegationPolicyUseCase
}

export function createUseCases(ports: AdminRepositories): AdminUseCases {
  return {
    getTenant: new GetTenantUseCase(ports.orgMembership),
    updateTenant: new UpdateTenantUseCase(ports.orgMembership),
    listDepartments: new ListDepartmentsUseCase(ports.orgMembership),
    activateDepartment: new ActivateDepartmentUseCase(ports.orgMembership),
    setDepartmentActive: new SetDepartmentActiveUseCase(ports.orgMembership),
    listDepartmentMembers: new ListDepartmentMembersUseCase(ports.orgMembership),
    assignDepartment: new AssignDepartmentUseCase(ports.orgMembership),
    removeFromDepartment: new RemoveFromDepartmentUseCase(ports.orgMembership),
    listMembers: new ListMembersUseCase(ports.orgMembership),
    getMember: new GetMemberUseCase(ports.orgMembership),
    invite: new InviteUseCase(ports.orgMembership),
    listInvitations: new ListInvitationsUseCase(ports.orgMembership),
    revokeInvitation: new RevokeInvitationUseCase(ports.orgMembership),
    setMemberStatus: new SetMemberStatusUseCase(ports.orgMembership),
    removeMember: new RemoveMemberUseCase(ports.orgMembership),
    resolveRemoval: new ResolveRemovalUseCase(ports.orgMembership),
    setRoles: new SetRolesUseCase(ports.orgMembership),
    resetMfa: new ResetMfaUseCase(ports.orgMembership),
    getSeatUsage: new GetSeatUsageUseCase(ports.orgMembership),
    listRoleLabels: new ListRoleLabelsUseCase(ports.orgMembership),
    renameRoleLabel: new RenameRoleLabelUseCase(ports.orgMembership),
    batchUserProfiles: new BatchUserProfilesUseCase(ports.userProfile),
    getUserProfile: new GetUserProfileUseCase(ports.userProfile),
    updateUserProfile: new UpdateUserProfileUseCase(ports.userProfile),
    listCatalogDepartments: new ListCatalogDepartmentsUseCase(ports.catalog),
    getGroupMappings: new GetGroupMappingsUseCase(ports.groupMapping),
    putDepartmentMappings: new PutDepartmentMappingsUseCase(ports.groupMapping),
    putLevelMappings: new PutLevelMappingsUseCase(ports.groupMapping),
    putTenantRoleMappings: new PutTenantRoleMappingsUseCase(ports.groupMapping),
    searchAudit: new SearchAuditUseCase(ports.audit),
    getAuditEntry: new GetAuditEntryUseCase(ports.audit),
    requestAuditExport: new RequestAuditExportUseCase(ports.audit),
    getAuditExport: new GetAuditExportUseCase(ports.audit),
    getDelegationPolicy: new GetDelegationPolicyUseCase(ports.delegationPolicy),
    putDelegationPolicy: new PutDelegationPolicyUseCase(ports.delegationPolicy),
  }
}
