// Tenant roles in one style, department levels in another (spec 7.9): the role is data from IAM,
// its words come from the catalogue.
import { useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import type { TenantRole } from '../../../domain/vocabulary'
import { APP_ID } from '../../../shared/constants/app'

const ROLE_KEYS = {
  tenant_owner: 'roles.tenant_owner',
  tenant_admin: 'roles.tenant_admin',
  tender_admin: 'roles.tender_admin',
} as const satisfies Record<TenantRole, string>

/** Owner, admin and tender admin each get their own tint, so a row reads at a glance. */
const ROLE_TINT = {
  tenant_owner: 'bg-aura-primary-soft text-[color:var(--aura-primary-on-soft)]',
  tenant_admin: 'bg-aura-secondary-soft text-[color:var(--aura-secondary-on-soft)]',
  tender_admin: 'bg-aura-tertiary-soft text-aura-text',
} as const satisfies Record<TenantRole, string>

export const roleKey = (role: TenantRole) => ROLE_KEYS[role]

export default function RoleBadge({ role }: { role: TenantRole }) {
  const t = useT(APP_ID)
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_TINT[role]}`}>{t(ROLE_KEYS[role])}</span>
}
