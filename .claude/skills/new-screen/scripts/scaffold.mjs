// Scaffolds the files a new admin screen is made of, in this repository's conventions, and refuses to
// overwrite anything. It does not touch existing files: the wiring (route, access, ports, metrics, docs)
// is the checklist in SKILL.md, printed at the end.
//   node scaffold.mjs <PascalName> --prefix <key prefix> --resource <load resource>
// e.g. node scaffold.mjs Webhooks --prefix webhooks --resource webhooks
// The resource must already be in LOAD_RESOURCES (src/domain/events/admin-events.ts): it is a metric
// label with a closed value set, so it is added first, with its line in docs/observability/metrics.md.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const name = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'))
const prefix = flag('prefix')
const resource = flag('resource')
const fail = (m) => {
  console.error(`✗ ${m}`)
  process.exit(1)
}
if (!name || !/^[A-Z][A-Za-z0-9]*$/.test(name)) fail('usage: scaffold.mjs <PascalName> --prefix <prefix> --resource <resource>  (PascalName like Webhooks)')
if (!prefix || !/^[a-z][a-z0-9]*$/.test(prefix)) fail('--prefix must be one lower-case word (it names the locale file and prefixes every key)')
if (!resource || !/^[a-z][a-z0-9_]*$/.test(resource)) fail('--resource must be snake_case, a member of LOAD_RESOURCES')

const root = process.cwd()
const events = readFileSync(join(root, 'src/domain/events/admin-events.ts'), 'utf8')
const list = /LOAD_RESOURCES = \[([\s\S]*?)\] as const/.exec(events)?.[1] ?? ''
if (!new RegExp(`'${resource}'`).test(list)) {
  fail(`'${resource}' is not in LOAD_RESOURCES (src/domain/events/admin-events.ts). Add it first, with its row in docs/observability/metrics.md, then run this again.`)
}

const camel = name[0].toLowerCase() + name.slice(1)
const files = {
  [`src/presentation/pages/${name}Page.tsx`]: `// ${name}: <one line: what the screen is for, who may open it, which IAM service it reads> (LLD §7.x).
import { useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { APP_ID } from '../../shared/constants/app'
import LoadFailed from '../components/LoadFailed'
import { card, tdMessage } from '../components/styles'
import { use${name}List } from '../features/${prefix}/use${name}'

export default function ${name}Page() {
  const t = useT(APP_ID)
  const list = use${name}List()
  return (
    <section className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-aura-text">{t('${prefix}.title')}</h1>
        <p className="mt-1 text-sm text-aura-muted">{t('${prefix}.subtitle')}</p>
      </div>
      {list.isError && <LoadFailed message={t('${prefix}.failed')} error={list.error} onRetry={() => void list.refetch()} />}
      {list.isPending && <p className="text-aura-muted">{t('${prefix}.loading')}</p>}
      {list.data && (
        <div className={card}>
          {list.data.length === 0 ? (
            <p className={tdMessage}>{t('${prefix}.empty')}</p>
          ) : (
            <ul className="divide-y divide-aura-border">
              {list.data.map((item) => (
                <li key={item.id} className="px-4 py-3 text-sm text-aura-text">
                  {item.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
`,
  [`src/presentation/features/${prefix}/use${name}.ts`]: `// ${name}'s data (replace the stub with the use case: application/use-cases, over a port in
// domain/repositories, over an adapter in infrastructure/api, contract-tested against the pinned Swagger).
import { useTrackedQuery } from '../tracked'
import { useAdminKeys } from '../workspace'

/** TODO(new-screen): the domain entity the port returns replaces this. */
export interface ${name}Item {
  readonly id: string
  readonly name: string
}

export function use${name}List() {
  const { keys } = useAdminKeys()
  return useTrackedQuery({
    resource: '${resource}',
    // TODO(new-screen): add \`${camel}: () => of('${prefix}')\` to application/queries/keys.ts and use keys.${camel}().
    queryKey: [...keys.all, '${prefix}'],
    // TODO(new-screen): \`(signal) => useCases.<operation>.execute(signal)\` through useAdminUseCases().
    queryFn: async (): Promise<readonly ${name}Item[]> => [],
  })
}
`,
  [`src/infrastructure/configuration/locales/en/${prefix}.json`]: `{
  "${prefix}.title": "${name}",
  "${prefix}.subtitle": "TODO: one sentence on what this screen is for.",
  "${prefix}.loading": "Loading…",
  "${prefix}.failed": "${name} could not be loaded.",
  "${prefix}.empty": "Nothing here yet."
}
`,
  [`test/unit/pages/${prefix}-page.test.tsx`]: `// ${name} (LLD §7.x): the states a user can meet (loading, data, empty, failed) and who may open it.
import { screen } from '@testing-library/react'
import { describe, expect, it } from '@rstest/core'
import ${name}Page from '../../../src/presentation/pages/${name}Page'
import { renderPage } from '../../fixtures/pages'

const open = () => renderPage(<${name}Page />, { path: '/admin/${prefix}' })

describe('${name}', () => {
  it('shows the title and the empty state when there is nothing yet', async () => {
    open()
    expect(await screen.findByRole('heading', { level: 1, name: '${name}' })).toBeInTheDocument()
    expect(await screen.findByText('Nothing here yet.')).toBeInTheDocument()
  })

  // TODO(new-screen): wire the port with partial<…Port>() and add: rows listed with the fields the
  // screen shows; a failed load (an alert with Retry); a write: success, a 409 (Reload), a rejection;
  // read-only disables the control with its reason; a user without the permission gets "not permitted".
})
`,
}

for (const path of Object.keys(files)) if (existsSync(join(root, path))) fail(`${path} already exists; nothing was written`)
if (existsSync(join(root, `src/infrastructure/configuration/locales/en/${prefix}.json`))) fail(`the prefix "${prefix}" is already a locale file`)
for (const [path, body] of Object.entries(files)) {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), body)
  console.log(`+ ${path}`)
}
console.log(`
Still to do by hand (SKILL.md, steps 3 to 9): the port, use case, adapter, mapper and contract case; the
route and its access rule; messages.ts and the catalogue test's prefix list; the services provider and
test fixtures if there is a new port; the shell's Admin sub-menu (a handoff); the a11y case; docs and CHANGELOG.`)
