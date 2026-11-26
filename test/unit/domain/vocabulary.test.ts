// The wire vocabulary and the metric label sets are closed lists other code depends on
// (docs/observability/metrics.md): these tests pin them, so a change is a deliberate one.
import { describe, expect, it } from '@rstest/core'
import { ACTION_OUTCOMES, ADMIN_ACTIONS, LOAD_OUTCOMES, LOAD_RESOURCES, STEP_UP_ACTIONS } from '../../../src/domain/events/admin-events'
import { DEPARTMENT_LEVELS, TENANT_ROLES } from '../../../src/domain/vocabulary'

describe('IAM wire vocabulary', () => {
  it('has the three grantable tenant roles; member is implicit and never listed', () => {
    expect([...TENANT_ROLES]).toEqual(['tenant_owner', 'tenant_admin', 'tender_admin'])
    expect(TENANT_ROLES).not.toContain('member')
  })

  it('has the three department levels', () => {
    expect([...DEPARTMENT_LEVELS]).toEqual(['preparator', 'reviewer', 'approver'])
  })
})

describe('telemetry label sets', () => {
  it('uses the registry outcome vocabulary: loads have no business rejection', () => {
    expect([...ACTION_OUTCOMES]).toEqual(['success', 'failure', 'error'])
    expect([...LOAD_OUTCOMES]).toEqual(['success', 'error'])
  })

  it.each([
    ['actions', ADMIN_ACTIONS, 18],
    ['resources', LOAD_RESOURCES, 11],
    ['step-up actions', STEP_UP_ACTIONS, 1],
  ])('has %s with no duplicate and the size metrics.md plans for', (_name, values, size) => {
    expect(new Set(values).size).toBe(values.length)
    expect(values).toHaveLength(size)
  })

  it('names every step-up action among the actions', () => {
    for (const action of STEP_UP_ACTIONS) expect(ADMIN_ACTIONS).toContain(action)
  })

  it('uses snake_case values only (a registry label pattern)', () => {
    for (const value of [...ADMIN_ACTIONS, ...LOAD_RESOURCES]) expect(value).toMatch(/^[a-z][a-z0-9_]*$/)
  })
})
