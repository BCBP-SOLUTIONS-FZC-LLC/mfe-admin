// E1's data: the member list (P-4, keyset-paged), seat usage (P-27), pending invitations (P-30), and
// the writes that change them. Names are joined in the component from useUserProfiles (IAM-UX-4).
import { parseCursor } from '../../../domain/value-objects/Cursor'
import type { InvitationRequest } from '../../../domain/entities/invitation'
import type { RecordVersion } from '../../../domain/value-objects/RecordVersion'
import { useAdminUseCases } from '../services'
import { useTrackedInfiniteQuery, useTrackedMutation, useTrackedQuery } from '../tracked'
import { useAdminKeys } from '../workspace'

/** A page of 50 (spec E1): one batch of profiles per page. */
export const MEMBER_PAGE_SIZE = 50

export function useMemberList() {
  const useCases = useAdminUseCases()
  const { keys } = useAdminKeys()
  return useTrackedInfiniteQuery({
    resource: 'members',
    queryKey: keys.members({ limit: MEMBER_PAGE_SIZE }),
    queryFn: (cursor, signal) => useCases.listMembers.execute({ limit: MEMBER_PAGE_SIZE, ...(cursor ? { cursor: parseCursor(cursor)! } : {}) }, signal),
    nextCursor: (page) => page.nextCursor,
  })
}

/** P-27 is for admins and owners: a plain member does not ask. */
export function useSeatUsage(enabled: boolean) {
  const useCases = useAdminUseCases()
  const { keys } = useAdminKeys()
  return useTrackedQuery({ resource: 'seat_usage', queryKey: keys.seatUsage(), enabled, queryFn: (signal) => useCases.getSeatUsage.execute(signal) })
}

export function useInvitations(enabled: boolean) {
  const useCases = useAdminUseCases()
  const { keys } = useAdminKeys()
  return useTrackedQuery({ resource: 'invitations', queryKey: keys.invitations(), enabled, queryFn: (signal) => useCases.listInvitations.execute(signal) })
}

/** P-6. A new pending invitation takes a seat, so seat usage is stale too. */
export function useInviteMember() {
  const useCases = useAdminUseCases()
  return useTrackedMutation({
    action: 'invite',
    mutationFn: (request: InvitationRequest) => useCases.invite.execute(request),
    invalidate: (keys) => [keys.invitations(), keys.seatUsage()],
  })
}

/** P-31: needs the invitation's version; frees the seat. */
export function useRevokeInvitation() {
  const useCases = useAdminUseCases()
  return useTrackedMutation({
    action: 'revoke_invitation',
    mutationFn: (v: { invitationId: string; recordVersion: RecordVersion }) => useCases.revokeInvitation.execute(v.invitationId, v.recordVersion),
    invalidate: (keys) => [keys.invitations(), keys.seatUsage()],
  })
}
