// The one place that decides which implementation backs each port: the HTTP adapters on the SDK
// ApiClient, and the metrics telemetry. A test supplies its own services through AdminServicesProvider.
import { createApiClient, type ApiClient } from '@bcbp-solutions-fzc-llc/frontend-sdk/http'
import type { AdminServices } from '../../presentation/features/services'
import { createAuditAdapter } from '../../infrastructure/api/audit'
import { createCatalogAdapter } from '../../infrastructure/api/catalog'
import { createDelegationPolicyAdapter } from '../../infrastructure/api/delegationPolicy'
import { createGroupMappingAdapter } from '../../infrastructure/api/groupMapping'
import { createOrgMembershipAdapter } from '../../infrastructure/api/orgMembership'
import { createUserProfileAdapter } from '../../infrastructure/api/userProfile'
import { problemReader } from '../../infrastructure/api/problem'
import { createNavigation } from '../../infrastructure/federation/navigation'
import { createExportJobStore } from '../../infrastructure/storage/exportJobs'
import type { ApiScope } from '../../infrastructure/api/scope'
import { metricsTelemetry } from '../../infrastructure/telemetry/metrics'
import { APP_ID } from '../../shared/constants/app'

/**
 * An ApiClient made on first use: createApiClient reads the runtime config, which the shell (or the
 * standalone start-up) loads before the first call, not before this module is imported.
 */
export function lazyApiClient(make: () => ApiClient = () => createApiClient({ mfe: APP_ID })): ApiClient {
  let client: ApiClient | undefined
  const real = () => (client ??= make())
  return {
    get: (template, o) => real().get(template, o),
    post: (template, o) => real().post(template, o),
    put: (template, o) => real().put(template, o),
    patch: (template, o) => real().patch(template, o),
    delete: (template, o) => real().delete(template, o),
  }
}

export interface CompositionOptions {
  /** The workspace's tenant ID from the session context, read at each call (undefined until it has loaded). */
  readonly tenantId: () => string | undefined
  readonly client?: ApiClient
  /** The workspace's route prefix (for example `/t/acme`), '' when there is none. */
  readonly workspacePrefix?: string
}

export function createAdminServices(o: CompositionOptions = { tenantId: () => undefined }): AdminServices {
  const scope: ApiScope = { client: o.client ?? lazyApiClient(), tenantId: o.tenantId }
  return {
    telemetry: metricsTelemetry,
    navigation: createNavigation(o.workspacePrefix ?? ''),
    problems: problemReader,
    exportJobs: createExportJobStore(),
    orgMembership: createOrgMembershipAdapter(scope),
    userProfile: createUserProfileAdapter(scope),
    catalog: createCatalogAdapter(scope),
    groupMapping: createGroupMappingAdapter(scope),
    audit: createAuditAdapter(scope),
    delegationPolicy: createDelegationPolicyAdapter(scope),
  }
}
