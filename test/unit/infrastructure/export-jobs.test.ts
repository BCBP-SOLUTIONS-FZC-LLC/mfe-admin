// The export job list in the SDK's per-app storage: IDs only, newest first, de-duplicated, capped.
import { storage } from '@bcbp-solutions-fzc-llc/frontend-sdk/storage'
import { describe, expect, it } from '@rstest/core'
import { MAX_TRACKED_EXPORTS, createExportJobStore } from '../../../src/infrastructure/storage/exportJobs'
import { APP_ID } from '../../../src/shared/constants/app'
import { startPlatform } from '../../fixtures/platform'

describe('export job store', () => {
  it('starts empty, and lists newest first', () => {
    startPlatform()
    const store = createExportJobStore()
    expect(store.list()).toEqual([])
    store.add('a')
    store.add('b')
    expect(store.list()).toEqual(['b', 'a'])
  })

  it('moves an export tracked again to the front, once', () => {
    startPlatform()
    const store = createExportJobStore()
    store.add('a')
    store.add('b')
    store.add('a')
    expect(store.list()).toEqual(['a', 'b'])
  })

  it('removes one export, and nothing else', () => {
    startPlatform()
    const store = createExportJobStore()
    store.add('a')
    store.add('b')
    store.remove('a')
    expect(store.list()).toEqual(['b'])
    store.remove('missing')
    expect(store.list()).toEqual(['b'])
  })

  it('keeps only the newest few', () => {
    startPlatform()
    const store = createExportJobStore()
    for (let i = 0; i < MAX_TRACKED_EXPORTS + 5; i++) store.add(`ex-${i}`)
    expect(store.list()).toHaveLength(MAX_TRACKED_EXPORTS)
    expect(store.list()[0]).toBe(`ex-${MAX_TRACKED_EXPORTS + 4}`)
  })

  it('ignores a stored value that is not a list of strings', () => {
    startPlatform()
    storage(APP_ID).set('auditExports', { not: 'a list' })
    expect(createExportJobStore().list()).toEqual([])
    storage(APP_ID).set('auditExports', ['ok', 7, null, 'also'])
    expect(createExportJobStore().list()).toEqual(['ok', 'also'])
  })

  it('stores IDs only, under this app\'s own namespace', () => {
    startPlatform()
    createExportJobStore().add('ex-1')
    expect(storage(APP_ID).get('auditExports')).toEqual(['ex-1'])
  })
})
