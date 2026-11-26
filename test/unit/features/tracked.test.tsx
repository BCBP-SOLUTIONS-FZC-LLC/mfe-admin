// The shared query and mutation hooks: they record the iam_admin_* metrics through the telemetry
// port, invalidate what a write made stale, and ask for a session-context refresh when the gateway
// says the permission hints are stale (LLD §7.5, §11).
import { AbortedError, NetworkError, ProblemError } from '@bcbp-solutions-fzc-llc/frontend-sdk/problem'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, rs } from '@rstest/core'
import { adminKeys } from '../../../src/application/queries/keys'
import { useTrackedInfiniteQuery, useTrackedMutation, useTrackedQuery } from '../../../src/presentation/features/tracked'
import { useUserProfiles } from '../../../src/presentation/features/identity/useUserProfiles'
import { useDepartmentDirectory } from '../../../src/presentation/features/identity/useDepartmentDirectory'
import type { OrgMembershipPort } from '../../../src/domain/repositories/OrgMembershipPort'
import type { UserProfilePort } from '../../../src/domain/repositories/UserProfilePort'
import { OWNER, startPlatform } from '../../fixtures/platform'
import { partial, withServices } from '../../fixtures/services'
import { ADA, BOB, departments, roleLabels } from '../../fixtures/people'

const refresh = rs.fn(async () => {})
rs.mock('../../../src/presentation/features/session/useSessionRefresh', () => ({ useSessionRefresh: () => refresh }))

const problem = (status: number, errorCode: string) => new ProblemError({ type: 'about:blank', title: 'T', status, errorCode, extensions: {} })

function setup(o: { ready?: boolean; services?: Parameters<typeof withServices>[0] } = {}) {
  const platform = startPlatform({ permissions: OWNER, context: o.ready === false ? { slug: '' } : { slug: 'acme', tenantId: 't-1' } })
  const harness = withServices(o.services)
  const wrapper = ({ children }: { children: ReactNode }) => (
    <platform.Wrapper>
      <harness.Wrapper>{children}</harness.Wrapper>
    </platform.Wrapper>
  )
  return { ...harness, wrapper }
}

beforeEach(() => {
  refresh.mockClear()
})

