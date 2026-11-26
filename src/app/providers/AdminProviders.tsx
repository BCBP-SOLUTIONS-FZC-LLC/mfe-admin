// The mount's providers: one QueryClient (cleared on unmount) and the services (the HTTP adapters for
// the mount's workspace), unless an outer provider (a test) supplies its own services.
import { QueryClientProvider } from '@tanstack/react-query'
import { useSessionContext } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AdminServicesProvider, useProvidedServices } from '../../presentation/features/services'
import { useWorkspacePrefix } from '../../infrastructure/federation/navigation'
import { createAdminServices } from './composition'
import { createQueryClient } from './queryClient'

export default function AdminProviders({ children }: { children: ReactNode }) {
  const provided = useProvidedServices()
  // The adapters are stateless, so they are made again when the tenant ID arrives (the session
  // context loads after the first render). A workspace switch remounts the remote.
  const tenantId = useSessionContext()?.tenantId
  const workspacePrefix = useWorkspacePrefix()
  const own = useMemo(() => createAdminServices({ tenantId: () => tenantId, workspacePrefix }), [tenantId, workspacePrefix])
  const [client] = useState(createQueryClient)
  useEffect(() => () => client.clear(), [client])
  return (
    <QueryClientProvider client={client}>
      <AdminServicesProvider value={provided ?? own}>{children}</AdminServicesProvider>
    </QueryClientProvider>
  )
}
