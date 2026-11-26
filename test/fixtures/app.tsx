// Opens the whole App (its own router, real adapters) at a workspace path, as web-shell mounts it.
import { render } from '@testing-library/react'
import App from '../../src/app/App'
import { OWNER, startPlatform } from './platform'

type Options = {
  permissions?: readonly `${string}:${string}`[]
  readOnly?: boolean
  user?: Parameters<typeof startPlatform>[0] extends infer P ? (P extends { user?: infer U } ? U : never) : never
  mfaWindow?: number
}

export function openApp(path = '/t/acme/admin/users', o: Options = {}) {
  const platform = startPlatform({
    permissions: o.permissions ?? OWNER,
    ...(o.user ? { user: o.user } : {}),
    context: { slug: 'acme', tenantId: 'tenant-1', ...(o.readOnly ? { readOnly: true } : {}), ...(o.mfaWindow ? { mfaFreshnessSeconds: o.mfaWindow } : {}) },
  })
  window.history.replaceState({}, '', path)
  return render(<App />, { wrapper: platform.Wrapper })
}
