// What the signed-in user may see and do in the admin area. All of it is a hint: IAM and the gateway
// decide, and a stale hint is corrected by the 403 handling and a session-context refresh (LLD §8,
// §15 #15). Role names are never read here, only the eight permissions web-shell's role map grants.
import { useHasPermission, useReadOnly } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'

export type AdminSection = 'users' | 'departments' | 'groupMappings' | 'settings' | 'audit'

export interface AdminAccess {
  /** A read-only workspace (subscription ended): every mutation is disabled. */
  readonly readOnly: boolean
  readonly canReadMembers: boolean
  /** manage:members, whether or not the workspace is read-only: show the member actions (disabled when read-only). */
  readonly hasManageMembers: boolean
  /** manage:members and not read-only: invite, suspend, remove, assign departments, reset MFA, E3. */
  readonly canManageMembers: boolean
  /** manage:admin-roles and not read-only: grant or remove tenant_owner / tenant_admin, owner mapping rows. */
  readonly canManageAdminRoles: boolean
  /** manage:tenant-settings, whether or not the workspace is read-only (show the block's Save, disabled when read-only). */
  readonly hasManageTenantSettings: boolean
  /** manage:delegation-policy, whether or not the workspace is read-only. */
  readonly hasManageDelegationPolicy: boolean
  /** manage:tenant-settings and not read-only: the E6 workspace block (owner). */
  readonly canManageTenantSettings: boolean
  /** manage:delegation-policy and not read-only: the E6 delegation block. */
  readonly canManageDelegationPolicy: boolean
  readonly canManageSso: boolean
  readonly canReadAudit: boolean
  /** Which sections the user may open. A section they cannot open shows "not permitted", never a redirect. */
  readonly sections: Readonly<Record<AdminSection, boolean>>
}

export function useAdminAccess(): AdminAccess {
  const readOnly = useReadOnly()
  const readMembers = useHasPermission('read', 'members')
  const manageMembers = useHasPermission('manage', 'members')
  const manageAdminRoles = useHasPermission('manage', 'admin-roles')
  const manageTenantSettings = useHasPermission('manage', 'tenant-settings')
  const manageDelegationPolicy = useHasPermission('manage', 'delegation-policy')
  const manageSso = useHasPermission('manage', 'sso')
  const readAudit = useHasPermission('read', 'audit')

  const canReadMembers = readMembers || manageMembers
  return {
    readOnly,
    canReadMembers,
    hasManageMembers: manageMembers,
    canManageMembers: manageMembers && !readOnly,
    canManageAdminRoles: manageAdminRoles && !readOnly,
    hasManageTenantSettings: manageTenantSettings,
    hasManageDelegationPolicy: manageDelegationPolicy,
    canManageTenantSettings: manageTenantSettings && !readOnly,
    canManageDelegationPolicy: manageDelegationPolicy && !readOnly,
    canManageSso: manageSso,
    canReadAudit: readAudit,
    sections: {
      users: canReadMembers,
      departments: canReadMembers,
      groupMappings: manageSso,
      settings: manageTenantSettings || manageDelegationPolicy,
      audit: readAudit,
    },
  }
}
