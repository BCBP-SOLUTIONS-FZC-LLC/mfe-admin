import { describe, expect, it } from '@rstest/core'
import { EMPTY_AUDIT_FILTER, auditFilterFromEntries, auditFilterToEntries } from '../../../src/domain/value-objects/AuditFilter'
import { parseCursor } from '../../../src/domain/value-objects/Cursor'
import { recordVersion, tryRecordVersion } from '../../../src/domain/value-objects/RecordVersion'

describe('RecordVersion', () => {
  it('accepts a non-negative integer', () => {
    expect(recordVersion(0)).toBe(0)
    expect(recordVersion(41)).toBe(41)
    expect(tryRecordVersion(4)).toBe(4)
  })

  it.each([[-1], [1.5], [Number.NaN], ['4'], [null], [undefined]])('refuses %s', (value) => {
    expect(() => recordVersion(value)).toThrow(TypeError)
    expect(tryRecordVersion(value)).toBeUndefined()
  })
})

describe('Cursor', () => {
  it('is the next_cursor when there is one', () => {
    expect(parseCursor('eyJpZCI6MX0=')).toBe('eyJpZCI6MX0=')
  })

  it.each([[undefined], [null], [''], ['   '], [7]])('is undefined for %j: no further page', (value) => {
    expect(parseCursor(value)).toBeUndefined()
  })
})

describe('AuditFilter', () => {
  it('reads URL pairs, with several entry types', () => {
    const f = auditFilterFromEntries([
      ['from', '2026-11-01T00:00:00Z'],
      ['entry_type', 'auth.login'],
      ['entry_type', 'membership.added'],
      ['actor_type', 'user'],
      ['retention_tier', 'security_3y'],
      ['target_type', 'member'],
      ['target_id', 'u-1'],
      ['source_service', 'iam-org-membership'],
      ['actor_id', 'u-9'],
      ['to', '2026-11-30T00:00:00Z'],
    ])
    expect(f).toEqual({
      entryTypes: ['auth.login', 'membership.added'],
      from: '2026-11-01T00:00:00Z',
      to: '2026-11-30T00:00:00Z',
      actorId: 'u-9',
      actorType: 'user',
      targetType: 'member',
      targetId: 'u-1',
      sourceService: 'iam-org-membership',
      retentionTier: 'security_3y',
    })
  })

  it('opens a stale link: unknown keys, blank values and out-of-vocabulary values are ignored', () => {
    const f = auditFilterFromEntries([
      ['actor_type', 'robot'],
      ['retention_tier', 'forever'],
      ['bogus', 'x'],
      ['from', '  '],
      ['entry_type', ' '],
      ['entry_type', 'auth.login'],
      ['entry_type', 'auth.login'],
    ])
    expect(f).toEqual({ entryTypes: ['auth.login'] })
  })

  it('takes the first value of a repeated single-value key', () => {
    expect(auditFilterFromEntries([['from', 'a'], ['from', 'b']]).from).toBe('a')
  })

  it('writes an empty filter as no pairs', () => {
    expect(auditFilterToEntries(EMPTY_AUDIT_FILTER)).toEqual([])
  })

  it('round-trips a filter through URL pairs, in a fixed order', () => {
    const filter = auditFilterFromEntries([
      ['retention_tier', 'access_90d'],
      ['entry_type', 'config.changed'],
      ['actor_type', 'service_account'],
      ['from', '2026-01-01T00:00:00Z'],
    ])
    const pairs = auditFilterToEntries(filter)
    expect(pairs).toEqual([
      ['from', '2026-01-01T00:00:00Z'],
      ['entry_type', 'config.changed'],
      ['actor_type', 'service_account'],
      ['retention_tier', 'access_90d'],
    ])
    expect(auditFilterFromEntries(pairs)).toEqual(filter)
  })
})
