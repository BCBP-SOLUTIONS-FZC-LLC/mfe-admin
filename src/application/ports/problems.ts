// How a failed call is read: the outcome a metric records, whether a refresh or a reload is called
// for, and the catalogue message for it. The implementation knows the SDK's error classes
// (infrastructure/api/problem.ts); the feature hooks and screens only see this port.
import type { ActionOutcome } from '../../domain/events/admin-events'

/** What IAM asks the admin to settle before a removal or demotion can go through. */
export interface ResolutionRequired {
  /** How many workflows the member is covering for others. */
  readonly activeWorkflows: number
  readonly workflowIds: readonly string[]
  readonly allowedActions: readonly ('replace_delegate' | 'stop_workflows')[]
}

export interface ProblemReader {
  /** The metric outcome of a failed write; undefined when the caller aborted (not a failure at all). */
  outcomeOf(error: unknown): Exclude<ActionOutcome, 'success'> | undefined
  /** A failed load is always `error`; undefined when aborted (a superseded load is not counted). */
  loadOutcomeOf(error: unknown): 'error' | undefined
  /** The gateway says the permission hints are stale: refresh the session context. */
  isRoleDenied(error: unknown): boolean
  /** The gateway wants fresh MFA first: step up, then retry once. */
  isMfaStale(error: unknown): boolean
  /** A lost optimistic-lock race (409): offer Reload, never retry. */
  isConflict(error: unknown): boolean
  /** The version the service says is current, from a conflict's `record_version`. */
  currentRecordVersion(error: unknown): number | undefined
  /** The catalogue key for a known problem, or undefined (use the SDK's generic sentence). */
  messageKey(error: unknown): string | undefined
  /** The details of `409 WORKFLOW_RESOLUTION_REQUIRED` (E2a step 2), or undefined for any other answer. */
  resolutionRequired(error: unknown): ResolutionRequired | undefined
  /** The trace ID to quote to support. */
  traceId(error: unknown): string | undefined
}
