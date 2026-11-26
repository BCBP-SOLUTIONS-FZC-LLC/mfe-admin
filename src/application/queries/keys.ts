// Query keys for the admin remote's server state (ADR 0001). Every key starts with the workspace
// slug, so a workspace switch can never show another workspace's data, and writes invalidate by
// prefix. They live in application/ (not infrastructure/, as ADR 0001 first said) because the
// feature hooks that use them are presentation and may not import infrastructure; they are plain
// arrays, so nothing here knows TanStack Query.
import type { LoadResource } from '../../domain/events/admin-events'

export interface ListParams {
  readonly limit?: number
  readonly cursor?: string
  readonly [filter: string]: string | number | boolean | undefined
}

/** The key factory for one workspace. */
export function adminKeys(slug: string) {
  const root = ['admin', slug] as const
  const of = <R extends LoadResource>(resource: R, ...rest: readonly unknown[]) => [...root, resource, ...rest] as const
  return {
    /** Everything for this workspace (clear on workspace switch or sign-out). */
    all: root,
    members: (params: ListParams = {}) => of('members', 'list', params),
    member: (userId: string) => of('members', 'one', userId),
    /** The full profile with its version (E2); the per-ID `user` key holds the batch lookup's summary. */
    userDetail: (userId: string) => ['admin', slug, 'user-detail', userId] as const,
    /** Active owners across every page, for the last-owner checks. */
    owners: () => of('members', 'owners'),
    invitations: () => of('invitations'),
    seatUsage: () => of('seat_usage'),
    departments: () => of('departments'),
    /** Its own prefix, not under `departments`: retiring or activating a department must not refetch every row's member count. */
    departmentMembers: (departmentId: string) => [...root, 'department-members', departmentId] as const,
    catalog: () => of('catalog'),
    roleLabels: () => of('role_labels'),
    groupMappings: (kind: string) => of('group_mappings', kind),
    settings: () => of('settings'),
    /** Its own prefix, not under `settings`: saving the workspace block must not refetch the delegation policy. */
    delegationPolicy: () => [...root, 'delegation-policy'] as const,
    audit: (filter: ListParams = {}) => of('audit', 'list', filter),
    auditEntry: (id: string) => of('audit', 'one', id),
    auditExport: (id: string) => of('audit_exports', id),
    /** One user profile, stored per ID so the pending tab, E2 and pickers share it (staleTime ~60 s). */
    user: (userId: string) => ['admin', slug, 'users', userId] as const,
  }
}

export type AdminKeys = ReturnType<typeof adminKeys>
