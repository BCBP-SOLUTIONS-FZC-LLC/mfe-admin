// E3's data and writes: the tenant's departments (P-3), the global catalogue, the tenant's level
// labels (P-12) and the changes an admin makes to them. The department list and the labels share
// their query keys with the directory the other screens use, so one load serves all of them.
import type { RecordVersion } from '../../../domain/value-objects/RecordVersion'
import type { DepartmentLevel } from '../../../domain/vocabulary'
import { useAdminUseCases } from '../services'
import { useTrackedMutation, useTrackedQuery } from '../tracked'
import { useAdminKeys } from '../workspace'

export function useTenantDepartments() {
  const useCases = useAdminUseCases()
  const { keys } = useAdminKeys()
  return useTrackedQuery({ resource: 'departments', queryKey: keys.departments(), queryFn: (signal) => useCases.listDepartments.execute(signal) })
}

/** The catalogue is the same all session: fetched once. */
export function useCatalog() {
  const useCases = useAdminUseCases()
  const { keys } = useAdminKeys()
  return useTrackedQuery({ resource: 'catalog', queryKey: keys.catalog(), staleTime: Number.POSITIVE_INFINITY, queryFn: (signal) => useCases.listCatalogDepartments.execute(signal) })
}

export function useRoleLabelList() {
  const useCases = useAdminUseCases()
  const { keys } = useAdminKeys()
  return useTrackedQuery({ resource: 'role_labels', queryKey: keys.roleLabels(), queryFn: (signal) => useCases.listRoleLabels.execute(signal) })
}

/** P-24: activate a catalogue department for the tenant. */
export function useActivateDepartment() {
  const useCases = useAdminUseCases()
  return useTrackedMutation({
    action: 'activate_department',
    mutationFn: (departmentId: string) => useCases.activateDepartment.execute(departmentId),
    invalidate: (keys) => [keys.departments()],
  })
}

/** P-25: retire a department (counted as a retirement). */
export function useRetireDepartment() {
  const useCases = useAdminUseCases()
  return useTrackedMutation({
    action: 'retire_department',
    mutationFn: (v: { departmentId: string; recordVersion: RecordVersion }) => useCases.setDepartmentActive.execute(v.departmentId, false, v.recordVersion),
    invalidate: (keys) => [keys.departments()],
  })
}

/** P-25: bring a retired department back (counted as an activation). */
export function useReactivateDepartment() {
  const useCases = useAdminUseCases()
  return useTrackedMutation({
    action: 'activate_department',
    mutationFn: (v: { departmentId: string; recordVersion: RecordVersion }) => useCases.setDepartmentActive.execute(v.departmentId, true, v.recordVersion),
    invalidate: (keys) => [keys.departments()],
  })
}

/** P-13: rename a level's label with the version being replaced. */
export function useRenameRoleLabel() {
  const useCases = useAdminUseCases()
  return useTrackedMutation({
    action: 'rename_role_labels',
    mutationFn: (v: { roleCode: DepartmentLevel; displayName: string; recordVersion: RecordVersion }) => useCases.renameRoleLabel.execute(v.roleCode, v.displayName, v.recordVersion),
    invalidate: (keys) => [keys.roleLabels()],
  })
}
