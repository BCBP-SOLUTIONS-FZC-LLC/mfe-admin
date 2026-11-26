// The application layer's use cases: one per repository-port operation, each forwarding its arguments
// (the abort signal included) to the port and returning the port's answer (ADR 0004).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, rs } from '@rstest/core'
import { createUseCases, type AdminRepositories } from '../../../src/application/use-cases'

const ROOT = join(__dirname, '../../..')
const PORTS: Record<keyof AdminRepositories, string> = {
  orgMembership: 'OrgMembershipPort',
  userProfile: 'UserProfilePort',
  catalog: 'CatalogPort',
  groupMapping: 'GroupMappingPort',
  audit: 'AuditPort',
  delegationPolicy: 'DelegationPolicyPort',
}

/** The operations a port declares, read from its source (so a new operation without a use case fails here). */
function methodsOf(iface: string): string[] {
  const text = readFileSync(join(ROOT, `src/domain/repositories/${iface}.ts`), 'utf8')
  return [...text.slice(text.indexOf(`export interface ${iface}`)).matchAll(/^ {2}([a-zA-Z]+)\(/gm)].map((m) => m[1]!)
}

function fakePorts(): { ports: AdminRepositories; calls: Map<string, ReturnType<typeof rs.fn>> } {
  const calls = new Map<string, ReturnType<typeof rs.fn>>()
  const ports = Object.fromEntries(
    Object.entries(PORTS).map(([name, iface]) => [
      name,
      Object.fromEntries(
        methodsOf(iface).map((m) => {
          const fn = rs.fn(async (...args: unknown[]) => ({ answer: `${name}.${m}`, args }))
          calls.set(`${name}.${m}`, fn)
          return [m, fn]
        }),
      ),
    ]),
  ) as unknown as AdminRepositories
  return { ports, calls }
}

describe('use cases', () => {
  const { ports, calls } = fakePorts()
  const useCases = createUseCases(ports) as unknown as Record<string, { execute: (...a: unknown[]) => Promise<unknown> }>

  it('exist for every operation of every repository port', () => {
    expect(Object.keys(useCases).length).toBe(calls.size)
    for (const key of Object.keys(useCases)) expect(typeof useCases[key]!.execute, key).toBe('function')
  })

  it('forward arguments, signal included, and return the port\'s answer', async () => {
    const signal = new AbortController().signal
    const seen = new Set<string>()
    for (const [name, iface] of Object.entries(PORTS)) {
      for (const method of methodsOf(iface)) {
        const fn = calls.get(`${name}.${method}`)!
        const before = fn.mock.calls.length
        let answered: unknown
        let matched = 0
        for (const [key, uc] of Object.entries(useCases)) {
          const b = fn.mock.calls.length
          answered = await uc.execute('a', 'b', signal)
          if (fn.mock.calls.length > b) {
            matched++
            expect(fn.mock.calls.at(-1)).toEqual(['a', 'b', signal])
            expect(answered).toEqual({ answer: `${name}.${method}`, args: ['a', 'b', signal] })
            seen.add(key)
            break
          }
        }
        expect(matched, `${name}.${method} has a use case`).toBe(1)
        expect(fn.mock.calls.length).toBeGreaterThan(before)
      }
    }
    expect(seen.size).toBe(calls.size)
  })
})
