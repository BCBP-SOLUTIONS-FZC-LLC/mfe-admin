// A fake IAM at the HTTP level: the six services the admin remote calls, answering in the Swagger's own
// shape (snake_case, problem+json errors) from in-memory state. The e2e tests run the whole App against
// it, so the adapters, the mappers and the screens are exercised together. Each handler is small and
// follows what the service documents; a test injects a failure with `failNext`.

type Json = Record<string, unknown>
export interface FakeMember { user_id: string; status: 'active' | 'suspended'; tenant_roles: string[]; departments: { department_id: string; level: string }[]; record_version: number }
export interface FakeProfile { id: string; display_name: string; email: string; job_title?: string; source: 'local' | 'federated'; status: 'active' | 'disabled' | 'deleted'; record_version: number; availability?: { status: string }; provisional?: boolean; display_name_overridden?: boolean }
export interface Call { method: string; path: string; query: URLSearchParams; body: unknown }

const iso = '2026-11-25T10:00:00Z'

export function createFakeIamCore() {
  const s = {
    tenant: { id: 'tenant-1', name: 'Acme', slug: 'acme', default_locale: 'en', mfa_freshness_seconds: 300, local_accounts_enabled: true, residency_mode: 'standard', record_version: 7, status: 'active', plan: 'pro', licensed_seats: 5, realm_sync_pending: false, updated_at: iso } as Json,
    members: [
      { user_id: 'u-ada', status: 'active', tenant_roles: ['tenant_owner'], departments: [{ department_id: 'd-eng', level: 'approver' }], record_version: 2 },
      { user_id: 'u-bob', status: 'active', tenant_roles: ['tender_admin'], departments: [{ department_id: 'd-qa', level: 'reviewer' }], record_version: 6 },
      { user_id: 'u-cy', status: 'active', tenant_roles: [], departments: [], record_version: 1 },
    ] as FakeMember[],
    profiles: {
      'u-ada': { id: 'u-ada', display_name: 'Ada Lovelace', email: 'ada@example.com', job_title: 'Chief Engineer', source: 'federated', status: 'active', record_version: 3, availability: { status: 'available' } },
      'u-bob': { id: 'u-bob', display_name: 'Bob Builder', email: 'bob@example.com', job_title: 'Estimator', source: 'local', status: 'active', record_version: 9 },
      'u-cy': { id: 'u-cy', display_name: 'Cy Young', email: 'cy@example.com', source: 'local', status: 'active', record_version: 1 },
    } as Record<string, FakeProfile>,
    invitations: [] as Json[],
    departments: [
      { department_id: 'd-eng', code: 'ENG', name: 'Engineering', is_active: true, is_system: true, record_version: 1 },
      { department_id: 'd-qa', code: 'QAQC', name: 'QA / QC', is_active: true, is_system: false, record_version: 2 },
    ] as Json[],
    catalog: [
      { id: 'd-eng', code: 'ENG', name: 'Engineering', is_active: true, is_system: true, record_version: 1 },
      { id: 'd-qa', code: 'QAQC', name: 'QA / QC', is_active: true, is_system: false, record_version: 1 },
      { id: 'd-hse', code: 'HSE', name: 'HSE', is_active: true, is_system: false, record_version: 1 },
    ] as Json[],
    labels: [
      { role_code: 'preparator', display_name: 'Engineer', record_version: 1 },
      { role_code: 'reviewer', display_name: 'Manager', record_version: 1 },
      { role_code: 'approver', display_name: 'Director', record_version: 1 },
    ] as Json[],
    delegation: { max_duration_days: 90, review_window_days: 90, record_version: 1 } as Json,
    mappings: {
      departments: [{ keycloak_group_name: 'eng', department_id: 'd-eng' }],
      levels: [{ keycloak_group_name: 'eng', role_code: 'reviewer' }],
      tenantRoles: [{ keycloak_group_name: 'admins', role_code: 'tenant_admin' }],
    },
    audit: [
      { id: 'ev-1', occurred_at: iso, actor: { id: 'u-ada', type: 'user', display: 'Ada Lovelace' }, action: 'member.suspended', entry_type: 'membership.suspended', target: { type: 'member', id: 'u-bob' }, source_service: 'iam-org-membership', metadata: { reason: 'left' } },
    ] as Json[],
    /** Members who cover work for others: removing or demoting them needs a resolution first. */
    covering: new Set<string>(),
    resolved: new Set<string>(),
    /** The next N reads of the tenant answer `realm_sync_pending: true` (a settings save that is still applying). */
    realmPendingReads: 0,
    /** A search answers 202 with an export job instead of rows. */
    largeSearch: false,
    exports: new Map<string, { polls: number }>(),
  }

  const failures: { match: RegExp; status: number; code: string; extensions?: Json; times: number }[] = []
  const calls: Call[] = []

  /** The next `times` requests whose "METHOD /path" matches fail with this problem. */
  const failNext = (match: RegExp, status: number, code: string, extensions: Json = {}, times = 1) => void failures.push({ match, status, code, extensions, times })

  const problem = (status: number, code: string, extensions: Json = {}) =>
    new Response(JSON.stringify({ type: `https://errors.company.com/platform/${status === 409 ? 'conflict' : status === 422 ? 'business-rule-violation' : status === 503 ? 'service-unavailable' : 'forbidden'}`, title: 'T', status, errorCode: code, traceId: 'trace-e2e', ...extensions }), { status, headers: { 'content-type': 'application/problem+json' } })
  const ok = (body: unknown, status = 200) => Response.json(body, { status })
  const none = () => new Response(null, { status: 204 })

  const seats = () => ({ active_users: s.members.filter((m) => m.status === 'active').length, pending_invitations: s.invitations.length, licensed_seats: s.tenant['licensed_seats'] as number })
  const memberOf = (id: string) => s.members.find((m) => m.user_id === id)
  const covered = (id: string) => s.covering.has(id) && !s.resolved.has(id)
  const resolution = () => problem(409, 'WORKFLOW_RESOLUTION_REQUIRED', { active_workflows: 2, workflow_ids: ['w1', 'w2'], allowed_actions: ['replace_delegate', 'stop_workflows'] })
  const lastOwner = (m: FakeMember) => m.tenant_roles.includes('tenant_owner') && s.members.filter((x) => x.status === 'active' && x.tenant_roles.includes('tenant_owner')).length <= 1

  const route = async (method: string, path: string, query: URLSearchParams, body: Json): Promise<Response> => {
    let m: RegExpMatchArray | null
    const key = `${method} ${path}`
    // Tenant routes: /api/v1/tenants/:id/…
    if ((m = path.match(/^\/api\/v1\/tenants\/[^/]+(\/.*)?$/))) {
      const rest = m[1] ?? ''
      if (rest === '') {
        if (method === 'GET') {
          const pending = s.realmPendingReads > 0
          if (pending) s.realmPendingReads -= 1
          return ok({ ...s.tenant, realm_sync_pending: pending })
        }
        if (method === 'PATCH') {
          if (body['record_version'] !== s.tenant['record_version']) return problem(409, 'OPTIMISTIC_LOCK_CONFLICT', { record_version: s.tenant['record_version'] })
          const changes = Object.fromEntries(Object.entries(body).filter(([k]) => k !== 'record_version'))
          Object.assign(s.tenant, changes, { record_version: (s.tenant['record_version'] as number) + 1 })
          return ok({ ...s.tenant, realm_sync_pending: s.realmPendingReads > 0 }, s.realmPendingReads > 0 ? 202 : 200)
        }
      }
      if (rest === '/seat-usage') return ok(seats())
      if (rest === '/members' && method === 'GET') {
        const limit = Number(query.get('limit') ?? 50)
        const from = Number(query.get('cursor') ?? 0)
        const page = s.members.slice(from, from + limit)
        return ok({ items: page, ...(from + limit < s.members.length ? { next_cursor: String(from + limit) } : {}) })
      }
      if (rest === '/members' && method === 'POST') {
        const used = seats().active_users + seats().pending_invitations
        if (used >= (s.tenant['licensed_seats'] as number)) return problem(409, 'SEAT_LIMIT_REACHED')
        const inv = { invitation_id: `inv-${s.invitations.length + 1}`, email: body['email'], full_name: body['full_name'], initial_tenant_roles: body['initial_tenant_roles'] ?? [], invited_by: 'u-ada', created_at: iso, expires_at: '2026-12-02T10:00:00Z', record_version: 1, status: 'pending' }
        s.invitations.push(inv)
        return ok(inv, 202)
      }
      if (rest === '/invitations') return ok({ items: s.invitations })
      if ((m = rest.match(/^\/invitations\/([^/]+)$/)) && method === 'DELETE') {
        s.invitations = s.invitations.filter((i) => i['invitation_id'] !== m![1])
        return none()
      }
      if ((m = rest.match(/^\/members\/([^/]+)$/))) {
        const member = memberOf(m[1]!)
        if (!member) return problem(404, 'MEMBER_NOT_FOUND')
        if (method === 'GET') return ok(member)
        if (method === 'PATCH') {
          if (body['record_version'] !== member.record_version) return problem(409, 'OPTIMISTIC_LOCK_CONFLICT', { record_version: member.record_version })
          if (body['status'] === 'suspended' && lastOwner(member)) return problem(422, 'LAST_OWNER_REMOVAL')
          member.status = body['status'] as FakeMember['status']
          member.record_version += 1
          return ok({ user_id: member.user_id, status: member.status, record_version: member.record_version, updated_at: iso })
        }
        if (method === 'DELETE') {
          if (lastOwner(member)) return problem(422, 'LAST_OWNER_REMOVAL')
          if (covered(member.user_id)) return resolution()
          s.members = s.members.filter((x) => x.user_id !== member.user_id)
          return none()
        }
      }
      if ((m = rest.match(/^\/members\/([^/]+)\/roles$/)) && method === 'PUT') {
        const member = memberOf(m[1]!)!
        const next = body['roles'] as string[]
        if (member.tenant_roles.includes('tenant_owner') && !next.includes('tenant_owner') && lastOwner(member)) return problem(422, 'LAST_OWNER_REMOVAL')
        member.tenant_roles = next
        member.record_version += 1
        return ok({ user_id: member.user_id, roles: next })
      }
      if ((m = rest.match(/^\/members\/([^/]+)\/reset-mfa$/)) && method === 'POST') return memberOf(m[1]!)?.status === 'active' ? none() : problem(422, 'MEMBER_NOT_ACTIVE')
      if ((m = rest.match(/^\/users\/([^/]+)\/removal-resolution$/)) && method === 'POST') {
        s.resolved.add(m[1]!)
        return none()
      }
      if (rest === '/departments' && method === 'GET') return ok({ items: s.departments })
      if (rest === '/departments' && method === 'POST') {
        const found = s.catalog.find((c) => c['id'] === body['department_id'])
        if (!found) return problem(422, 'DEPARTMENT_NOT_IN_CATALOG')
        s.departments.push({ department_id: found['id'], code: found['code'], name: found['name'], is_active: true, is_system: false, record_version: 1 })
        return ok({ department_id: found['id'], is_active: true, record_version: 1 }, 201)
      }
      if ((m = rest.match(/^\/departments\/([^/]+)$/)) && method === 'PATCH') {
        const d = s.departments.find((x) => x['department_id'] === m![1])!
        if (body['record_version'] !== d['record_version']) return problem(409, 'OPTIMISTIC_LOCK_CONFLICT', { record_version: d['record_version'] })
        if (d['is_system'] && body['is_active'] === false) return problem(422, 'SYSTEM_DEPARTMENT_CANNOT_BE_RETIRED')
        d['is_active'] = body['is_active']
        d['record_version'] = (d['record_version'] as number) + 1
        return ok({ department_id: d['department_id'], is_active: d['is_active'], record_version: d['record_version'] })
      }
      if ((m = rest.match(/^\/departments\/([^/]+)\/members$/)) && method === 'GET') {
        return ok({ items: s.members.flatMap((x) => x.departments.filter((d) => d.department_id === m![1]).map((d) => ({ user_id: x.user_id, level: d.level }))) })
      }
      if ((m = rest.match(/^\/departments\/([^/]+)\/members\/([^/]+)$/))) {
        const member = memberOf(m[2]!)!
        const rank = ['preparator', 'reviewer', 'approver']
        if (method === 'PUT') {
          const existing = member.departments.find((d) => d.department_id === m![1])
          if (existing && rank.indexOf(body['level'] as string) < rank.indexOf(existing.level) && covered(member.user_id)) return resolution()
          if (existing) existing.level = body['level'] as string
          else member.departments.push({ department_id: m[1]!, level: body['level'] as string })
          member.record_version += 1
          return ok({ department_id: m[1], level: body['level'], record_version: member.record_version, user_id: member.user_id })
        }
        if (method === 'DELETE') {
          if (covered(member.user_id)) return resolution()
          member.departments = member.departments.filter((d) => d.department_id !== m![1])
          member.record_version += 1
          return ok({ department_id: m[1], removed: true, user_id: member.user_id })
        }
      }
      if (rest === '/roles' && method === 'GET') return ok({ items: s.labels })
      if ((m = rest.match(/^\/roles\/([^/]+)$/)) && method === 'PATCH') {
        const label = s.labels.find((l) => l['role_code'] === m![1])!
        if (body['record_version'] !== label['record_version']) return problem(409, 'OPTIMISTIC_LOCK_CONFLICT', { record_version: label['record_version'] })
        label['display_name'] = body['display_name']
        label['record_version'] = (label['record_version'] as number) + 1
        return ok(label)
      }
      if ((m = rest.match(/^\/group-mappings\/(departments|department-roles|tenant-roles)$/))) {
        const list = m[1] === 'departments' ? 'departments' : m[1] === 'department-roles' ? 'levels' : 'tenantRoles'
        if (method === 'GET') return ok({ mappings: s.mappings[list] })
        if (method === 'PUT') {
          s.mappings[list] = body['mappings'] as never
          return ok({ mappings: s.mappings[list] })
        }
      }
    }
    if (key === 'POST /api/v1/users:batch') {
      const ids = body['ids'] as string[]
      return ok({ users: ids.map((id) => s.profiles[id]).filter(Boolean), missing: ids.filter((id) => !s.profiles[id]) })
    }
    if ((m = path.match(/^\/api\/v1\/users\/([^/]+)$/))) {
      const p = s.profiles[m[1]!]
      if (!p) return problem(404, 'MEMBER_NOT_FOUND')
      if (method === 'GET') return ok(p)
      if (method === 'PATCH') {
        if (body['expected_version'] !== p.record_version) return problem(409, 'VERSION_CONFLICT', { record_version: p.record_version })
        if (typeof body['display_name'] === 'string') p.display_name = body['display_name']
        if (typeof body['job_title'] === 'string') p.job_title = body['job_title']
        p.record_version += 1
        return ok(p)
      }
    }
    if (key === 'GET /api/v1/departments') return ok({ items: s.catalog })
    if (key === 'GET /api/v1/delegations/settings') return ok(s.delegation)
    if (key === 'PUT /api/v1/delegations/settings') {
      Object.assign(s.delegation, body, { record_version: (s.delegation['record_version'] as number) + 1 })
      return ok(s.delegation)
    }
    if (key === 'GET /api/v1/audit/events') {
      if (s.largeSearch) return ok({ export_id: 'ex-large', status: 'pending', status_url: '/api/v1/audit/exports/ex-large' }, 202)
      return ok({ events: s.audit, window_clamped: false })
    }
    if ((m = path.match(/^\/api\/v1\/audit\/events\/([^/]+)$/)) && method === 'GET') return ok(s.audit.find((e) => e['id'] === m![1]) ?? s.audit[0])
    if (key === 'POST /api/v1/audit/exports') {
      s.exports.set('ex-1', { polls: 0 })
      return ok({ export_id: 'ex-1', status: 'pending', status_url: '/api/v1/audit/exports/ex-1' }, 202)
    }
    if ((m = path.match(/^\/api\/v1\/audit\/exports\/([^/]+)$/)) && method === 'GET') {
      const job = s.exports.get(m[1]!) ?? { polls: 0 }
      s.exports.set(m[1]!, job)
      job.polls += 1
      const status = job.polls >= 3 ? 'ready' : job.polls === 2 ? 'running' : 'pending'
      return ok({ export_id: m[1], status, created_at: iso, ...(status === 'ready' ? { row_count: 12, download_url: `https://files.example.com/${m[1]}.csv`, expires_at: '2026-12-02T10:00:00Z' } : {}) })
    }
    return problem(404, 'ROUTE_NOT_FOUND')
  }

  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const req = new Request(input instanceof Request ? input : new URL(String(input), 'http://localhost/'), init)
    const url = new URL(req.url)
    const path = decodeURIComponent(url.pathname)
    const text = await req.text()
    const body = text ? (JSON.parse(text) as Json) : {}
    calls.push({ method: req.method, path, query: url.searchParams, body: text ? body : undefined })
    const failure = failures.find((f) => f.times > 0 && f.match.test(`${req.method} ${path}`))
    if (failure) {
      failure.times -= 1
      return problem(failure.status, failure.code, failure.extensions)
    }
    return route(req.method, path, url.searchParams, body)
  }

  return {
    state: s,
    calls,
    failNext,
    /** The fake as a `fetch`: answers any URL, 404 for routes it does not know. */
    fetch: fetchImpl,
    /** The requests made so far as "METHOD /path". */
    requests: () => calls.map((c) => `${c.method} ${c.path}`),
  }
}

export type FakeIamCore = ReturnType<typeof createFakeIamCore>
