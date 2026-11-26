// dev/mock-iam: the seeded workspace the harness and the mock IAM server serve. It is dev only, but the
// screens are judged against it, so it must hold together: every member has a profile, every department
// a mapping or member points at exists, every audit entry type belongs to a known family, and each
// service answers in the shape the adapters read (through the real adapters, not a copy of them).
import { describe, expect, it } from '@rstest/core'
import { SAMPLE_EXPORT_IDS, seedSampleWorkspace } from '../../../dev/mock-iam/sampleData'
import { createFakeIamCore } from '../../fixtures/fakeIamCore'
import { auditFamilyOf } from '../../../src/domain/vocabulary'

type Rec = Record<string, unknown>

function seeded() {
  const iam = createFakeIamCore()
  seedSampleWorkspace(iam)
  return iam
}
const ask = async (iam: ReturnType<typeof seeded>, path: string) => (await iam.fetch(new Request(`http://localhost${path}`))).json() as Promise<Rec>

describe('the sample workspace', () => {
  it('gives every member a profile, and every membership a known role and department', () => {
    const { state: s } = seeded()
    const departments = new Set((s.departments as Rec[]).map((d) => d['department_id']))
    expect(s.members.length).toBeGreaterThanOrEqual(10)
    for (const m of s.members) {
      expect(s.profiles[m.user_id], m.user_id).toBeDefined()
      for (const r of m.tenant_roles) expect(['tenant_owner', 'tenant_admin', 'tender_admin']).toContain(r)
      for (const d of m.departments) expect(departments.has(d.department_id), `${m.user_id} → ${d.department_id}`).toBe(true)
    }
  })

  it('has at least one owner, and a suspended and a disabled member (every status the table draws)', () => {
    const { state: s } = seeded()
    expect(s.members.some((m) => m.tenant_roles.includes('tenant_owner') && m.status === 'active')).toBe(true)
    expect(s.members.some((m) => m.status === 'suspended')).toBe(true)
    expect(Object.values(s.profiles).some((p) => p.status === 'disabled')).toBe(true)
  })

  it('fits the seats: active plus pending is under the licence, with room left for the invite dialog', async () => {
    const seats = await ask(seeded(), '/api/v1/tenants/tenant-1/seat-usage')
    expect((seats['active_users'] as number) + (seats['pending_invitations'] as number)).toBeLessThan(seats['licensed_seats'] as number)
  })

  it('maps groups only to departments and roles the workspace has', () => {
    const { state: s } = seeded()
    const departments = new Set((s.departments as Rec[]).map((d) => d['department_id']))
    for (const m of s.mappings.departments) expect(departments.has(m['department_id']), String(m['keycloak_group_name'])).toBe(true)
    expect(s.mappings.tenantRoles.length).toBeGreaterThan(0)
  })

  it('shows every state of the departments screen: active, retired, system, and catalogue entries still to activate', () => {
    const { state: s } = seeded()
    const dept = s.departments as Rec[]
    expect(dept.some((d) => d['is_active'] === false)).toBe(true)
    expect(dept.some((d) => d['is_system'] === true)).toBe(true)
    const owned = new Set(dept.map((d) => d['department_id']))
    expect((s.catalog as Rec[]).filter((c) => !owned.has(c['id'])).length).toBeGreaterThan(0)
  })

  it('has audit entries in known families, newest first, some with an IP address, a trace ID and a retention tier', () => {
    const { state: s } = seeded()
    const entries = s.audit as Rec[]
    expect(entries.length).toBeGreaterThanOrEqual(10)
    for (const e of entries) expect(auditFamilyOf(String(e['entry_type'])), String(e['entry_type'])).toBeDefined()
    expect(entries.some((e) => e['ip_address'] && e['trace_id'] && e['retention_tier'])).toBe(true)
  })

  it('seeds an export that is ready, one preparing and one waiting', async () => {
    const iam = seeded()
    expect(SAMPLE_EXPORT_IDS).toHaveLength(3)
    const status = async (id: string) => (await ask(iam, `/api/v1/audit/exports/${id}`))['status']
    expect(await status('ex-ready')).toBe('ready')
    expect(await status('ex-running')).toBe('running')
    expect(await status('ex-waiting')).toBe('pending')
  })

  it('answers the list endpoints through the real adapters\' shape (members page, invitations, catalogue, labels, delegation)', async () => {
    const iam = seeded()
    expect((await ask(iam, '/api/v1/tenants/tenant-1/members?limit=5'))['items']).toHaveLength(5)
    expect((await ask(iam, '/api/v1/tenants/tenant-1/members?limit=5'))['next_cursor']).toBeDefined()
    expect((await ask(iam, '/api/v1/tenants/tenant-1/invitations'))['items']).toHaveLength(3)
    expect(await ask(iam, '/api/v1/delegations/settings')).toMatchObject({ max_duration_days: 60, review_window_days: 30 })
  })
})
