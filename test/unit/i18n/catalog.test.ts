// The English catalog (src/infrastructure/configuration/locales/en.json) against the source: every
// key the UI asks for exists, every key in the catalog is used, and every message formats through
// the SDK's ICU-lite t().
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { t } from '@bcbp-solutions-fzc-llc/frontend-sdk/i18n'
import { describe, expect, it } from '@rstest/core'
import { APP_ID } from '../../../src/shared/constants/app'

const SRC = resolve(__dirname, '../../../src')
const LOCALES = join(SRC, 'infrastructure/configuration/locales')

/** Every English file: the chrome's en.json and each screen's en/<screen>.json (keys prefixed by the screen). */
function catalogs(): Record<string, string> {
  const files = [join(LOCALES, 'en.json'), ...readdirSync(join(LOCALES, 'en')).filter((f) => f.endsWith('.json')).map((f) => join(LOCALES, 'en', f))]
  return Object.assign({}, ...files.map((f) => JSON.parse(readFileSync(f, 'utf8')) as Record<string, string>))
}
const catalog = catalogs()

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? sources(join(dir, d.name)) : /\.tsx?$/.test(d.name) ? [readFileSync(join(dir, d.name), 'utf8')] : [],
  )
}

const code = sources(SRC).join('\n')

/** Keys passed to t() as string literals. */
const literalKeys = new Set([...code.matchAll(/\bt\(\s*'([^']+)'/g)].map((m) => m[1]!))

describe('English catalog', () => {
  it('has every key the UI asks for', () => {
    expect([...literalKeys].filter((key) => !(key in catalog))).toEqual([])
  })

  it('has no key the source never names (as a literal, including keys held in lists)', () => {
    expect(Object.keys(catalog).filter((key) => !code.includes(`'${key}'`))).toEqual([])
  })

  it('formats every message through the SDK', () => {
    for (const key of Object.keys(catalog)) {
      const text = t(APP_ID, key, { count: 1, used: 1, licensed: 1, active: 1, pending: 1, email: 'e', date: 'd', name: 'n', level: 'l', department: 'd' })
      expect(text, key).not.toBe(key)
      expect(text.trim(), key).not.toBe('')
    }
  })
})

describe('English catalog files', () => {
  it('keeps each screen\'s keys under its own prefix, with no key in two files', () => {
    const dir = join(SRC, 'infrastructure/configuration/locales/en')
    const seen = new Map<string, string>()
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const prefixes = file.replace('.json', '')
      const keys = Object.keys(JSON.parse(readFileSync(join(dir, file), 'utf8')) as Record<string, string>)
      for (const key of keys) {
        const extra: Record<string, string[]> = { users: ['invite.', 'upgrade.'], detail: ['resolve.', 'confirm.'], departments: ['labels.'], audit: ['exports.'] }
        expect(key.startsWith(`${prefixes}.`) || (extra[prefixes] ?? []).some((p) => key.startsWith(p)), `${file}: ${key}`).toBe(true)
        expect(seen.has(key), `${key} is in ${seen.get(key)} and ${file}`).toBe(false)
        seen.set(key, file)
      }
    }
  })
})
