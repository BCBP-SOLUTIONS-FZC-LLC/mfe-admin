// User Profile over the SDK ApiClient. Names come from here, membership from Org & Membership
// (IAM-UX-4). The Swagger's path is `/users:batch`; see the note on BATCH_PARAMS below.
import type { UserProfilePort } from '../../domain/repositories/UserProfilePort'
import { toUser, toUserBatch, toUserEditBody } from './mappers'
import { withSignal, type ApiScope } from './scope'

/**
 * The SDK's route-template parser reads any `:name` as a path parameter, so `/users:batch` (a
 * Google-style custom method) is parsed as the template `/users` plus a parameter `:batch`, and the
 * client then refuses the call unless `batch` is passed. Passing the literal `:batch` as that
 * parameter sends `/api/v1/users%3Abatch`; a server that decodes the path before routing (Gin does
 * by default) serves it. If the gateway or service does not, the fix is in the SDK: only treat a
 * `:name` at the start of a path segment as a parameter. LLD §15 #18.
 */
const BATCH_PARAMS = { batch: ':batch' } as const

export function createUserProfileAdapter(scope: ApiScope): UserProfilePort {
  const { client } = scope
  const sig = withSignal
  return {
    async batch(ids, signal) {
      const res = await client.post('/v1/users:batch', { params: BATCH_PARAMS, body: { ids: [...ids] }, ...sig(signal) })
      return toUserBatch(res.data)
    },
    async getUser(userId, signal) {
      const res = await client.get('/v1/users/:id', { params: { id: userId }, ...sig(signal) })
      return toUser(res.data)
    },
    async updateUser(userId, edit, signal) {
      const res = await client.patch('/v1/users/:id', { params: { id: userId }, body: toUserEditBody(edit), ...sig(signal) })
      return toUser(res.data)
    },
  }
}
