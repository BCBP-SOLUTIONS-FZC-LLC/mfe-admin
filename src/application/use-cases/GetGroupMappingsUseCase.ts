import type { GroupMappingPort } from '../../domain/repositories/GroupMappingPort'

/** GetGroupMappings: one operation of GroupMappingPort, called by the presentation layer's feature hooks. */
export class GetGroupMappingsUseCase {
  private readonly repository: Pick<GroupMappingPort, 'getAll'>

  constructor(repository: Pick<GroupMappingPort, 'getAll'>) {
    this.repository = repository
  }

  execute(...args: Parameters<GroupMappingPort['getAll']>): ReturnType<GroupMappingPort['getAll']> {
    return this.repository.getAll(...args)
  }
}
