// What a failed IAM call means for this remote (LLD §11, spec §9): which metric outcome it is, whether
// a query may be retried, and which catalogue message names it. The SDK parses the response
// (ProblemError, NetworkError, TimeoutError) and knows the gateway's deny codes; this only adds the
// admin screens' reading of them. A server's `detail` text is never the main message.
import { AbortedError, NetworkError, TimeoutError, gatewayDenyCode, isProblemError } from '@bcbp-solutions-fzc-llc/frontend-sdk/problem'
import type { ProblemReader, ResolutionRequired } from '../../application/ports/problems'
import type { ActionOutcome } from '../../domain/events/admin-events'

/**
 * The metric outcome of a failed write (registry vocabulary): `failure` is a rejection for a reason
 * (every 4xx: a rule, a conflict, a limit, a missing permission), `error` is a fault (5xx, no
 * response, a client timeout). Undefined when the caller aborted: that is not a failure at all.
 */
export function outcomeOf(error: unknown): Exclude<ActionOutcome, 'success'> | undefined {
  if (error instanceof AbortedError || (error instanceof DOMException && error.name === 'AbortError')) return undefined
  if (isProblemError(error)) return error.status >= 400 && error.status < 500 ? 'failure' : 'error'
  return 'error'
}

/** A load only succeeds or errors: the outcome of a failed load. Undefined when aborted. */
export function loadOutcomeOf(error: unknown): 'error' | undefined {
  return outcomeOf(error) === undefined ? undefined : 'error'
}

/**
 * Whether a failed query may run again (ADR 0001): no response, a client timeout, `429` and `5xx`,
 * twice at most; never `4xx` (a `409` or `422` is the answer, not a glitch) and never an abort.
 * Mutations are not retried at all.
 */
export function isRetryableQueryError(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false
  if (error instanceof NetworkError || error instanceof TimeoutError) return true
  return isProblemError(error) && (error.status === 429 || error.status >= 500)
}

const NOTHING_CHANGED = 'errors.unavailable'

/** errorCode (UPPER_SNAKE; compared case-insensitively) → catalogue key. */
const MESSAGE_KEYS: Readonly<Record<string, string>> = {
  SEAT_LIMIT_REACHED: 'errors.seatLimit',
  INVITATION_ALREADY_EXISTS: 'errors.alreadyInvited',
  REINVITE_TOO_SOON: 'errors.reinviteTooSoon',
  INVITE_RATE_LIMITED: 'errors.inviteRateLimited',
  LAST_OWNER_REMOVAL: 'errors.lastOwner',
  WORKFLOW_RESOLUTION_REQUIRED: 'errors.resolutionRequired',
  INVALID_ACTION: 'errors.invalidAction',
  INVALID_REPLACEMENT: 'errors.invalidReplacement',
  MEMBER_NOT_ACTIVE: 'errors.memberNotActive',
  DEPARTMENT_NOT_ACTIVE_FOR_TENANT: 'errors.departmentNotActive',
  SYSTEM_DEPARTMENT_CANNOT_BE_RETIRED: 'errors.systemDepartment',
  OPTIMISTIC_LOCK_CONFLICT: 'errors.conflict',
  VERSION_CONFLICT: 'errors.conflict',
  MAPPING_CONFLICT: 'errors.mappingConflict',
  DEPARTMENT_NOT_IN_CATALOG: 'errors.departmentNotInCatalog',
  ROLE_ASSIGNMENT_FORBIDDEN: 'errors.ownerOnlyMapping',
  RATE_LIMITED: 'errors.rateLimited',
  MEMBER_NOT_FOUND: 'errors.memberNotFound',
  INVALID_REPLACEMENT_USER: 'errors.invalidReplacement',
  WORKFLOW_SERVICE_UNAVAILABLE: NOTHING_CHANGED,
  REALM_PROVISIONER_UNAVAILABLE: NOTHING_CHANGED,
  ORG_MEMBERSHIP_UNAVAILABLE: NOTHING_CHANGED,
  USER_PROFILE_UNAVAILABLE: NOTHING_CHANGED,
  CATALOG_ADMIN_UNAVAILABLE: NOTHING_CHANGED,
  CATALOG_SERVICE_UNAVAILABLE: NOTHING_CHANGED,
  CATALOG_UNAVAILABLE: NOTHING_CHANGED,
  DB_UNAVAILABLE: NOTHING_CHANGED,
  DENY_ROLE_INSUFFICIENT: 'errors.noPermission',
  DENY_TENANT_READ_ONLY: 'errors.readOnly',
  DENY_MFA_STALE: 'errors.mfaStale',
  DENY_SERVICE_UNAVAILABLE: 'errors.accessCheckUnavailable',
  DENY_MEMBER_SUSPENDED: 'errors.memberSuspended',
  DENY_UNRESOLVABLE_SUBJECT: 'errors.notAMember',
}

