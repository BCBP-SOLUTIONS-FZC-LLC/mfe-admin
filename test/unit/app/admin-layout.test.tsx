// The admin area's chrome: the page outlet only (the shell draws the frame and the sub-menu; LLD §2.1, §7.12), routes
// under /admin, and an unknown path returns to the users list.
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from '@rstest/core'
import { AdminRoutes } from '../../../src/app/routes'
import { MEMBER, startPlatform } from '../../fixtures/platform'
import { withServices } from '../../fixtures/services'

function renderAt(path: string, o: Parameters<typeof startPlatform>[0] = {}) {
  const platform = startPlatform({ context: { slug: 'acme', tenantId: 't-1' }, ...o })
  const services = withServices()
  return render(
    <platform.Wrapper>
      <services.Wrapper>
        <MemoryRouter initialEntries={[path]}>
          <AdminRoutes />
        </MemoryRouter>
      </services.Wrapper>
    </platform.Wrapper>,
  )
}

describe('AdminLayout', () => {
  it('draws no navigation, header, user menu, theme picker, sign-out or Dashboard link (web-shell owns the one sidebar and its Admin sub-menu)', async () => {
    renderAt('/users')
    await screen.findByRole('heading', { name: 'Users' })
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    for (const name of ['Choose theme', 'Logout']) expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument()
  })

  it('draws no SSO entry: E4 is wireframe-only this release (LLD §2.1)', async () => {
    renderAt('/users')
    await screen.findByRole('heading', { name: 'Users' })
    expect(screen.queryByRole('link', { name: /single sign-on|sso/i })).not.toBeInTheDocument()
  })

  it('sends the index and an unknown path to the users list', async () => {
    renderAt('/nope')
    expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument()
  })

  it('shows "not permitted" on a section the user may not open, without redirecting', async () => {
    renderAt('/audit', { permissions: MEMBER })
    expect(await screen.findByRole('alert')).toHaveTextContent("You don't have access to this section.")
    // The page keeps its title (a level-one heading) but shows nothing under it.
    expect(screen.getByRole('heading', { level: 1, name: 'Audit log' })).toBeInTheDocument()
  })
})
