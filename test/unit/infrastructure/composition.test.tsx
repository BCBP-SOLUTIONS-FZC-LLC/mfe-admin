// The composition root: every port wired, the tenant ID read at call time, no request without a
// workspace, and the ApiClient made on first use (it reads the runtime config, which loads first).
import { renderHook } from '@testing-library/react'
import { describe, expect, it, rs } from '@rstest/core'
import AdminProviders from '../../../src/app/providers/AdminProviders'
import { createAdminServices, lazyApiClient } from '../../../src/app/providers/composition'
import { useAdminServices } from '../../../src/presentation/features/services'
import { MissingWorkspaceError, requireTenant, withSignal } from '../../../src/infrastructure/api/scope'
import { startPlatform } from '../../fixtures/platform'
import { stubServer } from '../../contract/harness'
import * as f from '../../contract/fixtures'

describe('createAdminServices', () => {
  it('has no workspace by default (before the session context loads)', async () => {
    startPlatform()
    await expect(createAdminServices().orgMembership.getSeatUsage()).rejects.toBeInstanceOf(MissingWorkspaceError)
  })

  it('wires every port the screens use, and no workflow port', () => {
    startPlatform()
    const services = createAdminServices({ tenantId: () => 't-1' })
    expect(Object.keys(services).sort()).toEqual(['audit', 'catalog', 'delegationPolicy', 'exportJobs', 'groupMapping', 'navigation', 'orgMembership', 'problems', 'telemetry', 'userProfile'])
  })

  it('refuses to send a request with no workspace, and sends nothing', async () => {
    startPlatform()
    const server = stubServer()
    const services = createAdminServices({ tenantId: () => undefined })
    await expect(services.orgMembership.getSeatUsage()).rejects.toBeInstanceOf(MissingWorkspaceError)
    await expect(services.groupMapping.getAll()).rejects.toBeInstanceOf(MissingWorkspaceError)
    expect(server.calls).toEqual([])
    rs.unstubAllGlobals()
  })

  it('calls the calls that need no workspace in the path (audit, catalogue, delegation policy, profiles)', async () => {
    startPlatform()
    const server = stubServer()
    server.reply(200, f.catalog)
    const services = createAdminServices({ tenantId: () => undefined })
    await expect(services.catalog.listDepartments()).resolves.toHaveLength(2)
    rs.unstubAllGlobals()
  })

  it('reads the tenant ID at call time', async () => {
    startPlatform()
    const server = stubServer()
    let tenant: string | undefined = 'first'
    const services = createAdminServices({ tenantId: () => tenant })
    server.reply(200, f.seatUsage)
    await services.orgMembership.getSeatUsage()
    tenant = 'second'
    server.reply(200, f.seatUsage)
    await services.orgMembership.getSeatUsage()
    expect(server.calls.map((c) => c.pathname)).toEqual(['/api/v1/tenants/first/seat-usage', '/api/v1/tenants/second/seat-usage'])
    rs.unstubAllGlobals()
  })
})

describe('an abort signal', () => {
  it('reaches the request: an aborted call rejects and nothing is answered', async () => {
    startPlatform()
    const server = stubServer()
    const controller = new AbortController()
    controller.abort()
    const services = createAdminServices({ tenantId: () => 't-1' })
    await expect(services.orgMembership.getSeatUsage(controller.signal)).rejects.toBeTruthy()
    expect(server.calls).toEqual([])
    rs.unstubAllGlobals()
  })

  it('is passed on when given, and left out when not', () => {
    expect(withSignal()).toEqual({})
    const signal = new AbortController().signal
    expect(withSignal(signal)).toEqual({ signal })
  })
})

describe('requireTenant', () => {
  it('answers the ID, or throws', () => {
    const client = lazyApiClient(() => {
      throw new Error('not needed')
    })
    expect(requireTenant({ client, tenantId: () => 'abc' })).toBe('abc')
    expect(() => requireTenant({ client, tenantId: () => '' })).toThrow(MissingWorkspaceError)
    expect(() => requireTenant({ client, tenantId: () => undefined })).toThrow('no tenant ID')
  })
})

describe('lazyApiClient', () => {
  it('makes the client on the first call, once, and passes every method through', async () => {
    const calls: string[] = []
    const real = {
      get: async (t: string) => (calls.push(`get ${t}`), { data: 1 }),
      post: async (t: string) => (calls.push(`post ${t}`), { data: 2 }),
      put: async (t: string) => (calls.push(`put ${t}`), { data: 3 }),
      patch: async (t: string) => (calls.push(`patch ${t}`), { data: 4 }),
      delete: async (t: string) => (calls.push(`delete ${t}`), { data: 5 }),
    }
    const make = rs.fn(() => real as never)
    const client = lazyApiClient(make)
    expect(make).not.toHaveBeenCalled()
    await client.get('/a')
    await client.post('/b')
    await client.put('/c')
    await client.patch('/d')
    await client.delete('/e')
    expect(make).toHaveBeenCalledTimes(1)
    expect(calls).toEqual(['get /a', 'post /b', 'put /c', 'patch /d', 'delete /e'])
  })
})

describe('AdminProviders wires the session context\'s tenant ID into the adapters', () => {
  it('the services it gives out call the workspace of the session', async () => {
    const platform = startPlatform({ context: { tenantId: 'tenant-from-session' } })
    const server = stubServer()
    server.reply(200, f.seatUsage)
    const { result } = renderHook(() => useAdminServices(), {
      wrapper: ({ children }) => (
        <platform.Wrapper>
          <AdminProviders>{children}</AdminProviders>
        </platform.Wrapper>
      ),
    })
    await result.current.orgMembership.getSeatUsage()
    expect(server.calls[0]!.pathname).toBe('/api/v1/tenants/tenant-from-session/seat-usage')
    rs.unstubAllGlobals()
  })
})

describe('createNavigation', () => {
  it('sends the upgrade to the billing area of the workspace through the shell\'s router', async () => {
    const { registerNavigator } = await import('@bcbp-solutions-fzc-llc/frontend-sdk/nav')
    const { rs } = await import('@rstest/core')
    const { createNavigation } = await import('../../../src/infrastructure/federation/navigation')
    startPlatform()
    const navigator = rs.fn()
    registerNavigator(navigator)
    createNavigation('/t/acme').upgrade()
    expect(navigator).toHaveBeenCalledWith('billing', '/t/acme/billing', undefined)
  })
})
