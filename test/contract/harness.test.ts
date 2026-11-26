// The harness has to catch a wrong request, or a green contract test means nothing: each case below
// is a request or answer that is wrong against the pinned Swagger, and must be reported.
import { describe, expect, it } from '@rstest/core'
import { conformance, findOperation, type Captured } from './harness'
import * as f from './fixtures'
import { TENANT } from './harness'

const call = (o: Partial<Captured> & Pick<Captured, 'method' | 'pathname'>): Captured => ({ rawPath: o.pathname, query: [], body: undefined, ...o })
const T = `/api/v1/tenants/${TENANT}`

describe('the contract harness catches', () => {
  it('a path the Swagger does not have', () => {
    expect(() => findOperation('GET', `${T}/not-a-route`)).toThrow('no Swagger operation')
  })

  it('a method the path does not have', () => {
    expect(() => findOperation('DELETE', `${T}/seat-usage`)).toThrow('no Swagger operation')
  })

  it('a body field the Swagger does not declare', () => {
    const v = conformance(call({ method: 'PATCH', pathname: `${T}/members/${f.U1}`, body: { status: 'suspended', record_version: 3, tenant_id: TENANT } }), { status: 200, body: f.statusPatched })
    expect(v.problems.join(' ')).toContain('.tenant_id is not in the Swagger')
  })

  it('a body value of the wrong type', () => {
    const v = conformance(call({ method: 'PATCH', pathname: `${T}/members/${f.U1}`, body: { status: 'suspended', record_version: '3' } }), { status: 200, body: f.statusPatched })
    expect(v.problems.length).toBeGreaterThan(0)
  })

  it('a missing required body', () => {
    const v = conformance(call({ method: 'PATCH', pathname: `${T}/members/${f.U1}` }), { status: 200, body: f.statusPatched })
    expect(v.problems.join(' ')).toContain('needs a body')
  })

  it('a body sent where the operation takes none', () => {
    const v = conformance(call({ method: 'GET', pathname: `${T}/seat-usage`, body: { x: 1 } }), { status: 200, body: f.seatUsage })
    expect(v.problems.join(' ')).toContain('takes no body')
  })

  it('a query parameter the operation does not declare', () => {
    const v = conformance(call({ method: 'GET', pathname: `${T}/members`, query: [['search', 'ada']] }), { status: 200, body: f.memberPage })
    expect(v.problems.join(' ')).toContain('query search is not declared')
  })

  it('a status the operation does not answer', () => {
    const v = conformance(call({ method: 'GET', pathname: `${T}/seat-usage` }), { status: 201, body: f.seatUsage })
    expect(v.problems.join(' ')).toContain('declares no 201 answer')
  })

  it('an answer with a value outside an enum, a missing type, or a field the Swagger lacks', () => {
    const enumBad = conformance(call({ method: 'GET', pathname: `${T}/departments/${f.D1}/members` }), { status: 200, body: { items: [{ user_id: f.U1, level: 'boss' }] } })
    expect(enumBad.problems.length).toBeGreaterThan(0)
    const typeBad = conformance(call({ method: 'GET', pathname: `${T}/seat-usage` }), { status: 200, body: { ...f.seatUsage, active_users: '3' } })
    expect(typeBad.problems.length).toBeGreaterThan(0)
    const extra = conformance(call({ method: 'GET', pathname: `${T}/seat-usage` }), { status: 200, body: { ...f.seatUsage, grace_ends_at: '2026-12-01' } })
    expect(extra.problems.join(' ')).toContain('grace_ends_at is not in the Swagger')
  })

  it('accepts a correct request and answer', () => {
    const v = conformance(call({ method: 'GET', pathname: `${T}/seat-usage` }), { status: 200, body: f.seatUsage })
    expect(v).toEqual({ service: 'org-membership', swaggerPath: '/tenants/{id}/seat-usage', problems: [] })
  })

  it('tells the three base paths apart: group mapping and delegation paths already carry /api/v1', () => {
    expect(findOperation('GET', `${T}/group-mappings/departments`).service).toBe('group-mapping')
    expect(findOperation('GET', '/api/v1/delegations/settings').service).toBe('delegation')
    expect(findOperation('GET', `${T}/seat-usage`).service).toBe('org-membership')
  })
})
