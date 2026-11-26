import type { DepartmentMapping, GroupMappings, LevelMapping, TenantRoleMapping } from '../entities/groupMapping'

/**
 * Group Mapping (IAM), GM-1…GM-6. Each list is a full replacement: the whole list is sent and an
 * omitted row is deleted. Saving the department table is two writes (`departments` then
 * `department-roles`); the caller reports which part saved if the second fails (IAM-UX-10).
 */
export interface GroupMappingPort {
  /** GM-1, GM-3, GM-5 */
  getAll(signal?: AbortSignal): Promise<GroupMappings>
  /** GM-2: `/departments` */
  putDepartments(mappings: readonly DepartmentMapping[], signal?: AbortSignal): Promise<readonly DepartmentMapping[]>
  /** GM-4: `/department-roles` */
  putLevels(mappings: readonly LevelMapping[], signal?: AbortSignal): Promise<readonly LevelMapping[]>
  /** GM-6: `/tenant-roles` */
  putTenantRoles(mappings: readonly TenantRoleMapping[], signal?: AbortSignal): Promise<readonly TenantRoleMapping[]>
}
