// The implementations the screens use, injected by the composition root (app/providers): a test
// supplies its own. Presentation never imports infrastructure (ADR in LLD §3); this is the seam.
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { createUseCases, type AdminUseCases } from '../../application/use-cases'
import type { AdminNavigation } from '../../application/ports/navigation'
import type { ExportJobStore } from '../../application/ports/exportJobs'
import type { ProblemReader } from '../../application/ports/problems'
import type { AdminTelemetry } from '../../application/ports/telemetry'
import type { AuditPort } from '../../domain/repositories/AuditPort'
import type { CatalogPort } from '../../domain/repositories/CatalogPort'
import type { DelegationPolicyPort } from '../../domain/repositories/DelegationPolicyPort'
import type { GroupMappingPort } from '../../domain/repositories/GroupMappingPort'
import type { OrgMembershipPort } from '../../domain/repositories/OrgMembershipPort'
import type { UserProfilePort } from '../../domain/repositories/UserProfilePort'

/**
 * One port per IAM service plus telemetry. There is no WorkflowImpactPort: E2a step 1 is not in this
 * release (LLD §15 #3), so no adapter is wired.
 */
export interface AdminServices {
  readonly telemetry: AdminTelemetry
  readonly navigation: AdminNavigation
  readonly problems: ProblemReader
  readonly exportJobs: ExportJobStore
  readonly orgMembership: OrgMembershipPort
  readonly userProfile: UserProfilePort
  readonly catalog: CatalogPort
  readonly groupMapping: GroupMappingPort
  readonly audit: AuditPort
  readonly delegationPolicy: DelegationPolicyPort
}

const ServicesContext = createContext<AdminServices | undefined>(undefined)

export function AdminServicesProvider({ value, children }: { value: AdminServices; children: ReactNode }) {
  return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>
}

/** The services an outer provider (a test) supplied, or undefined: the composition root then uses its own. */
export function useProvidedServices(): AdminServices | undefined {
  return useContext(ServicesContext)
}

export function useAdminServices(): AdminServices {
  const services = useContext(ServicesContext)
  if (!services) throw new Error('useAdminServices needs an AdminServicesProvider')
  return services
}

/** The application layer's use cases, built over the injected ports (one set per provided services object). */
export function useAdminUseCases(): AdminUseCases {
  const { orgMembership, userProfile, catalog, groupMapping, audit, delegationPolicy } = useAdminServices()
  return useMemo(
    () => createUseCases({ orgMembership, userProfile, catalog, groupMapping, audit, delegationPolicy }),
    [orgMembership, userProfile, catalog, groupMapping, audit, delegationPolicy],
  )
}
