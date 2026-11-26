import { createTestPlatform } from '@bcbp-solutions-fzc-llc/frontend-sdk/testing'
import { registerMessages } from '../../src/infrastructure/configuration/messages'

// Permission sets as the admin screens check them. Which roles get which permission is web-shell's
// role map (src/domain/rules/permissions.ts, after IAM LLD §10.4); these tests do not copy it, so
// they cannot drift from it. They cover the combinations the admin screens distinguish.
type Grant = `${string}:${string}`

/** Everything an owner may do in the admin area. */
export const OWNER: readonly Grant[] = [
  'read:members',
  'manage:members',
  'manage:admin-roles',
  'manage:tenant-settings',
  'manage:delegation-policy',
  'manage:sso',
  'read:audit',
]
/** An admin: members, delegation policy, SSO and audit, but not owner-only blocks. */
export const ADMIN: readonly Grant[] = ['read:members', 'manage:members', 'manage:delegation-policy', 'manage:sso', 'read:audit']
/** A plain member: may read the member list only. */
export const MEMBER: readonly Grant[] = ['read:members']

/** A fresh SDK runtime (as createTestPlatform) with this remote's messages registered again. */
export function startPlatform(o: Parameters<typeof createTestPlatform>[0] = {}) {
  const platform = createTestPlatform({ permissions: OWNER, ...o })
  registerMessages()
  return platform
}
