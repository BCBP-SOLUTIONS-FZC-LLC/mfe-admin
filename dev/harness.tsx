// DEV ONLY (npm run dev:harness): the admin remote without a shell or an IAM. It starts the SDK's test
// platform (a signed-in session with the permissions of the chosen role), answers /api/* from the
// same fake IAM the e2e tests use, and mounts the real App at /t/acme/admin/users. Nothing here is
// part of `npm run build`: rsbuild.config.ts adds this entry only when ADMIN_HARNESS=1.
//
// Query parameters (the toolbar sets them): role=owner|admin|member, readonly=1, seats=N,
// covering=u-bob (removing or demoting that member asks for a workflow resolution), large=1 (audit
// searches become export jobs), delay=ms (latency on every IAM call, default 150).
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist'
import '@fontsource-variable/inter'
import App from '../src/app/App'
import { storage } from '@bcbp-solutions-fzc-llc/frontend-sdk/storage'
import { createFakeIamCore } from '../test/fixtures/fakeIamCore'
import { SAMPLE_EXPORT_IDS, seedSampleWorkspace } from './mock-iam/sampleData'
import { ADMIN, MEMBER, OWNER, startPlatform } from '../test/fixtures/platform'

const params = new URLSearchParams(window.location.search)
const ROLES = { owner: OWNER, admin: ADMIN, member: MEMBER } as const
const role = (params.get('role') ?? 'owner') as keyof typeof ROLES
const readOnly = params.get('readonly') === '1'
const delay = Number(params.get('delay') ?? 150)

const iam = createFakeIamCore()
// Every screen has data: the sample workspace the mock IAM serves (14 members, invitations, departments, mappings, audit, exports).
seedSampleWorkspace(iam)
const seats = Number(params.get('seats'))
if (seats > 0) iam.state.tenant['licensed_seats'] = seats
const covering = params.get('covering')
if (covering) iam.state.covering.add(covering)
if (params.get('large') === '1') iam.state.largeSearch = true

// IAM calls go to the fake; everything else (fonts, assets, runtime config) is the real network.
const realFetch = window.fetch.bind(window)
window.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input), window.location.href)
  if (!url.pathname.startsWith('/api/')) return realFetch(input, init)
  await new Promise((r) => setTimeout(r, delay))
  return iam.fetch(input, init)
}

const platform = startPlatform({
  permissions: ROLES[role] ?? OWNER,
  user: { id: role === 'owner' ? 'u-ada' : role === 'admin' ? 'u-bob' : 'u-cy', email: 'dev@example.com', displayName: `Dev ${role}` } as never,
  context: { slug: 'acme', tenantId: 'tenant-1', ...(readOnly ? { readOnly: true } : {}) },
})

storage('admin').set('auditExports', [...SAMPLE_EXPORT_IDS])

const bar = document.createElement('form')
bar.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:9999;display:flex;gap:8px;align-items:center;padding:6px 10px;font:12px system-ui;background:#111;color:#fff;border-radius:8px;opacity:.9'
bar.innerHTML = `<strong>harness</strong>
  <label>role <select name="role">${Object.keys(ROLES).map((r) => `<option ${r === role ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
  <label><input type="checkbox" name="readonly" value="1" ${readOnly ? 'checked' : ''}/> read-only</label>
  <label>seats <input name="seats" type="number" min="3" style="width:48px" value="${seats > 0 ? seats : ''}"/></label>
  <label>covering <input name="covering" style="width:56px" value="${covering ?? ''}"/></label>
  <label><input type="checkbox" name="large" value="1" ${params.get('large') === '1' ? 'checked' : ''}/> large audit</label>
  <button>apply</button>`
bar.addEventListener('submit', (e) => {
  e.preventDefault()
  const next = new URLSearchParams()
  for (const [k, v] of new FormData(bar)) if (typeof v === 'string' && v !== '') next.set(k, v)
  window.location.search = next.toString()
})

if (window.location.pathname === '/' || window.location.pathname === '/harness.html') window.history.replaceState({}, '', '/t/acme/admin/users' + window.location.search)
document.body.append(bar)
createRoot(document.getElementById('app')!).render(
  <platform.Wrapper>
    <App />
  </platform.Wrapper>,
)
