import { AbortedError, NetworkError, ProblemError, TimeoutError } from '@bcbp-solutions-fzc-llc/frontend-sdk/problem'
import { describe, expect, it } from '@rstest/core'
import {
  currentRecordVersion,
  isConflict,
  isMfaStale,
  isRetryableQueryError,
  isRoleDenied,
  loadOutcomeOf,
  outcomeOf,
  problemMessageKey,
} from '../../../src/infrastructure/api/problem'
import en from '../../../src/infrastructure/configuration/locales/en.json'

const problem = (status: number, errorCode?: string, extensions: Record<string, unknown> = {}) =>
  new ProblemError({ type: 'about:blank', title: 'T', status, ...(errorCode ? { errorCode } : {}), extensions })

describe('outcomeOf (metric outcome of a failed write)', () => {
  it.each([
    [problem(409, 'SEAT_LIMIT_REACHED'), 'failure'],
    [problem(422, 'LAST_OWNER_REMOVAL'), 'failure'],
    [problem(409, 'OPTIMISTIC_LOCK_CONFLICT'), 'failure'],
    [problem(429, 'REINVITE_TOO_SOON'), 'failure'],
    [problem(403, 'DENY_ROLE_INSUFFICIENT'), 'failure'],
    [problem(401), 'failure'],
    [problem(500), 'error'],
    [problem(503, 'WORKFLOW_SERVICE_UNAVAILABLE'), 'error'],
    [problem(503, 'DENY_SERVICE_UNAVAILABLE'), 'error'],
    [new NetworkError(false, 'r1'), 'error'],
    [new NetworkError(true, 'r1'), 'error'],
    [new TimeoutError(35000, 'r1'), 'error'],
    [new Error('bug'), 'error'],
  ] as const)('%s → %s', (error, outcome) => {
    expect(outcomeOf(error)).toBe(outcome)
  })

  it('is undefined when the caller aborted: not a failure at all', () => {
    expect(outcomeOf(new AbortedError())).toBeUndefined()
    expect(outcomeOf(new DOMException('aborted', 'AbortError'))).toBeUndefined()
  })
})

describe('loadOutcomeOf', () => {
  it('is always "error" for a failed load (loads have no business rejection)', () => {
    expect(loadOutcomeOf(problem(403, 'DENY_ROLE_INSUFFICIENT'))).toBe('error')
    expect(loadOutcomeOf(problem(500))).toBe('error')
  })

  it('is undefined when aborted: a superseded load is not counted', () => {
    expect(loadOutcomeOf(new AbortedError())).toBeUndefined()
  })
})

describe('isRetryableQueryError', () => {
  it.each([
    [new NetworkError(false, 'r'), true],
    [new TimeoutError(1, 'r'), true],
    [problem(429), true],
    [problem(500), true],
    [problem(503), true],
    [problem(409), false],
    [problem(422), false],
    [problem(403), false],
    [problem(404), false],
    [new Error('bug'), false],
  ] as const)('%s → %s on the first failure', (error, retry) => {
    expect(isRetryableQueryError(0, error)).toBe(retry)
  })

  it('retries twice at most', () => {
    expect(isRetryableQueryError(1, problem(503))).toBe(true)
    expect(isRetryableQueryError(2, problem(503))).toBe(false)
  })
})

