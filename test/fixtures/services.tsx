import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { ExportJobStore } from '../../src/application/ports/exportJobs'
import type { AdminTelemetry, Measurement } from '../../src/application/ports/telemetry'
import { problemReader } from '../../src/infrastructure/api/problem'
import { AdminServicesProvider, type AdminServices } from '../../src/presentation/features/services'

/** An in-memory export job list, as the SDK storage would hold it. */
export function memoryExportJobs(initial: readonly string[] = []): ExportJobStore {
  let ids = [...initial]
  return {
    list: () => ids,
    add: (id) => void (ids = [id, ...ids.filter((x) => x !== id)]),
    remove: (id) => void (ids = ids.filter((x) => x !== id)),
  }
}

/** A port with the given methods; any other method fails the test if it is called. */
export function partial<T extends object>(name: string, impl: Partial<T>): T {
  const fallback = unwired<T>(name)
  return new Proxy(impl as T, {
    get(target, method, receiver) {
      if (method in target) return Reflect.get(target, method, receiver)
      return Reflect.get(fallback, method, receiver)
    },
  })
}

/** A port that fails the test if the code under test calls it: a test wires only the ports it needs. */
function unwired<T extends object>(name: string): T {
  return new Proxy({} as T, {
    get(_target, method) {
      if (method === 'then') return undefined
      return () => {
        throw new Error(`${name}.${String(method)} was called but the test wired no ${name}`)
      }
    },
  })
}

/** A recording telemetry: every call, in order, with the outcome a measurement finished with. */
export function fakeTelemetry() {
  const calls: string[] = []
  const measurement = <O extends string>(label: string): Measurement<O> => {
    let done = false
    return {
      finish(outcome) {
        if (done) return
        done = true
        calls.push(`${label}:${outcome}`)
      },
    }
  }
  const telemetry: AdminTelemetry = {
    loadStarted: (resource) => measurement(`load:${resource}`),
    actionStarted: (action) => measurement(`action:${action}`),
    stepUpRequested: (action) => void calls.push(`stepUp:${action}`),
  }
  return { telemetry, calls }
}

/** A QueryClient for tests: no retries, so a failing query fails at once. */
export function testQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

/** Wraps children in a test QueryClient and services (default: a recording telemetry). */
export function withServices(overrides: Partial<AdminServices> = {}) {
  const { telemetry, calls } = fakeTelemetry()
  const services: AdminServices = {
    telemetry,
    navigation: { upgrade: () => void calls.push('navigate:upgrade') },
    problems: problemReader,
    exportJobs: memoryExportJobs(),
    orgMembership: unwired('orgMembership'),
    userProfile: unwired('userProfile'),
    catalog: unwired('catalog'),
    groupMapping: unwired('groupMapping'),
    audit: unwired('audit'),
    delegationPolicy: unwired('delegationPolicy'),
    ...overrides,
  }
  const client = testQueryClient()
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <AdminServicesProvider value={services}>{children}</AdminServicesProvider>
      </QueryClientProvider>
    )
  }
  return { Wrapper, client, services, calls }
}
