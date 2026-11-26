// Audit Log. The tenant comes from the gateway-injected identity, so no tenant ID is in these paths.
import type { AuditPort } from '../../domain/repositories/AuditPort'
import { toAuditEntry, toAuditExport, toAuditExportAccepted, toAuditExportBody, toAuditPage, toAuditQuery } from './mappers'
import { withSignal, type ApiScope } from './scope'

export function createAuditAdapter(scope: ApiScope): AuditPort {
  const { client } = scope
  const sig = withSignal
  return {
    async search(filter, page, signal) {
      const res = await client.get('/v1/audit/events', { query: toAuditQuery(filter, page.limit, page.cursor), ...sig(signal) })
      // 202: a large search answers an export job instead of results.
      return res.status === 202 ? { kind: 'export', job: toAuditExportAccepted(res.data) } : { kind: 'page', page: toAuditPage(res.data) }
    },
    async getEntry(id, signal) {
      const res = await client.get('/v1/audit/events/:id', { params: { id }, ...sig(signal) })
      return toAuditEntry(res.data)
    },
    async requestExport(filter, signal) {
      const res = await client.post('/v1/audit/exports', { body: toAuditExportBody(filter), ...sig(signal) })
      return toAuditExportAccepted(res.data)
    },
    async getExport(exportId, signal) {
      const res = await client.get('/v1/audit/exports/:id', { params: { id: exportId }, ...sig(signal) })
      return toAuditExport(res.data)
    },
  }
}
