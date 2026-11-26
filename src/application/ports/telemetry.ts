// The port the use cases and feature hooks record through. The adapter (infrastructure/telemetry)
// turns these into the Tier 3 iam_admin_* metrics; presentation and application never import the SDK's metrics.
import type { ActionOutcome, AdminAction, LoadOutcome, LoadResource, StepUpAction } from '../../domain/events/admin-events'

/** A started measurement: finish it once, with its outcome. A second call is ignored. */
export interface Measurement<O> {
  finish(outcome: O): void
}

export interface AdminTelemetry {
  /** A data load starts; finish with `success` or `error`. Superseded loads are never finished. */
  loadStarted(resource: LoadResource): Measurement<LoadOutcome>
  /** An admin write starts; finish with `success`, `failure` (business rejection) or `error` (fault). */
  actionStarted(action: AdminAction): Measurement<ActionOutcome>
  /** The user started step-up from an admin action. */
  stepUpRequested(action: StepUpAction): void
}
