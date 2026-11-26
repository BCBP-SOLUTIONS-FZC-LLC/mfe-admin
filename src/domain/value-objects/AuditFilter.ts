// The audit log's search filter (E7). It lives in the URL search string (LLD §10), so it parses from
// and writes to plain key/value pairs: no browser API here. Values are the wire values: `from` and
// `to` are UTC instants (ISO 8601), the rest are the service's vocabularies.

export const ACTOR_TYPES = ['user', 'service_account', 'iam_system', 'anonymous'] as const
export type ActorType = (typeof ACTOR_TYPES)[number]

export const RETENTION_TIERS = ['compliance_7y', 'security_3y', 'access_90d'] as const
export type RetentionTier = (typeof RETENTION_TIERS)[number]

export interface AuditFilter {
  readonly from?: string
  readonly to?: string
  /** Several entry types may be asked for at once (the taxonomy's `auth.login`, `membership.added`, …). */
  readonly entryTypes: readonly string[]
  readonly actorId?: string
  readonly actorType?: ActorType
  readonly targetType?: string
  readonly targetId?: string
  readonly sourceService?: string
  readonly retentionTier?: RetentionTier
}

export const EMPTY_AUDIT_FILTER: AuditFilter = { entryTypes: [] }

const SINGLE = {
  from: 'from',
  to: 'to',
  actorId: 'actor_id',
  targetType: 'target_type',
  targetId: 'target_id',
  sourceService: 'source_service',
} as const

const oneOf = <T extends string>(values: readonly T[], v: string | undefined): T | undefined => values.find((x) => x === v)
const text = (v: string | undefined) => (v === undefined || v.trim() === '' ? undefined : v.trim())

/** A filter from URL search pairs. Unknown keys and values outside a vocabulary are ignored: a stale link still opens. */
export function auditFilterFromEntries(entries: Iterable<readonly [string, string]>): AuditFilter {
  const single = new Map<string, string>()
  const entryTypes: string[] = []
  for (const [key, value] of entries) {
    if (key === 'entry_type') {
      const v = text(value)
      if (v && !entryTypes.includes(v)) entryTypes.push(v)
    } else if (!single.has(key)) single.set(key, value)
  }
  const get = (key: string) => text(single.get(key))
  const filter: { -readonly [K in keyof AuditFilter]: AuditFilter[K] } = { entryTypes }
  for (const [field, key] of Object.entries(SINGLE)) {
    const v = get(key)
    if (v !== undefined) (filter as Record<string, unknown>)[field] = v
  }
  const actorType = oneOf(ACTOR_TYPES, get('actor_type'))
  if (actorType) filter.actorType = actorType
  const tier = oneOf(RETENTION_TIERS, get('retention_tier'))
  if (tier) filter.retentionTier = tier
  return filter
}

/** The filter as URL search pairs, in a fixed order; an empty filter gives no pairs. */
export function auditFilterToEntries(filter: AuditFilter): [string, string][] {
  const pairs: [string, string][] = []
  for (const [field, key] of Object.entries(SINGLE)) {
    const v = filter[field as keyof typeof SINGLE]
    if (v) pairs.push([key, v])
  }
  for (const type of filter.entryTypes) pairs.push(['entry_type', type])
  if (filter.actorType) pairs.push(['actor_type', filter.actorType])
  if (filter.retentionTier) pairs.push(['retention_tier', filter.retentionTier])
  return pairs
}
