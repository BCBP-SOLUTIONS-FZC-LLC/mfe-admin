import { useAdminUseCases } from '../services'
import { useTrackedQuery } from '../tracked'
import { useAdminKeys } from '../workspace'

/** P-9: who is in one department, with level (E1's department filter, E3's counts, the pickers). */
export function useDepartmentMembers(departmentId: string | undefined) {
  const useCases = useAdminUseCases()
  const { keys } = useAdminKeys()
  return useTrackedQuery({
    resource: 'departments',
    queryKey: keys.departmentMembers(departmentId ?? ''),
    enabled: departmentId !== undefined,
    queryFn: (signal) => useCases.listDepartmentMembers.execute(departmentId!, signal),
  })
}
