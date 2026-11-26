// Where the admin screens send the user next, outside this remote: the plan upgrade when no seat is free
// (E1). Cross-remote moves go through the SDK's navigate() with the full path, workspace prefix
// included (docs/lld/shared-components-and-navigation-handoff.md §3.2): the shell's router does the move
// (no page load) and a standalone page falls back to a full load. The prefix is built from the session
// context's slug, never hardcoded and not from useWorkspace(), which may have no slug after a trial
// sign-in from an invitation; nothing is offered until the context has loaded.
import { tryGetConfig } from '@bcbp-solutions-fzc-llc/frontend-sdk/config'
import { navigate } from '@bcbp-solutions-fzc-llc/frontend-sdk/nav'
import { useSessionContext } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import type { AdminNavigation } from '../../application/ports/navigation'

/** The workspace's route prefix (for example `/t/acme`) from the session context's slug, or '' until it has loaded (standalone). */
export function useWorkspacePrefix(): string {
  const slug = useSessionContext()?.slug
  const prefix = tryGetConfig()?.auth.workspacePathPrefix
  return slug && prefix ? `${prefix}${slug}` : ''
}

/**
 * Where "Upgrade plan" leads: the billing area of this workspace. Billing is not an admin screen and no
 * billing remote is registered yet (LLD §15), so this path is the one to change when it is; nothing else
 * in this remote knows it.
 */
export const BILLING_REMOTE = 'billing'
export const UPGRADE_PATH = '/billing'

export function createNavigation(workspacePrefix: string): AdminNavigation {
  return { upgrade: () => navigate(BILLING_REMOTE, `${workspacePrefix}${UPGRADE_PATH}`) }
}
