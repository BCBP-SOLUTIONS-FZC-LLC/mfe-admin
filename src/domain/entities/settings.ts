import type { RecordVersion } from '../value-objects/RecordVersion'

export type ResidencyMode = 'standard' | 'strict'
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'cancelled' | 'suspended' | 'trial_expired' | 'offboarded'
export type Plan = 'starter' | 'pro' | 'enterprise'

/** The workspace block of E6 (P-1, P-2): the editable fields and the read-only facts beside them. */
export interface TenantSettings {
  readonly name: string
  readonly defaultLocale: string
  /** Seconds an approver's MFA stays fresh: 60 to 900. */
  readonly mfaFreshnessSeconds: number
  readonly localAccountsEnabled: boolean
  readonly residencyMode: ResidencyMode
  readonly recordVersion: RecordVersion
  readonly status: SubscriptionStatus
  readonly plan: Plan
  /** The realm part of a save is still applying (`202`): show "Saving to sign-in settings…". */
  readonly realmSyncPending: boolean
}

/** The delegation policy block of E6 (DLG-6, DLG-7): each 1 to 180 days. */
export interface DelegationPolicy {
  readonly maxDurationDays: number
  readonly reviewWindowDays: number
}

/** The changed fields of a settings save (P-2): only what changed, with the version being replaced. */
export interface TenantSettingsPatch {
  readonly name?: string
  readonly defaultLocale?: string
  readonly mfaFreshnessSeconds?: number
  readonly localAccountsEnabled?: boolean
  readonly residencyMode?: ResidencyMode
  readonly recordVersion: RecordVersion
}

/** Whether a settings save is final (`200`) or the realm part is still applying (`202`). */
export interface TenantSettingsSaved {
  readonly settings: TenantSettings
  readonly realmSyncPending: boolean
}
