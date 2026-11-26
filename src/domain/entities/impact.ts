import type { DepartmentLevel } from '../vocabulary'

/**
 * Work a user holds that a removal or demotion would strand (E2a step 1, from Workflow). **Not used
 * this release**: the Workflow route does not exist (IAM-FE-Q6, LLD §15 #3). Kept so the shape is
 * agreed when it does.
 */
export interface ImpactItem {
  readonly tenderId: string
  readonly stage: string
  readonly departmentId: string
  readonly level: DepartmentLevel
  readonly deadline?: string
  readonly lastAction?: string
}
