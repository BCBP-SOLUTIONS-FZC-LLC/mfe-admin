import type { GroupMappingPort } from '../../domain/repositories/GroupMappingPort'

/** PutLevelMappings: one operation of GroupMappingPort, called by the presentation layer's feature hooks. */
export class PutLevelMappingsUseCase {
  private readonly repository: Pick<GroupMappingPort, 'putLevels'>

  constructor(repository: Pick<GroupMappingPort, 'putLevels'>) {
    this.repository = repository
  }

  execute(...args: Parameters<GroupMappingPort['putLevels']>): ReturnType<GroupMappingPort['putLevels']> {
    return this.repository.putLevels(...args)
  }
}
