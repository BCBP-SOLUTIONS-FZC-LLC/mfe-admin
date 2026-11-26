// Renders a screen as it runs in the shell: the SDK test platform (session context, permissions),
// the services (fake ports, recording telemetry) and a QueryClient, inside a router at /admin/….
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import type { AdminServices } from '../../src/presentation/features/services'
import { OWNER, startPlatform } from './platform'
import { withServices } from './services'

export function renderPage(
  ui: ReactElement,
  o: {
    permissions?: readonly `${string}:${string}`[]
    readOnly?: boolean
    services?: Partial<AdminServices>
    path?: string
    /** The signed-in user (an old `authTime` with `mfeWindowSeconds` makes a step-up needed). */
    user?: Parameters<typeof startPlatform>[0] extends infer P ? (P extends { user?: infer U } ? U : never) : never
    mfeWindowSeconds?: number
  } = {},
) {
  const platform = startPlatform({
    permissions: o.permissions ?? OWNER,
    ...(o.user ? { user: o.user } : {}),
    context: { slug: 'acme', tenantId: 'tenant-1', ...(o.readOnly ? { readOnly: true } : {}), ...(o.mfeWindowSeconds ? { mfaFreshnessSeconds: o.mfeWindowSeconds } : {}) },
  })
  const harness = withServices(o.services)
  const view = render(
    <platform.Wrapper>
      <harness.Wrapper>
        <MemoryRouter initialEntries={[o.path ?? '/admin/users']}>{ui}</MemoryRouter>
      </harness.Wrapper>
    </platform.Wrapper>,
  )
  return { ...view, ...harness, platform }
}
