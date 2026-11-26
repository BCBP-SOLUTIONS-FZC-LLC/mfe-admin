import type { DepartmentLevel, TenantRole } from '../vocabulary'

// IdP group → access, at the user's next SSO sign-in (additive only). Three full-replacement lists:
// send the whole list, an omitted row is deleted (IAM-UX-10).

export interface DepartmentMapping {
  readonly groupName: string
  readonly departmentId: string
}

/** The level a group grants in the department its DepartmentMapping names (`role_code` on the wire). */
export interface LevelMapping {
  readonly groupName: string
  readonly level: DepartmentLevel
}

export interface TenantRoleMapping {
  readonly groupName: string
  readonly role: TenantRole
}

export interface GroupMappings {
  readonly departments: readonly DepartmentMapping[]
  readonly levels: readonly LevelMapping[]
  readonly tenantRoles: readonly TenantRoleMapping[]
}
