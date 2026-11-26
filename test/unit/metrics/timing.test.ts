// What the telemetry adapter hands the SDK's instruments: the counts, the labels and the elapsed
// seconds, with a clock the test controls. (The SDK's own bucketing is its tests' concern.)
import { describe, expect, it, rs } from '@rstest/core'

const counters = new Map<string, { add: ReturnType<typeof rs.fn> }>()
const histograms = new Map<string, { record: ReturnType<typeof rs.fn> }>()

rs.mock('@bcbp-solutions-fzc-llc/frontend-sdk/metrics', () => ({
  getServiceMeter: () => ({
    counter: (name: string) => {
      if (!counters.has(name)) counters.set(name, { add: rs.fn() })
      return counters.get(name)
    },
    histogram: (name: string) => {
      if (!histograms.has(name)) histograms.set(name, { record: rs.fn() })
      return histograms.get(name)
    },
  }),
}))

const { createMetricsTelemetry } = await import('../../../src/infrastructure/telemetry/metrics')

describe('createMetricsTelemetry', () => {
  it('records a load as one count and its elapsed seconds, with the same labels', () => {
    let now = 1000
    const telemetry = createMetricsTelemetry(() => now)
    const load = telemetry.loadStarted('settings')
    now = 1500
    load.finish('success')
    expect(counters.get('iam_admin_loads_total')!.add).toHaveBeenCalledWith(1, { resource: 'settings', outcome: 'success' })
    expect(histograms.get('iam_admin_load_duration_seconds')!.record).toHaveBeenCalledWith(0.5, { resource: 'settings', outcome: 'success' })
  })

  it('records a write\'s seconds with its outcome', () => {
    let now = 0
    const telemetry = createMetricsTelemetry(() => now)
    const action = telemetry.actionStarted('invite')
    now = 2250
    action.finish('failure')
    expect(counters.get('iam_admin_actions_total')!.add).toHaveBeenCalledWith(1, { action: 'invite', outcome: 'failure' })
    expect(histograms.get('iam_admin_action_duration_seconds')!.record).toHaveBeenCalledWith(2.25, { action: 'invite', outcome: 'failure' })
  })

  it('never records a negative duration (a clock that steps back)', () => {
    let now = 5000
    const telemetry = createMetricsTelemetry(() => now)
    const load = telemetry.loadStarted('members')
    now = 4000
    load.finish('error')
    expect(histograms.get('iam_admin_load_duration_seconds')!.record).toHaveBeenLastCalledWith(0, { resource: 'members', outcome: 'error' })
  })
})
