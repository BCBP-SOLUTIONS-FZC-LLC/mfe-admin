import type { CatalogDepartment } from '../entities/department'

/** Catalog / Admin Config (IAM), the read side: the department catalogue, cached for the session. */
export interface CatalogPort {
  /** `GET /departments` */
  listDepartments(signal?: AbortSignal): Promise<readonly CatalogDepartment[]>
}
