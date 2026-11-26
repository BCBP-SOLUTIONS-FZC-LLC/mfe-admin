// DEV ONLY: a mock IAM for looking at the admin screens with data in the real web-shell. It answers
// what the shell would otherwise get from IAM: the workspace lookup (PUB-1), the session context (P-35)
// and the six services the admin remote calls (the fake IAM from test/fixtures, seeded with
// sampleData.ts). Point web-shell's dev server at it:
//
//   npm run dev:mock-iam                          (this server, http://localhost:5090)
//   DEV_API_URL=http://localhost:5090 npm run dev     (in web-shell)
//
// Environment: MOCK_IAM_PORT (5090), MOCK_IAM_DELAY_MS (120), MOCK_IAM_REALM (tenant-bcbp, the local
// Keycloak realm), MOCK_IAM_ROLES (member,tenant_owner; e.g. member,tenant_admin to see an admin).
import { createServer } from 'node:http'
import { createFakeIamCore } from '../../test/fixtures/fakeIamCore.ts'
import { seedSampleWorkspace } from './sampleData.ts'

const port = Number(process.env['MOCK_IAM_PORT'] ?? 5090)
const delay = Number(process.env['MOCK_IAM_DELAY_MS'] ?? 120)
const realm = process.env['MOCK_IAM_REALM'] ?? 'tenant-bcbp'
const roles = (process.env['MOCK_IAM_ROLES'] ?? 'member,tenant_owner').split(',')

const iam = createFakeIamCore()
seedSampleWorkspace(iam)

const json = (res: import('node:http').ServerResponse, status: number, body: unknown) => {
  res.statusCode = status
  res.setHeader('content-type', status >= 400 ? 'application/problem+json' : 'application/json')
  res.setHeader('cache-control', 'no-cache')
  res.end(JSON.stringify(body))
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`)
  try {
    // What web-shell's dev stub answers itself when no upstream is set; here the mock is the upstream.
    if (url.pathname === '/api/v1/public/tenants/resolve') {
      const identifier = (url.searchParams.get('identifier') ?? '').trim()
      return json(res, 200, identifier ? { found: true, realm, strategy: 'dedicated' } : { found: false })
    }
    if (url.pathname === '/api/v1/me/session-context') {
      if (!/^Bearer \S+/.test(req.headers.authorization ?? '')) return json(res, 401, { type: 'about:blank', title: 'Unauthorized', status: 401 })
      return json(res, 200, { tenant_id: 'tenant-1', slug: realm.replace(/^tenant-/, ''), roles, feature_flags: [], read_only: false })
    }
    const chunks: Buffer[] = []
    for await (const c of req) chunks.push(c as Buffer)
    const body = chunks.length ? Buffer.concat(chunks) : undefined
    await new Promise((r) => setTimeout(r, delay))
    const response = await iam.fetch(new Request(url, { method: req.method ?? 'GET', headers: req.headers as Record<string, string>, ...(body && req.method !== 'GET' ? { body } : {}) }))
    res.statusCode = response.status
    response.headers.forEach((v, k) => res.setHeader(k, v))
    res.end(Buffer.from(await response.arrayBuffer()))
  } catch (e) {
    json(res, 503, { type: 'about:blank', title: 'Mock IAM error', status: 503, detail: String(e) })
  }
}).listen(port, () => console.log(`mock IAM on http://localhost:${port} (realm ${realm}, roles ${roles.join(',')}, ${iam.state.members.length} members)`))
