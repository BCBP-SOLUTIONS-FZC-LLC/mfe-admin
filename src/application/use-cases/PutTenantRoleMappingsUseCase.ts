import type { GroupMappingPort } from '../../domain/repositories/GroupMappingPort'

/** PutTenantRoleMappings: one operation of GroupMappingPort, called by the presentation layer's feature hooks. */
export class PutTenantRoleMappingsUseCase {
  private readonly repository: Pick<GroupMappingPort, 'putTenantRoles'>

  constructor(repository: Pick<GroupMappingPort, 'putTenantRoles'>) {
    this.repository = repository
  }

  execute(...args: Parameters<GroupMappingPort['putTenantRoles']>): ReturnType<GroupMappingPort['putTenantRoles']> {
    return this.repository.putTenantRoles(...args)
  }
}
