// IAM's closed wire vocabulary (spec §2.1): the codes the services send and accept. They are data
// for request bodies and badges, never used to decide access: permission checks go through the
// SDK (useHasPermission, <Can>), and test/unit/sdk/dependency-rules.test.ts rejects these literals
// anywhere else in src/.

/** Tenant roles. `member` is implicit: P-35 returns it, it is never stored or sent (spec §2.1). */
export const TENANT_ROLES = ['tenant_owner', 'tenant_admin', 'tender_admin'] as const
export type TenantRole = (typeof TENANT_ROLES)[number]

/** The roles only an owner may grant or remove (HLD §6.4; IAM-FE-Q14: the UI follows the HLD). The rest of src/ names them through these constants, never as literals. */
export const OWNER: TenantRole = 'tenant_owner'
export const ADMIN: TenantRole = 'tenant_admin'
/** The role an admin (not only an owner) may grant. */
export const TENDER_ADMIN: TenantRole = 'tender_admin'

/**
 * The languages the shell offers today (its runtime config's `supportedLocales`): only English. A
 * workspace whose saved default is something else keeps it in the list, so it is never silently changed.
 */
export const ENABLED_LOCALES = ['en'] as const

/**
 * The families audit entry types belong to (the part before the first dot: `config.tenant_setting.changed`
 * is `config`), from spec E7. The full list of entry types is the Audit Log's taxonomy file, which is not
 * available here, so the screen groups by family and takes an exact entry type as text.
 */
export const AUDIT_FAMILIES = ['auth', 'membership', 'invitation', 'tenant', 'config', 'delegation', 'tender', 'workflow', 'user', 'serviceaccount', 'usage', 'billing', 'legal', 'security'] as const
export type AuditFamily = (typeof AUDIT_FAMILIES)[number]

/** The family of an entry type, or undefined for one this list does not know. */
export function auditFamilyOf(entryType: string): AuditFamily | undefined {
  const family = entryType.split('.')[0]
  return AUDIT_FAMILIES.find((f) => f === family)
}

/** Department levels. The tenant's own labels come from P-12; the code never changes. */
export const DEPARTMENT_LEVELS = ['preparator', 'reviewer', 'approver'] as const
export type DepartmentLevel = (typeof DEPARTMENT_LEVELS)[number]
