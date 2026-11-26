// Closed value sets for the admin remote's telemetry (docs/observability/metrics.md). They are the
// metric label vocabularies, so every `action`, `resource` and `outcome` the code records is one of
// these; a new value is added here and on that page in the same change.

/** What an admin write does (label `action`). */
export const ADMIN_ACTIONS = [
  'invite',
  'revoke_invitation',
  'change_roles',
  'suspend',
  'reactivate',
  'remove',
  'resolve_removal',
  'assign_department',
  'remove_from_department',
  'reset_mfa',
  'update_profile',
  'activate_department',
  'retire_department',
  'rename_role_labels',
  'save_group_mappings',
  'save_settings',
  'save_delegation_policy',
  'request_audit_export',
] as const
export type AdminAction = (typeof ADMIN_ACTIONS)[number]

/** What an action ended in: `failure` is a business rejection, `error` a fault (the registry's vocabulary). */
export const ACTION_OUTCOMES = ['success', 'failure', 'error'] as const
export type ActionOutcome = (typeof ACTION_OUTCOMES)[number]

/** What a data load reads (label `resource`). */
export const LOAD_RESOURCES = [
  'members',
  'user_profiles',
  'invitations',
  'seat_usage',
  'departments',
  'catalog',
  'role_labels',
  'group_mappings',
  'settings',
  'audit',
  'audit_exports',
] as const
export type LoadResource = (typeof LOAD_RESOURCES)[number]

/** A load has no business rejection. */
export const LOAD_OUTCOMES = ['success', 'error'] as const
export type LoadOutcome = (typeof LOAD_OUTCOMES)[number]

/** Actions that start a step-up (MFA re-authentication) first. */
export const STEP_UP_ACTIONS = ['reset_mfa'] as const
export type StepUpAction = (typeof STEP_UP_ACTIONS)[number]
