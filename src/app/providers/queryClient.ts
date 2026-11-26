// One QueryClient per mount of ./App, never at module level (ADR 0001). HTTP stays in the SDK
// ApiClient (which already retries safe calls with Retry-After); TanStack Query owns caching,
// request de-duplication and invalidation. Queries retry only what isRetryableQueryError allows,
// twice at most; mutations are not retried. Refetch on focus is off: the permission hints are
// refreshed from the session context, not from every list.
import { QueryClient } from '@tanstack/react-query'
import { isRetryableQueryError } from '../../infrastructure/api/problem'

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: isRetryableQueryError,
        refetchOnWindowFocus: false,
        staleTime: 0,
      },
      mutations: { retry: false },
    },
  })
}
