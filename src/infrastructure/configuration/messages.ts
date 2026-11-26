// This remote's message namespace for the SDK's i18n (`useT(APP_ID)`). English is the only catalog
// so far; t() falls back to it, then to the key, for any other locale the shell negotiates.
// Chrome is in locales/en.json; each screen adds locales/en/<screen>.json with keys prefixed by the screen.
import { registerNamespace } from '@bcbp-solutions-fzc-llc/frontend-sdk/i18n'
import { APP_ID } from '../../shared/constants/app'
import audit from './locales/en/audit.json'
import chrome from './locales/en.json'
import departments from './locales/en/departments.json'
import detail from './locales/en/detail.json'
import mappings from './locales/en/mappings.json'
import settings from './locales/en/settings.json'
import users from './locales/en/users.json'

/** The English catalog: chrome, then each screen's keys (prefixed by the screen). */
const en: Record<string, string> = { ...chrome, ...users, ...detail, ...departments, ...settings, ...audit, ...mappings }

/** Registers the catalogs with the SDK runtime (once per runtime; tests start a fresh one each). */
export function registerMessages(): void {
  registerNamespace(APP_ID, async (locale) => (locale.split('-')[0] === 'en' ? en : {}))
}

registerMessages()