describe('useTrackedQuery', () => {
  const key = adminKeys('acme').seatUsage()

  it('measures a load and finishes it with success', async () => {
    const h = setup()
    const { result } = renderHook(() => useTrackedQuery({ resource: 'seat_usage', queryKey: key, queryFn: async () => 1 }), { wrapper: h.wrapper })
    await waitFor(() => expect(result.current.data).toBe(1))
    expect(h.calls).toEqual(['load:seat_usage:success'])
  })

  it('finishes a failed load with error, and keeps the error for the screen', async () => {
    const h = setup()
    const { result } = renderHook(() => useTrackedQuery({ resource: 'seat_usage', queryKey: key, queryFn: async () => { throw problem(500, 'INTERNAL') } }), { wrapper: h.wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(h.calls).toEqual(['load:seat_usage:error'])
  })

  it('does not count a load the caller aborted (a superseded load)', async () => {
    const h = setup()
    const { result } = renderHook(() => useTrackedQuery({ resource: 'seat_usage', queryKey: key, queryFn: async () => { throw new AbortedError() } }), { wrapper: h.wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(h.calls).toEqual([])
  })

  it('does not run until the session context has a workspace, nor while disabled', async () => {
    const queryFn = rs.fn(async () => 1)
    const notReady = setup({ ready: false })
    renderHook(() => useTrackedQuery({ resource: 'seat_usage', queryKey: key, queryFn }), { wrapper: notReady.wrapper })
    const disabled = setup()
    renderHook(() => useTrackedQuery({ resource: 'seat_usage', queryKey: key, queryFn, enabled: false }), { wrapper: disabled.wrapper })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(queryFn).not.toHaveBeenCalled()
  })

  it('keeps a result fresh for the staleTime given', async () => {
    const h = setup()
    const queryFn = rs.fn(async () => 1)
    const make = () => renderHook(() => useTrackedQuery({ resource: 'seat_usage', queryKey: key, queryFn, staleTime: 60_000 }), { wrapper: h.wrapper })
    const first = make()
    await waitFor(() => expect(first.result.current.data).toBe(1))
    make()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(queryFn).toHaveBeenCalledTimes(1)
  })
})

describe('useTrackedInfiniteQuery', () => {
  it('measures each page as one load, passes the cursor on, and stops at the last page', async () => {
    const h = setup()
    const queryFn = rs.fn(async (cursor: string | undefined) => (cursor ? { items: [2] } : { items: [1], next: 'c2' }))
    const { result } = renderHook(
      () => useTrackedInfiniteQuery({ resource: 'members', queryKey: ['k'], queryFn: (cursor) => queryFn(cursor), nextCursor: (p: { next?: string }) => p.next }),
      { wrapper: h.wrapper },
    )
    await waitFor(() => expect(result.current.hasNextPage).toBe(true))
    await act(() => result.current.fetchNextPage())
    await waitFor(() => expect(result.current.hasNextPage).toBe(false))
    expect(queryFn.mock.calls.map((c) => c[0])).toEqual([undefined, 'c2'])
    expect(h.calls).toEqual(['load:members:success', 'load:members:success'])
  })

  it('finishes a failed page with error, and does not count an aborted one', async () => {
    const failing = setup()
    const a = renderHook(() => useTrackedInfiniteQuery({ resource: 'audit', queryKey: ['a'], queryFn: async () => { throw new NetworkError(false, 'r') }, nextCursor: () => undefined }), { wrapper: failing.wrapper })
    await waitFor(() => expect(a.result.current.isError).toBe(true))
    expect(failing.calls).toEqual(['load:audit:error'])
    const aborting = setup()
    const b = renderHook(() => useTrackedInfiniteQuery({ resource: 'audit', queryKey: ['b'], queryFn: async () => { throw new AbortedError() }, nextCursor: () => undefined }), { wrapper: aborting.wrapper })
    await waitFor(() => expect(b.result.current.isError).toBe(true))
    expect(aborting.calls).toEqual([])
  })
})

describe('useTrackedMutation', () => {
  it('measures a write, finishes it with success, and invalidates the keys it names', async () => {
    const h = setup()
    h.client.setQueryData(['admin', 'acme', 'seat_usage'], 1)
    const { result } = renderHook(() => useTrackedMutation({ action: 'invite', mutationFn: async (n: number) => n * 2, invalidate: (keys) => [keys.seatUsage()] }), { wrapper: h.wrapper })
    await act(async () => {
      await result.current.mutateAsync(2)
    })
    expect(h.calls).toEqual(['action:invite:success'])
    expect(h.client.getQueryState(['admin', 'acme', 'seat_usage'])?.isInvalidated).toBe(true)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('works with nothing to invalidate', async () => {
    const h = setup()
    const { result } = renderHook(() => useTrackedMutation({ action: 'suspend', mutationFn: async () => 1 }), { wrapper: h.wrapper })
    await act(async () => {
      await result.current.mutateAsync(undefined)
    })
    expect(h.calls).toEqual(['action:suspend:success'])
  })

  it('finishes a rejection as failure and a fault as error, and does not invalidate on failure', async () => {
    const h = setup()
    h.client.setQueryData(['admin', 'acme', 'seat_usage'], 1)
    const rejecting = renderHook(() => useTrackedMutation({ action: 'remove', mutationFn: async () => { throw problem(422, 'LAST_OWNER_REMOVAL') }, invalidate: (k) => [k.seatUsage()] }), { wrapper: h.wrapper })
    await act(async () => {
      await rejecting.result.current.mutateAsync(undefined).catch(() => {})
    })
    const faulting = renderHook(() => useTrackedMutation({ action: 'remove', mutationFn: async () => { throw problem(503, 'DB_UNAVAILABLE') } }), { wrapper: h.wrapper })
    await act(async () => {
      await faulting.result.current.mutateAsync(undefined).catch(() => {})
    })
    expect(h.calls).toEqual(['action:remove:failure', 'action:remove:error'])
    expect(h.client.getQueryState(['admin', 'acme', 'seat_usage'])?.isInvalidated).toBe(false)
  })

  it('does not count a write the caller aborted', async () => {
    const h = setup()
    const { result } = renderHook(() => useTrackedMutation({ action: 'save_settings', mutationFn: async () => { throw new AbortedError() } }), { wrapper: h.wrapper })
    await act(async () => {
      await result.current.mutateAsync(undefined).catch(() => {})
    })
    expect(h.calls).toEqual([])
  })

  it('asks for a session-context refresh when the gateway says the role is insufficient, and only then', async () => {
    const h = setup()
    const denied = renderHook(() => useTrackedMutation({ action: 'invite', mutationFn: async () => { throw problem(403, 'DENY_ROLE_INSUFFICIENT') } }), { wrapper: h.wrapper })
    await act(async () => {
      await denied.result.current.mutateAsync(undefined).catch(() => {})
    })
    expect(refresh).toHaveBeenCalledTimes(1)
    const other = renderHook(() => useTrackedMutation({ action: 'invite', mutationFn: async () => { throw problem(403, 'DENY_MFA_STALE') } }), { wrapper: h.wrapper })
    await act(async () => {
      await other.result.current.mutateAsync(undefined).catch(() => {})
    })
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})

describe('useUserProfiles', () => {
  const batch = () => rs.fn(async (ids: readonly string[]) => ({ users: [ADA, BOB].filter((u) => ids.includes(u.userId)), missing: ids.filter((id) => ![ADA, BOB].some((u) => u.userId === id)) }))

  it('answers each ID found, missing or still loading', async () => {
    const userProfile = partial<UserProfilePort>('userProfile', { batch: batch() })
    const h = setup({ services: { userProfile } })
    const { result } = renderHook(() => useUserProfiles(['u-ada', 'u-ghost']), { wrapper: h.wrapper })
    expect(result.current.loading).toBe(true)
    expect(result.current.of('u-ada')).toBeUndefined()
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.of('u-ada')).toEqual({ state: 'found', user: ADA })
    expect(result.current.of('u-ghost')).toEqual({ state: 'missing' })
  })

  it('asks only for IDs it has no fresh profile for (about 60 s), so the pending tab and pickers do not refetch', async () => {
    const fn = batch()
    const h = setup({ services: { userProfile: partial<UserProfilePort>('userProfile', { batch: fn }) } })
    const first = renderHook(() => useUserProfiles(['u-ada', 'u-bob']), { wrapper: h.wrapper })
    await waitFor(() => expect(first.result.current.loading).toBe(false))
    const second = renderHook(() => useUserProfiles(['u-bob', 'u-cy']), { wrapper: h.wrapper })
    await waitFor(() => expect(second.result.current.loading).toBe(false))
    expect(fn.mock.calls.map((c) => c[0])).toEqual([['u-ada', 'u-bob'], ['u-cy']])
    expect(second.result.current.of('u-bob')).toEqual({ state: 'found', user: BOB })
  })

  it('asks again for a profile whose entry was invalidated (an edit), even inside the 60 s', async () => {
    let name = 'Ada Lovelace'
    const fn = rs.fn(async (ids: readonly string[]) => ({ users: [{ ...ADA, displayName: name }].filter((u) => ids.includes(u.userId)), missing: [] as string[] }))
    const h = setup({ services: { userProfile: partial<UserProfilePort>('userProfile', { batch: fn }) } })
    const { result } = renderHook(() => useUserProfiles(['u-ada']), { wrapper: h.wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fn).toHaveBeenCalledTimes(1)
    // What useUpdateUser does after a save: invalidate the per-ID entry and the batch lookups.
    name = 'Ada King'
    await h.client.invalidateQueries({ queryKey: ['admin', 'acme', 'users', 'u-ada'] })
    await h.client.invalidateQueries({ queryKey: ['admin', 'acme', 'users', 'batch'] })
    await waitFor(() => expect(fn).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(result.current.of('u-ada')).toMatchObject({ state: 'found', user: { displayName: 'Ada King' } }))
  })

  it('answers "unavailable" for every ID when the lookup fails', async () => {
    const userProfile = partial<UserProfilePort>('userProfile', { batch: rs.fn(async () => { throw problem(503, 'USER_PROFILE_UNAVAILABLE') }) })
    const h = setup({ services: { userProfile } })
    const { result } = renderHook(() => useUserProfiles(['u-ada']), { wrapper: h.wrapper })
    await waitFor(() => expect(result.current.of('u-ada')).toEqual({ state: 'unavailable' }))
  })

  it('looks up nothing for no IDs, ignores blanks, and de-duplicates', async () => {
    const fn = batch()
    const h = setup({ services: { userProfile: partial<UserProfilePort>('userProfile', { batch: fn }) } })
    const none = renderHook(() => useUserProfiles([]), { wrapper: h.wrapper })
    expect(none.result.current.loading).toBe(false)
    const some = renderHook(() => useUserProfiles(['', 'u-ada', 'u-ada']), { wrapper: h.wrapper })
    await waitFor(() => expect(some.result.current.loading).toBe(false))
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn.mock.calls[0]![0]).toEqual(['u-ada'])
  })
})

describe('useDepartmentDirectory', () => {
  it('names departments, labels levels, and reloads both', async () => {
    const org = partial<OrgMembershipPort>('orgMembership', { listDepartments: rs.fn(async () => departments), listRoleLabels: rs.fn(async () => roleLabels) })
    const h = setup({ services: { orgMembership: org } })
    const { result } = renderHook(() => useDepartmentDirectory(), { wrapper: h.wrapper })
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.nameOf('d-eng')).toBe('Engineering')
    expect(result.current.nameOf('d-none')).toBeUndefined()
    expect(result.current.levelLabel('approver')).toBe('Director')
    expect(result.current.failed).toBe(false)
    act(() => result.current.reload())
    await waitFor(() => expect(org.listDepartments).toHaveBeenCalledTimes(2))
    expect(org.listRoleLabels).toHaveBeenCalledTimes(2)
  })

  it('reports a failed department list', async () => {
    const org = partial<OrgMembershipPort>('orgMembership', { listDepartments: rs.fn(async () => { throw problem(503, 'DB_UNAVAILABLE') }), listRoleLabels: rs.fn(async () => roleLabels) })
    const h = setup({ services: { orgMembership: org } })
    const { result } = renderHook(() => useDepartmentDirectory(), { wrapper: h.wrapper })
    await waitFor(() => expect(result.current.failed).toBe(true))
    expect(result.current.departments).toEqual([])
  })
})

describe('useSessionRefresh (the SDK\'s useRefreshSessionContext)', () => {
  it('asks the shell to reload the session context, and never throws', async () => {
    const platform = startPlatform({ permissions: OWNER, context: { slug: 'acme', tenantId: 't-1' }, refreshContext: async () => true })
    const actual = await rs.importActual<typeof import('../../../src/presentation/features/session/useSessionRefresh')>('../../../src/presentation/features/session/useSessionRefresh')
    const { result } = renderHook(() => actual.useSessionRefresh(), { wrapper: platform.Wrapper })
    await expect(result.current()).resolves.toBeUndefined()
    expect(platform.contextRefreshes).toBe(1)
  })

  it('shares one load between callers at once (the SDK coalesces)', async () => {
    const platform = startPlatform({ permissions: OWNER, context: { slug: 'acme', tenantId: 't-1' }, refreshContext: () => new Promise((r) => setTimeout(() => r(true), 5)) })
    const actual = await rs.importActual<typeof import('../../../src/presentation/features/session/useSessionRefresh')>('../../../src/presentation/features/session/useSessionRefresh')
    const { result } = renderHook(() => actual.useSessionRefresh(), { wrapper: platform.Wrapper })
    await Promise.all([result.current(), result.current(), result.current()])
    expect(platform.contextRefreshes).toBe(1)
  })

  it('keeps the old hints and resolves when the shell\'s refresh fails or there is no refresh', async () => {
    const failing = startPlatform({ permissions: OWNER, context: { slug: 'acme', tenantId: 't-1' }, refreshContext: async () => { throw new Error('P-35 down') } })
    const actual = await rs.importActual<typeof import('../../../src/presentation/features/session/useSessionRefresh')>('../../../src/presentation/features/session/useSessionRefresh')
    const a = renderHook(() => actual.useSessionRefresh(), { wrapper: failing.Wrapper })
    await expect(a.result.current()).resolves.toBeUndefined()
    const none = startPlatform({ permissions: OWNER, context: { slug: 'acme', tenantId: 't-1' } })
    const b = renderHook(() => actual.useSessionRefresh(), { wrapper: none.Wrapper })
    await expect(b.result.current()).resolves.toBeUndefined()
    expect(none.contextRefreshes).toBe(0)
  })
})
