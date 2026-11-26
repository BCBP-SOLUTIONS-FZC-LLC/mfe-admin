// Group Mapping. Its Swagger has basePath `/` and paths that already start with /api/v1, so the
// template is /v1/… here like every other adapter: the client's /api prefix makes the same URL.
import type { GroupMappingPort } from '../../domain/repositories/GroupMappingPort'
import {
  toDepartmentMappings,
  toDepartmentMappingsBody,
  toLevelMappings,
  toLevelMappingsBody,
  toTenantRoleMappings,
  toTenantRoleMappingsBody,
} from './mappers'
import { requireTenant, withSignal, type ApiScope } from './scope'

export function createGroupMappingAdapter(scope: ApiScope): GroupMappingPort {
  const { client } = scope
  const id = () => requireTenant(scope)
  const sig = withSignal
  return {
    async getAll(signal) {
      const params = { id: id() }
      // Three independent reads; any one failing rejects the whole screen's load.
      const [departments, levels, tenantRoles] = await Promise.all([
        client.get('/v1/tenants/:id/group-mappings/departments', { params, ...sig(signal) }),
        client.get('/v1/tenants/:id/group-mappings/department-roles', { params, ...sig(signal) }),
        client.get('/v1/tenants/:id/group-mappings/tenant-roles', { params, ...sig(signal) }),
      ])
      return { departments: toDepartmentMappings(departments.data), levels: toLevelMappings(levels.data), tenantRoles: toTenantRoleMappings(tenantRoles.data) }
    },
    async putDepartments(mappings, signal) {
      const res = await client.put('/v1/tenants/:id/group-mappings/departments', { params: { id: id() }, body: toDepartmentMappingsBody(mappings), ...sig(signal) })
      return toDepartmentMappings(res.data)
    },
    async putLevels(mappings, signal) {
      const res = await client.put('/v1/tenants/:id/group-mappings/department-roles', { params: { id: id() }, body: toLevelMappingsBody(mappings), ...sig(signal) })
      return toLevelMappings(res.data)
    },
    async putTenantRoles(mappings, signal) {
      const res = await client.put('/v1/tenants/:id/group-mappings/tenant-roles', { params: { id: id() }, body: toTenantRoleMappingsBody(mappings), ...sig(signal) })
      return toTenantRoleMappings(res.data)
    },
  }
}
