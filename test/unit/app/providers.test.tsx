// The mount's providers: one QueryClient per mount (cleared on unmount, never at module level) and
// the services; and the client's retry rules (ADR 0001).
import { useQueryClient } from '@tanstack/react-query'
import { ProblemError } from '@bcbp-solutions-fzc-llc/frontend-sdk/problem'
import { render, renderHook } from '@testing-library/react'
import { describe, expect, it, rs } from '@rstest/core'
import AdminProviders from '../../../src/app/providers/AdminProviders'
import { createAdminServices } from '../../../src/app/providers/composition'
import { createQueryClient } from '../../../src/app/providers/queryClient'
import { useAdminServices, useProvidedServices } from '../../../src/presentation/features/services'
import { metricsTelemetry } from '../../../src/infrastructure/telemetry/metrics'
import { fakeTelemetry } from '../../fixtures/services'
import { withServices } from '../../fixtures/services'

describe('AdminProviders', () => {
  it('gives each mount its own QueryClient', () => {
    const first = renderHook(() => useQueryClient(), { wrapper: AdminProviders })
    const second = renderHook(() => useQueryClient(), { wrapper: AdminProviders })
    expect(first.result.current).not.toBe(second.result.current)
  })

  it('clears the cache when the mount goes away', () => {
    const seen: { client?: ReturnType<typeof useQueryClient> } = {}
    function Probe() {
      seen.client = useQueryClient()
      return null
    }
    const { unmount } = render(
      <AdminProviders>
        <Probe />
      </AdminProviders>,
    )
    seen.client!.setQueryData(['admin', 'acme', 'members'], [1])
    const clear = rs.spyOn(seen.client!, 'clear')
    unmount()
    expect(clear).toHaveBeenCalled()
    expect(seen.client!.getQueryData(['admin', 'acme', 'members'])).toBeUndefined()
  })

  it('wires the metrics telemetry when no outer provider supplies services', () => {
    const { result } = renderHook(() => useAdminServices(), { wrapper: AdminProviders })
    expect(result.current.telemetry).toBe(metricsTelemetry)
    expect(createAdminServices().telemetry).toBe(metricsTelemetry)
  })

  it('uses the services an outer provider (a test) supplies', () => {
    const { telemetry } = fakeTelemetry()
    const outer = withServices({ telemetry })
    const { result } = renderHook(() => useAdminServices(), {
      wrapper: ({ children }) => (
        <outer.Wrapper>
          <AdminProviders>{children}</AdminProviders>
        </outer.Wrapper>
      ),
    })
    expect(result.current.telemetry).toBe(telemetry)
  })

  it('has no services outside a provider: useProvidedServices answers undefined and useAdminServices throws', () => {
    expect(renderHook(() => useProvidedServices()).result.current).toBeUndefined()
    expect(() => renderHook(() => useAdminServices())).toThrow('useAdminServices needs an AdminServicesProvider')
  })
})

describe('createQueryClient', () => {
  const problem = (status: number) => new ProblemError({ type: 'about:blank', title: 'T', status, extensions: {} })

  it('does not refetch on window focus (the hints refresh from the session context instead)', () => {
    expect(createQueryClient().getDefaultOptions().queries?.refetchOnWindowFocus).toBe(false)
  })

  it('does not retry mutations', () => {
    expect(createQueryClient().getDefaultOptions().mutations?.retry).toBe(false)
  })

  it('retries a 503 query up to twice, and never a 409', () => {
    const retry = createQueryClient().getDefaultOptions().queries!.retry as (count: number, error: unknown) => boolean
    expect(retry(0, problem(503))).toBe(true)
    expect(retry(2, problem(503))).toBe(false)
    expect(retry(0, problem(409))).toBe(false)
  })
})
