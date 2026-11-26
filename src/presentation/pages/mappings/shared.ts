// What the two mapping tables share: the plain-words message for each refusal the rules can give.
import type { GroupMappingFailure } from '../../../domain/rules/admin-rules'

export const MAPPING_FAILURE_KEYS = {
  'too-many-mappings': 'mappings.error.tooMany',
  'group-required': 'mappings.error.groupRequired',
  'group-too-long': 'mappings.error.groupLong',
  'duplicate-group': 'mappings.error.duplicate',
  'invalid-level': 'mappings.error.level',
  'role-not-allowed': 'mappings.error.role',
  'owner-mapping-owner-only': 'mappings.error.owner',
} as const satisfies Record<GroupMappingFailure, string>

let next = 0
/** A key for a row that has no ID of its own yet. */
export const rowKey = () => `row-${next++}`
