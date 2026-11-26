// E2's data and writes: the membership (P-5), the full profile with its version, the active owners
// (for the last-owner checks), and every change an admin can make to one member. A write names what
// it makes stale; the member's list rows and the seat meter follow.
import { parseCursor } from '../../../domain/value-objects/Cursor'
import type { RemovalResolution } from '../../../domain/entities/member'
import type { UserProfileEdit } from '../../../domain/repositories/UserProfilePort'
import type { RecordVersion } from '../../../domain/value-objects/RecordVersion'
import { OWNER, type DepartmentLevel, type TenantRole } from '../../../domain/vocabulary'
import { useAdminUseCases } from '../services'
import { useTrackedMutation, useTrackedQuery } from '../tracked'
import { useAdminKeys } from '../workspace'

export function useMemberDetail(userId: string) {
  const useCases = useAdminUseCases()
  const { keys } = useAdminKeys()
  return useTrackedQuery({ resource: 'members', queryKey: keys.member(userId), queryFn: (signal) => useCases.getMember.execute(userId, signal) })
}

/** GET /users/:id: the profile as it is now, with the version an edit must replace. */
export function useUserDetail(userId: string) {
  const useCases = useAdminUseCases()
  const { keys } = useAdminKeys()
  return useTrackedQuery({ resource: 'user_profiles', queryKey: keys.userDetail(userId), queryFn: (signal) => useCases.getUserProfile.execute(userId, signal) })
}

/** The page size used to walk the whole member list for owners. */
const OWNER_SCAN_PAGE = 200

/**
 * How many active members hold the owner role, across every page (P-4 has no filter, IAM-FE-Q5).
 * Only asked when the member on screen is an active owner: the answer decides whether removing,
 * suspending or demoting them would leave the workspace with no owner (IAM-UX-7). If it cannot be
 * had, the screen does not block: the service refuses the last owner itself (`422 LAST_OWNER_REMOVAL`).
 */
export function useActiveOwnerCount(enabled: boolean) {
  const useCases = useAdminUseCases()
  const { keys } = useAdminKeys()
  return useTrackedQuery({
    resource: 'members',
    queryKey: keys.owners(),
    enabled,
    queryFn: async (signal) => {
      let owners = 0
      let cursor: string | undefined
      do {
        const page = await useCases.listMembers.execute({ limit: OWNER_SCAN_PAGE, ...(cursor ? { cursor: parseCursor(cursor)! } : {}) }, signal)
        owners += page.members.filter((m) => m.status === 'active' && m.tenantRoles.includes(OWNER)).length
        cursor = page.nextCursor
      } while (cursor)
      return owners
    },
  })
}

/**
 * After any change to a member: everything under `members` (the member, the list pages and the owner
 * count share that prefix), as one invalidation so each active query is asked for again once.
 */
const memberKeys = (keys: ReturnType<typeof useAdminKeys>['keys']) => [[...keys.all, 'members']] as const

/** P-28: full replacement of the role list. */
export function useSetRoles(userId: string) {
  const useCases = useAdminUseCases()
  return useTrackedMutation({
    action: 'change_roles',
    mutationFn: (roles: readonly TenantRole[]) => useCases.setRoles.execute(userId, roles),
    invalidate: (keys) => [...memberKeys(keys)],
  })
}

/** P-7: suspend or reactivate, with the version being replaced. */
export function useSetMemberStatus(userId: string, action: 'suspend' | 'reactivate') {
  const useCases = useAdminUseCases()
  return useTrackedMutation({
    action,
    mutationFn: (v: { status: 'active' | 'suspended'; recordVersion: RecordVersion }) => useCases.setMemberStatus.execute(userId, v.status, v.recordVersion),
    invalidate: (keys) => [...memberKeys(keys), keys.seatUsage()],
  })
}

/** P-8: may answer `409 WORKFLOW_RESOLUTION_REQUIRED` (E2a step 2). */
export function useRemoveMember(userId: string) {
  const useCases = useAdminUseCases()
  return useTrackedMutation({
    action: 'remove',
    mutationFn: () => useCases.removeMember.execute(userId),
    invalidate: (keys) => [...memberKeys(keys), keys.seatUsage()],
  })
}

/** P-10: add a department or change a level (may answer a resolution request on a demotion). */
export function useAssignDepartment(userId: string) {
  const useCases = useAdminUseCases()
  return useTrackedMutation({
    action: 'assign_department',
    mutationFn: (v: { departmentId: string; level: DepartmentLevel }) => useCases.assignDepartment.execute(v.departmentId, userId, v.level),
    invalidate: (keys, _result, v) => [...memberKeys(keys), keys.departmentMembers(v.departmentId)],
  })
}

/** P-11 */
export function useRemoveFromDepartment(userId: string) {
  const useCases = useAdminUseCases()
  return useTrackedMutation({
    action: 'remove_from_department',
    mutationFn: (departmentId: string) => useCases.removeFromDepartment.execute(departmentId, userId),
    invalidate: (keys, _result, departmentId) => [...memberKeys(keys), keys.departmentMembers(departmentId)],
  })
}

/** P-26: hand the coverage on, or stop the workflows; the caller then re-sends the original call. */
export function useResolveRemoval(userId: string) {
  const useCases = useAdminUseCases()
  return useTrackedMutation({
    action: 'resolve_removal',
    mutationFn: (resolution: RemovalResolution) => useCases.resolveRemoval.execute(userId, resolution),
  })
}

/** P-34: needs fresh MFA (the caller steps up first). */
export function useResetMfa(userId: string) {
  const useCases = useAdminUseCases()
  return useTrackedMutation({ action: 'reset_mfa', mutationFn: () => useCases.resetMfa.execute(userId) })
}

/** PATCH /users/:id: an admin's edit of another user's profile (`expected_version`). */
export function useUpdateUser(userId: string) {
  const useCases = useAdminUseCases()
  return useTrackedMutation({
    action: 'update_profile',
    mutationFn: (edit: UserProfileEdit) => useCases.updateUserProfile.execute(userId, edit),
    invalidate: (keys) => [keys.userDetail(userId), keys.user(userId), [...keys.all, 'users', 'batch']],
  })
}
