// The fake IAM for tests: the HTTP-level core (fakeIamCore.ts, also served by the dev harness) plus
// `install`, which replaces fetch through rstest so `rs.unstubAllGlobals()` puts it back.
import { rs } from '@rstest/core'
import { createFakeIamCore } from './fakeIamCore'

export type { Call, FakeMember, FakeProfile } from './fakeIamCore'

export function createFakeIam() {
  const core = createFakeIamCore()
  return {
    ...core,
    /** Replaces fetch with this fake. */
    install: () => rs.stubGlobal('fetch', core.fetch),
  }
}

export type FakeIam = ReturnType<typeof createFakeIam>
