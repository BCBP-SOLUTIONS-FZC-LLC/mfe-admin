// The export job list in the SDK's per-app storage (namespaced per workspace and cleared on sign-out
// or workspace switch; nothing is written before sign-in). IDs only: no tokens, no user data.
import { storage } from '@bcbp-solutions-fzc-llc/frontend-sdk/storage'
import type { ExportJobStore } from '../../application/ports/exportJobs'
import { APP_ID } from '../../shared/constants/app'

const KEY = 'auditExports'
/** An export is retrievable for 7 days; a handful is more than anyone follows at once. */
export const MAX_TRACKED_EXPORTS = 20

export function createExportJobStore(): ExportJobStore {
  const read = (): string[] => {
    const v = storage(APP_ID).get<unknown>(KEY)
    return Array.isArray(v) ? v.filter((id): id is string => typeof id === 'string') : []
  }
  return {
    list: read,
    add(exportId) {
      storage(APP_ID).set(KEY, [exportId, ...read().filter((id) => id !== exportId)].slice(0, MAX_TRACKED_EXPORTS))
    },
    remove(exportId) {
      storage(APP_ID).set(KEY, read().filter((id) => id !== exportId))
    },
  }
}
