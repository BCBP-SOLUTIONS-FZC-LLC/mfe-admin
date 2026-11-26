import type { CatalogPort } from '../../domain/repositories/CatalogPort'

/** ListCatalogDepartments: one operation of CatalogPort, called by the presentation layer's feature hooks. */
export class ListCatalogDepartmentsUseCase {
  private readonly repository: Pick<CatalogPort, 'listDepartments'>

  constructor(repository: Pick<CatalogPort, 'listDepartments'>) {
    this.repository = repository
  }

  execute(...args: Parameters<CatalogPort['listDepartments']>): ReturnType<CatalogPort['listDepartments']> {
    return this.repository.listDepartments(...args)
  }
}
