// The workspace a screen is showing: its slug keys every query (so a workspace switch cannot show
// another workspace's data, ADR 0001), and nothing is fetched until the session context has loaded.
import { useSessionContext } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { useMemo } from 'react'
import { adminKeys, type AdminKeys } from '../../application/queries/keys'

export function useAdminKeys(): { keys: AdminKeys; ready: boolean } {
  const slug = useSessionContext()?.slug
  return useMemo(() => ({ keys: adminKeys(slug ?? ''), ready: slug !== undefined && slug !== '' }), [slug])
}
