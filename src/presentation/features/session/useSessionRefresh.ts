// Refreshing the session context (IAM P-35) after the user's own roles change, or when the gateway
// answers DENY_ROLE_INSUFFICIENT (LLD §7.5, §8, §11; docs/lld/session-context-refresh-handoff.md). The
// SDK's `useRefreshSessionContext()` (alpha.10) asks the shell to reload and apply the context: one
// request at a time (callers join it), never rejecting, and `false` (with the old context kept) when
// the shell cannot or the load failed. The focus refresh is the shell's, so this does not add one.
// Deliberately not a private P-35 copy of the roles: two sources of truth would let useHasPermission
// and the screens disagree. A refresh that still shows the old roles (IAM's cache lag, handoff §6)
// is not retried in a loop: the next trigger or the shell's focus refresh corrects it.
import { useRefreshSessionContext } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { useCallback } from 'react'

export function useSessionRefresh(): () => Promise<void> {
  const refresh = useRefreshSessionContext()
  return useCallback(async () => {
    await refresh()
  }, [refresh])
}
