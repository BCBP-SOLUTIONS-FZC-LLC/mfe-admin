import type { ImpactItem } from '../entities/impact'

/**
 * Workflow impact review (E2a step 1). **Proposed, not implemented this release**: the Workflow
 * service has no such route yet (IAM-FE-Q6, LLD §15 #3). The contract is agreed here so the dialog
 * can add step 1 without reshaping anything. Nothing in `src/` calls it, and the composition root
 * wires no adapter.
 */
export interface WorkflowImpactPort {
  /** `GET /workflows/active-by-user?user_id=` */
  activeByUser(userId: string, signal?: AbortSignal): Promise<readonly ImpactItem[]>
}
