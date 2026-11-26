// E5's data and writes: the three group-mapping lists (GM-1…GM-6) and saving them. Each list is a
// full replacement. The department table is two writes (`departments`, then `department-roles`): if
// the second fails after the first went through, the hook says the first is saved so the screen can
// offer to retry only the rest.
import { useState } from 'react'
import type { DepartmentMapping, LevelMapping, TenantRoleMapping } from '../../../domain/entities/groupMapping'
import { useAdminUseCases } from '../services'
import { useTrackedMutation, useTrackedQuery } from '../tracked'
import { useAdminKeys } from '../workspace'

/** Asked only when the plan allows mappings: a trial or Starter workspace has nothing to read. */
export function useGroupMappings(enabled: boolean) {
  const useCases = useAdminUseCases()
  const { keys } = useAdminKeys()
  return useTrackedQuery({ resource: 'group_mappings', queryKey: keys.groupMappings('all'), enabled, queryFn: () => useCases.getGroupMappings.execute() })
}

/** Both department-table writes, in order; `skipDepartments` retries only the second after the first was saved. */
export function useSaveDepartmentMappings() {
  const useCases = useAdminUseCases()
  const [departmentsSaved, setDepartmentsSaved] = useState(false)
  const mutation = useTrackedMutation({
    action: 'save_group_mappings',
    mutationFn: async (v: { departments: readonly DepartmentMapping[]; levels: readonly LevelMapping[]; skipDepartments: boolean }) => {
      if (!v.skipDepartments) {
        await useCases.putDepartmentMappings.execute(v.departments)
        setDepartmentsSaved(true)
      }
      await useCases.putLevelMappings.execute(v.levels)
      setDepartmentsSaved(false)
    },
    invalidate: (keys) => [[...keys.all, 'group_mappings']],
  })
  return {
    mutation,
    /** The first write went through and the second did not: only the rest is left to do. */
    departmentsSaved: departmentsSaved && mutation.isError,
    /** Forgets a half-finished save (the user edited the table again). */
    forget: () => {
      setDepartmentsSaved(false)
      mutation.reset()
    },
  }
}

/** GM-6 */
export function useSaveTenantRoleMappings() {
  const useCases = useAdminUseCases()
  return useTrackedMutation({
    action: 'save_group_mappings',
    mutationFn: (mappings: readonly TenantRoleMapping[]) => useCases.putTenantRoleMappings.execute(mappings),
    invalidate: (keys) => [[...keys.all, 'group_mappings']],
  })
}
