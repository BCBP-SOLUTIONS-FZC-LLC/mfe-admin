// E6's data and writes: the workspace block (P-1, P-2) and the delegation policy block (DLG-6, DLG-7).
// A workspace save can answer `202`: the sign-in (realm) part is still applying, so the settings are
// asked again every 30 seconds until `realm_sync_pending` clears (the service itself retries about
// every 10 minutes).
import type { DelegationPolicy } from '../../../domain/entities/settings'
import type { TenantSettingsPatch } from '../../../domain/entities/settings'
import { useAdminUseCases } from '../services'
import { useTrackedMutation, useTrackedQuery } from '../tracked'
import { useAdminKeys } from '../workspace'

/** How often to ask again while the realm part of a save is still applying. */
export const REALM_SYNC_POLL_MS = 30_000

export function useTenantSettings() {
  const useCases = useAdminUseCases()
  const { keys } = useAdminKeys()
  return useTrackedQuery({
    resource: 'settings',
    queryKey: keys.settings(),
    queryFn: (signal) => useCases.getTenant.execute(signal),
    refetchInterval: (data) => (data?.realmSyncPending ? REALM_SYNC_POLL_MS : false),
  })
}

/** P-2, with the version being replaced; the settings are asked again after it. */
export function useUpdateTenant() {
  const useCases = useAdminUseCases()
  return useTrackedMutation({
    action: 'save_settings',
    mutationFn: (patch: TenantSettingsPatch) => useCases.updateTenant.execute(patch),
    invalidate: (keys) => [keys.settings()],
  })
}

export function useDelegationPolicy() {
  const useCases = useAdminUseCases()
  const { keys } = useAdminKeys()
  return useTrackedQuery({ resource: 'settings', queryKey: keys.delegationPolicy(), queryFn: (signal) => useCases.getDelegationPolicy.execute(signal) })
}

/** DLG-7 */
export function usePutDelegationPolicy() {
  const useCases = useAdminUseCases()
  return useTrackedMutation({
    action: 'save_delegation_policy',
    mutationFn: (policy: DelegationPolicy) => useCases.putDelegationPolicy.execute(policy),
    invalidate: (keys) => [keys.delegationPolicy()],
  })
}
