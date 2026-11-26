import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import App, { workspaceBasename } from '../../../src/app/App'
import { startPlatform } from '../../fixtures/platform'

// The pages ask IAM for their data; here every list is empty, so no real request is made.
beforeEach(() => {
  rs.stubGlobal('fetch', async () => Response.json({ items: [] }))
})
afterEach(() => {
  rs.unstubAllGlobals()
})

describe('workspaceBasename (as web-shell computes its basename)', () => {
  it.each([
    ['/admin', ''],
    ['/admin/users', ''],
    ['/t/acme/admin', '/t/acme'],
    ['/t/acme/admin/users/123', '/t/acme'],
    ['/', ''],
  ])('%s → %j', (path, basename) => {
    expect(workspaceBasename(path)).toBe(basename)
  })

  it('is empty without runtime config (standalone)', async () => {
    rs.resetModules()
    rs.doMock('@bcbp-solutions-fzc-llc/frontend-sdk/config', () => ({ tryGetConfig: () => undefined }))
    const standalone = await import('../../../src/app/App')
    expect(standalone.workspaceBasename('/t/acme/admin')).toBe('')
    rs.doUnmock('@bcbp-solutions-fzc-llc/frontend-sdk/config')
  })
})

describe('App inside the shell', () => {
  it('routes under the workspace prefix with its own router', async () => {
    const platform = startPlatform()
    window.history.replaceState({}, '', '/t/acme/admin/departments')
    render(<App />, { wrapper: platform.Wrapper })
    expect(await screen.findByRole('heading', { name: 'Departments and role labels' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/t/acme/admin/departments')
  })

  it('sends the admin root to the users list', async () => {
    const platform = startPlatform()
    window.history.replaceState({}, '', '/t/acme/admin')
    render(<App />, { wrapper: platform.Wrapper })
    expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/t/acme/admin/users')
  })

  it('sends a path outside /admin (standalone) to the users list', async () => {
    const platform = startPlatform()
    window.history.replaceState({}, '', '/something-else')
    render(<App />, { wrapper: platform.Wrapper })
    expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/admin/users')
  })
})

describe('App under a host router', () => {
  it('uses the host router and its routes as they are (no second router)', async () => {
    const platform = startPlatform()
    render(
      <MemoryRouter initialEntries={['/host/settings']}>
        <Routes>
          <Route path="/host/*" element={<App />} />
        </Routes>
      </MemoryRouter>,
      { wrapper: platform.Wrapper },
    )
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument()
  })
})
