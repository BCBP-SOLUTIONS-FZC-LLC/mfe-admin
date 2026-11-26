import type { GroupMappingPort } from '../../domain/repositories/GroupMappingPort'

/** PutDepartmentMappings: one operation of GroupMappingPort, called by the presentation layer's feature hooks. */
export class PutDepartmentMappingsUseCase {
  private readonly repository: Pick<GroupMappingPort, 'putDepartments'>

  constructor(repository: Pick<GroupMappingPort, 'putDepartments'>) {
    this.repository = repository
  }

  execute(...args: Parameters<GroupMappingPort['putDepartments']>): ReturnType<GroupMappingPort['putDepartments']> {
    return this.repository.putDepartments(...args)
  }
}