describe('problemMessageKey', () => {
  it('names the catalogue message for a known code, whatever its case', () => {
    expect(problemMessageKey(problem(409, 'SEAT_LIMIT_REACHED'))).toBe('errors.seatLimit')
    expect(problemMessageKey(problem(409, 'seat_limit_reached'))).toBe('errors.seatLimit')
    expect(problemMessageKey(problem(422, 'LAST_OWNER_REMOVAL'))).toBe('errors.lastOwner')
  })

  it('maps both lock-conflict codes to one message', () => {
    expect(problemMessageKey(problem(409, 'VERSION_CONFLICT'))).toBe(problemMessageKey(problem(409, 'OPTIMISTIC_LOCK_CONFLICT')))
  })

  it('reads every gateway deny code the SDK lists that this remote can meet', () => {
    expect(problemMessageKey(problem(403, 'DENY_ROLE_INSUFFICIENT'))).toBe('errors.noPermission')
    expect(problemMessageKey(problem(403, 'DENY_TENANT_READ_ONLY'))).toBe('errors.readOnly')
    expect(problemMessageKey(problem(403, 'DENY_MFA_STALE'))).toBe('errors.mfaStale')
    expect(problemMessageKey(problem(503, 'DENY_SERVICE_UNAVAILABLE'))).toBe('errors.accessCheckUnavailable')
    expect(problemMessageKey(problem(403, 'DENY_MEMBER_SUSPENDED'))).toBe('errors.memberSuspended')
    expect(problemMessageKey(problem(403, 'DENY_UNRESOLVABLE_SUBJECT'))).toBe('errors.notAMember')
  })

  it('says "nothing was changed" for every 503 unavailable code', () => {
    for (const code of ['WORKFLOW_SERVICE_UNAVAILABLE', 'REALM_PROVISIONER_UNAVAILABLE', 'DB_UNAVAILABLE', 'CATALOG_UNAVAILABLE']) {
      expect(problemMessageKey(problem(503, code))).toBe('errors.unavailable')
    }
  })

  it('is undefined for an unknown code, no code, or a non-problem: the SDK\'s generic message is used instead', () => {
    expect(problemMessageKey(problem(400, 'SOMETHING_NEW'))).toBeUndefined()
    expect(problemMessageKey(problem(500))).toBeUndefined()
    expect(problemMessageKey(new NetworkError(false, 'r'))).toBeUndefined()
  })

  it('only names keys the catalogue has', () => {
    const codes = ['SEAT_LIMIT_REACHED', 'INVITATION_ALREADY_EXISTS', 'REINVITE_TOO_SOON', 'INVITE_RATE_LIMITED', 'LAST_OWNER_REMOVAL', 'WORKFLOW_RESOLUTION_REQUIRED', 'INVALID_ACTION', 'INVALID_REPLACEMENT', 'MEMBER_NOT_ACTIVE', 'DEPARTMENT_NOT_ACTIVE_FOR_TENANT', 'SYSTEM_DEPARTMENT_CANNOT_BE_RETIRED', 'OPTIMISTIC_LOCK_CONFLICT', 'MAPPING_CONFLICT', 'DEPARTMENT_NOT_IN_CATALOG', 'ROLE_ASSIGNMENT_FORBIDDEN', 'RATE_LIMITED', 'DB_UNAVAILABLE', 'DENY_ROLE_INSUFFICIENT']
    for (const code of codes) expect(Object.keys(en), code).toContain(problemMessageKey(problem(400, code)))
  })
})

describe('gateway signals', () => {
  it('spots a stale permission hint (DENY_ROLE_INSUFFICIENT) and a stale MFA (DENY_MFA_STALE)', () => {
    expect(isRoleDenied(problem(403, 'DENY_ROLE_INSUFFICIENT'))).toBe(true)
    expect(isRoleDenied(problem(403, 'DENY_MFA_STALE'))).toBe(false)
    expect(isMfaStale(problem(403, 'DENY_MFA_STALE'))).toBe(true)
    expect(isMfaStale(new Error('x'))).toBe(false)
    expect(isRoleDenied('nope')).toBe(false)
  })

  it('reads the current version from a lock conflict\'s record_version', () => {
    expect(currentRecordVersion(problem(409, 'OPTIMISTIC_LOCK_CONFLICT', { record_version: 4 }))).toBe(4)
    expect(currentRecordVersion(problem(409, 'OPTIMISTIC_LOCK_CONFLICT'))).toBeUndefined()
    expect(currentRecordVersion(problem(409, 'OPTIMISTIC_LOCK_CONFLICT', { record_version: '4' }))).toBeUndefined()
    expect(currentRecordVersion(new Error('x'))).toBeUndefined()
  })
})

describe('isConflict', () => {
  it('is true for both lock-conflict codes, whatever their case', () => {
    expect(isConflict(problem(409, 'OPTIMISTIC_LOCK_CONFLICT'))).toBe(true)
    expect(isConflict(problem(409, 'version_conflict'))).toBe(true)
  })

  it('is false for another 409, another status, or a non-problem', () => {
    expect(isConflict(problem(409, 'SEAT_LIMIT_REACHED'))).toBe(false)
    expect(isConflict(problem(409))).toBe(false)
    expect(isConflict(new Error('x'))).toBe(false)
  })
})
