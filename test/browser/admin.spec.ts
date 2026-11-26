// The production build of the standalone page in a real browser, under the image's CSP. With no shell
// around it there is no identity, so every section is "not permitted": what this proves is what only a
// browser can: the page loads with nothing refused by the CSP, the base styles meet colour contrast in
// the light and dark themes (axe cannot compute contrast without layout), nested routes reload, and
// the page passes WCAG 2.1 A and AA. The flows behind a session are in test/e2e (jsdom, a fake IAM)
// and the screens' accessibility in test/unit/a11y; the full path through web-shell is the joint
// suite LLD §15 #10 asks for.
import { expect, test } from '@playwright/test'
import { wcagViolations } from './axe'

test.beforeEach(async ({ page }) => {
  // Collect what the browser itself reports as refused by the Content Security Policy.
  await page.addInitScript(() => {
    ;(window as unknown as { __csp: string[] }).__csp = []
    document.addEventListener('securitypolicyviolation', (e) => (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`))
  })
})

const csp = (page: import('@playwright/test').Page) => page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)

test('loads at /admin/users and says the section is not permitted', async ({ page }) => {
  const problems: string[] = []
  page.on('pageerror', (e) => problems.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && problems.push(m.text()))
  const failed: string[] = []
  page.on('requestfailed', (r) => failed.push(r.url()))

  await page.goto('/')
  await expect(page).toHaveURL(/\/admin\/users$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveText("You don't have access to this section.")
  // No identity: nothing from IAM is asked for, and the remote draws no navigation or frame (the shell's sidebar does).
  await expect(page.getByRole('navigation')).toHaveCount(0)
  expect(await csp(page)).toEqual([])
  expect(failed).toEqual([])
  expect(problems).toEqual([])
})

test('reads its runtime configuration and serves the remote entry', async ({ page, request }) => {
  const [config] = await Promise.all([page.waitForResponse((r) => r.url().endsWith('/config/runtime.json')), page.goto('/')])
  expect(config.status()).toBe(200)
  const entry = await request.get('/remoteEntry.js')
  expect(entry.status()).toBe(200)
  expect((await entry.text()).startsWith('var __platform_mfe_admin;')).toBe(true)
})

test('reloads a nested route, and sends an unknown path to the users list', async ({ page }) => {
  await page.goto('/admin/users/abc')
  await expect(page.getByRole('alert')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('alert')).toBeVisible()
  expect(await csp(page)).toEqual([])
  await page.goto('/nowhere/at/all')
  await expect(page).toHaveURL(/\/admin\/users$/)
})

for (const scheme of ['light', 'dark'] as const) {
  test(`has no WCAG 2.1 A or AA violation, colour contrast included, in the ${scheme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/')
    await expect(page.getByRole('alert')).toBeVisible()
    expect(await wcagViolations(page)).toEqual([])
  })
}

test('is usable at a narrow width: nothing scrolls sideways and the remote draws no frame', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 700 })
  await page.goto('/')
  await expect(page.getByRole('alert')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
  // The frame and the Admin sub-menu are the shell's; standalone the page is just the outlet.
  await expect(page.getByRole('navigation')).toHaveCount(0)
  await expect(page.getByRole('banner')).toHaveCount(0)
})
