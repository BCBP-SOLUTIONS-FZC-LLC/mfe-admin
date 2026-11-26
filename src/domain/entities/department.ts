import type { RecordVersion } from '../value-objects/RecordVersion'
import type { DepartmentLevel } from '../vocabulary'

/** A department the tenant has activated (P-3). The answer carries the catalogue's name and code. */
export interface TenantDepartment {
  readonly departmentId: string
  readonly code: string
  readonly name: string
  readonly isActive: boolean
  /** System departments cannot be retired (`SYSTEM_DEPARTMENT_CANNOT_BE_RETIRED`). */
  readonly isSystem: boolean
  readonly recordVersion: RecordVersion
}

/** A department in the global catalogue (`GET /departments`), whether or not the tenant uses it. */
export interface CatalogDepartment {
  readonly departmentId: string
  readonly code: string
  readonly name: string
  readonly isActive: boolean
  readonly isSystem: boolean
}

/** The tenant's own label for a department level (P-12). The code never changes; only the label does. */
export interface RoleLabel {
  readonly roleCode: DepartmentLevel
  readonly displayName: string
  readonly recordVersion: RecordVersion
}

/** What P-24 and P-25 answer: whether the department is active for the tenant, and the version to use next. */
export interface DepartmentVersion {
  readonly departmentId: string
  readonly isActive: boolean
  readonly recordVersion: RecordVersion
}
