// The vendored Swagger files are what the contract tests trust: they must be exactly what PIN.json
// says, so a hand edit or a partial copy cannot make a wrong adapter pass. To follow IAM, read the
// diff (`npm run contracts:check`), update the adapters and fixtures, then `npm run contracts:pin`.
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@rstest/core'

const DIR = join(__dirname, 'swagger')
const pin = JSON.parse(readFileSync(join(DIR, 'PIN.json'), 'utf8')) as { pinnedOn: string; files: Record<string, string> }

describe('pinned IAM Swagger', () => {
  it('has exactly the six services this remote calls', () => {
    expect(Object.keys(pin.files).sort()).toEqual(
      ['iam-audit-log.yaml', 'iam-catalog-admin.yaml', 'iam-delegation.yaml', 'iam-group-mapping.yaml', 'iam-org-membership.yaml', 'iam-user-profile.yaml'],
    )
    expect(readdirSync(DIR).filter((f) => f.endsWith('.yaml')).sort()).toEqual(Object.keys(pin.files).sort())
  })

  it.each(Object.entries(pin.files))('%s matches its pinned SHA-256', (file, sha) => {
    expect(createHash('sha256').update(readFileSync(join(DIR, file))).digest('hex')).toBe(sha)
  })

  it('records when it was pinned', () => {
    expect(pin.pinnedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('known gaps in the pinned Swagger (a failure here means IAM fixed one: update the adapter notes and this test)', () => {
  const org = readFileSync(join(DIR, 'iam-org-membership.yaml'), 'utf8')

  it('the P-28 answer\'s roles enum omits tenant_owner, though the service can grant it', () => {
    const block = org.slice(org.indexOf('  http.RolesReconcileResponse:'), org.indexOf('  http.RolesReconcileResponse:') + 400)
    expect(block).toContain('tender_admin')
    expect(block).not.toContain('tenant_owner')
  })

  it('User Profile\'s UserResponse has no avatar field, though spec E1 shows one', () => {
    const profile = readFileSync(join(DIR, 'iam-user-profile.yaml'), 'utf8')
    const block = profile.slice(profile.indexOf('  http.UserResponse:'), profile.indexOf('  http.WritingTone:'))
    expect(block).not.toMatch(/avatar|photo|picture/i)
  })

  it('P-27 seat usage has no grace date or over-cap field (IAM-FE-Q3)', () => {
    const block = org.slice(org.indexOf('  http.SeatUsageResponse:'), org.indexOf('  http.SeatUsageResponse:') + 300)
    expect(block).not.toMatch(/grace|over_cap|overage/)
  })

  it('P-4 takes only limit and cursor: no search or filter (IAM-FE-Q5)', () => {
    const at = org.indexOf('  /tenants/{id}/members:')
    const get = org.slice(org.indexOf('    get:', at), org.indexOf('    post:', at))
    const names = [...get.matchAll(/name: (\w+)/g)].map((m) => m[1])
    expect(names.filter((n) => n !== 'id').sort()).toEqual(['cursor', 'limit'])
  })
})
