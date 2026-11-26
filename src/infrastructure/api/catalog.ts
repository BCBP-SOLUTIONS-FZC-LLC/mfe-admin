import type { CatalogPort } from '../../domain/repositories/CatalogPort'
import { toCatalog } from './mappers'
import { withSignal, type ApiScope } from './scope'

/** Catalog / Admin Config, read side: `GET /departments` (any member; not tenant-scoped). */
export function createCatalogAdapter(scope: ApiScope): CatalogPort {
  return {
    async listDepartments(signal) {
      const res = await scope.client.get('/v1/departments', withSignal(signal))
      return toCatalog(res.data)
    },
  }
}
