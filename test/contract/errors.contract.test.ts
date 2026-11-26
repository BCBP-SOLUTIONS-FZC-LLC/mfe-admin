// What a failed IAM call looks like through the real SDK client, and what this remote makes of it:
// the problem body is RFC 9457 with an UPPER_SNAKE errorCode (compared case-insensitively), extension
// members survive, and the outcome, the retry rule and the message follow from it (spec §9, LLD §11).
import { isProblemError, NetworkError } from '@bcbp-solutions-fzc-llc/frontend-sdk/problem'
import { createTestPlatform } from '@bcbp-solutions-fzc-llc/frontend-sdk/testing'
import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core'
import { createOrgMembershipAdapter } from '../../src/infrastructure/api/orgMembership'
import { currentRecordVersion, isMfaStale, isRoleDenied, outcomeOf, problemMessageKey } from '../../src/infrastructure/api/problem'
import { recordVersion } from '../../src/domain/value-objects/RecordVersion'
import { client, problemProblems, stubServer, TENANT } from './harness'
import { U1, U2 } from './fixtures'

const org = () => createOrgMembershipAdapter({ client: client(), tenantId: () => TENANT })

const problemBody = (status: number, errorCode: string, extra: Record<string, unknown> = {}) => ({
  type: `https://errors.company.com/platform/${status === 409 ? 'conflict' : status === 403 ? 'forbidden' : 'service-unavailable'}`,
  title: status === 409 ? 'Conflict' : status === 403 ? 'Forbidden' : 'Service Unavailable',
  status,
  detail: 'a sentence the service wrote',
  instance: `/api/v1/tenants/${TENANT}/members`,
  traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
  errorCode,
  timestamp: '2026-11-25T10:45:22Z',
  ...extra,
})

beforeEach(() => {
  createTestPlatform()
})
afterEach(() => {
  rs.unstubAllGlobals()
})

async function failure(call: () => Promise<unknown>): Promise<unknown> {
  try {
    await call()
  } catch (e) {
    return e
  }
  throw new Error('the call should have failed')
}

describe('a rejected write', () => {
  it('409 SEAT_LIMIT_REACHED on invite: the upgrade message, a business failure, not retried', async () => {
    const server = stubServer()
    const body = problemBody(409, 'SEAT_LIMIT_REACHED')
    expect(problemProblems('org-membership', body)).toEqual([])
    server.reply(409, body)
    const e = await failure(() => org().invite({ email: 'a@b.co', fullName: 'A', initialTenantRoles: [], initialDeptMappings: [] }))
    expect(isProblemError(e)).toBe(true)
    expect(problemMessageKey(e)).toBe('errors.seatLimit')
    expect(outcomeOf(e)).toBe('failure')
    expect(server.calls).toHaveLength(1)
  })

  it('reads a lowercase code as the Swagger text writes it (`seat_limit_reached`)', async () => {
    const server = stubServer()
    server.reply(409, problemBody(409, 'seat_limit_reached'))
    const e = await failure(() => org().invite({ email: 'a@b.co', fullName: 'A', initialTenantRoles: [], initialDeptMappings: [] }))
    expect(problemMessageKey(e)).toBe('errors.seatLimit')
  })

  it('409 OPTIMISTIC_LOCK_CONFLICT: the current version comes from the record_version extension', async () => {
    const server = stubServer()
    server.reply(409, problemBody(409, 'OPTIMISTIC_LOCK_CONFLICT', { record_version: 4 }))
    const e = await failure(() => org().setMemberStatus(U2, 'suspended', recordVersion(3)))
    expect(problemMessageKey(e)).toBe('errors.conflict')
    expect(currentRecordVersion(e)).toBe(4)
    expect(outcomeOf(e)).toBe('failure')
    expect(server.calls).toHaveLength(1)
  })

  it('409 WORKFLOW_RESOLUTION_REQUIRED on remove: the extension members survive for the resolution dialog (E2a step 2)', async () => {
    const server = stubServer()
    server.reply(
      409,
      problemBody(409, 'WORKFLOW_RESOLUTION_REQUIRED', { active_workflows: 3, workflow_ids: ['w-1', 'w-2', 'w-3'], allowed_actions: ['replace_delegate', 'stop_workflows'] }),
    )
    const e = await failure(() => org().removeMember(U2))
    expect(isProblemError(e) && e.errorCode).toBe('WORKFLOW_RESOLUTION_REQUIRED')
    if (!isProblemError(e)) throw new Error('not a problem')
    expect(e.extensions).toMatchObject({ active_workflows: 3, workflow_ids: ['w-1', 'w-2', 'w-3'], allowed_actions: ['replace_delegate', 'stop_workflows'] })
    expect(problemMessageKey(e)).toBe('errors.resolutionRequired')
  })

  it('503 REALM_PROVISIONER_UNAVAILABLE on reset MFA: nothing changed, a fault, and the write is not retried', async () => {
    const server = stubServer()
    server.reply(503, problemBody(503, 'REALM_PROVISIONER_UNAVAILABLE'))
    const e = await failure(() => org().resetMfa(U1))
    expect(problemMessageKey(e)).toBe('errors.unavailable')
    expect(outcomeOf(e)).toBe('error')
    expect(server.calls).toHaveLength(1)
  })

  it('403 DENY_MFA_STALE from the gateway: step-up, not a permission message', async () => {
    const server = stubServer()
    server.reply(403, problemBody(403, 'DENY_MFA_STALE'))
    const e = await failure(() => org().resetMfa(U1))
    expect(isMfaStale(e)).toBe(true)
    expect(isRoleDenied(e)).toBe(false)
    expect(problemMessageKey(e)).toBe('errors.mfaStale')
  })

  it('403 DENY_ROLE_INSUFFICIENT: the hints are stale, refresh the session context', async () => {
    const server = stubServer()
    server.reply(403, problemBody(403, 'DENY_ROLE_INSUFFICIENT'))
    const e = await failure(() => org().getSeatUsage())
    expect(isRoleDenied(e)).toBe(true)
    expect(problemMessageKey(e)).toBe('errors.noPermission')
    expect(outcomeOf(e)).toBe('failure')
  })

  it('422 LAST_OWNER_REMOVAL on a role change', async () => {
    const server = stubServer()
    server.reply(422, problemBody(422, 'LAST_OWNER_REMOVAL'))
    const e = await failure(() => org().setRoles(U1, []))
    expect(problemMessageKey(e)).toBe('errors.lastOwner')
    expect(outcomeOf(e)).toBe('failure')
  })

  it('no response at all (offline): a fault the user can retry', async () => {
    rs.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch')
    })
    const e = await failure(() => org().resetMfa(U1))
    expect(e).toBeInstanceOf(NetworkError)
    expect(outcomeOf(e)).toBe('error')
    expect(problemMessageKey(e)).toBeUndefined()
  })
})
