import type { DelegationPolicy } from '../entities/settings'

/** Delegation (IAM), the tenant policy only: DLG-6 (anyone may read) and DLG-7 (admin or owner write). */
export interface DelegationPolicyPort {
  /** DLG-6: the 90/90 default when the tenant has no saved policy. */
  get(signal?: AbortSignal): Promise<DelegationPolicy>
  /** DLG-7 */
  put(policy: DelegationPolicy, signal?: AbortSignal): Promise<DelegationPolicy>
}