/**
 * The catalogue key for a known problem, or undefined: the caller then uses the SDK's
 * `problemMessage(error)` (a generic, translated sentence for the status). Gateway deny codes are
 * recognised through the SDK's own list.
 */
export function problemMessageKey(error: unknown): string | undefined {
  if (!isProblemError(error)) return undefined
  const code = (gatewayDenyCode(error) ?? error.errorCode)?.toUpperCase()
  return code ? MESSAGE_KEYS[code] : undefined
}

/** Whether a failed call is the gateway telling us our permission hints are stale (refresh P-35, LLD §15 #15). */
export function isRoleDenied(error: unknown): boolean {
  return isProblemError(error) && gatewayDenyCode(error) === 'DENY_ROLE_INSUFFICIENT'
}

/** Whether a failed call needs the user to confirm MFA again before it can run. */
export function isMfaStale(error: unknown): boolean {
  return isProblemError(error) && gatewayDenyCode(error) === 'DENY_MFA_STALE'
}

/** Whether a failed write lost an optimistic-lock race (`409 OPTIMISTIC_LOCK_CONFLICT` or `VERSION_CONFLICT`, IAM-UX-9): offer Reload, never retry. */
export function isConflict(error: unknown): boolean {
  const code = isProblemError(error) ? error.errorCode?.toUpperCase() : undefined
  return code === 'OPTIMISTIC_LOCK_CONFLICT' || code === 'VERSION_CONFLICT'
}

/** The conflict's current version, from the problem body's `record_version` extension (IAM-UX-9). */
export function currentRecordVersion(error: unknown): number | undefined {
  if (!isProblemError(error)) return undefined
  const v = error.extensions['record_version']
  return typeof v === 'number' ? v : undefined
}

/** The details of a `409 WORKFLOW_RESOLUTION_REQUIRED` (extension members `active_workflows`, `workflow_ids`, `allowed_actions`). */
export function resolutionRequired(error: unknown): ResolutionRequired | undefined {
  if (!isProblemError(error) || error.errorCode?.toUpperCase() !== 'WORKFLOW_RESOLUTION_REQUIRED') return undefined
  const ext = error.extensions
  const workflows = ext['workflow_ids']
  const actions = ext['allowed_actions']
  const count = ext['active_workflows']
  const known = (a: unknown): a is 'replace_delegate' | 'stop_workflows' => a === 'replace_delegate' || a === 'stop_workflows'
  return {
    activeWorkflows: typeof count === 'number' ? count : Array.isArray(workflows) ? workflows.length : 0,
    workflowIds: Array.isArray(workflows) ? workflows.filter((w): w is string => typeof w === 'string') : [],
    // The service lists what it allows; if it says nothing, offer both (it re-checks the choice).
    allowedActions: Array.isArray(actions) && actions.some(known) ? actions.filter(known) : ['replace_delegate', 'stop_workflows'],
  }
}

/** The ProblemReader port over this module's functions: what the feature hooks and screens see. */
export const problemReader: ProblemReader = {
  outcomeOf,
  loadOutcomeOf,
  isRoleDenied,
  isMfaStale,
  isConflict,
  currentRecordVersion,
  messageKey: problemMessageKey,
  resolutionRequired,
  traceId: (error) => (isProblemError(error) ? error.traceId : undefined),
}
