// E2a step 2: removing or demoting someone who is covering work for others is answered `409
// WORKFLOW_RESOLUTION_REQUIRED` with what is at stake. The admin chooses (hand the coverage to
// another member, or stop those workflows), the choice is sent (P-26), and the original call is
// re-sent automatically, once; IAM runs its check again. Step 1 (Workflow's own impact list) is not
// in this release, so this is the whole gate (LLD §7.4, §15 #3).
import { useCallback, useState } from 'react'
import type { ResolutionRequired } from '../../../application/ports/problems'
import { planResolution } from '../../../domain/rules/admin-rules'
import { useAdminServices } from '../services'
import { useResolveRemoval } from './useMemberDetail'

type Phase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'blocked'; readonly required: ResolutionRequired; readonly retry: () => Promise<void>; readonly onDone: (() => void) | undefined }

export interface ResolutionState {
  readonly open: boolean
  readonly required?: ResolutionRequired
  readonly busy: boolean
  /** A failure of the choice or of the re-sent call, to show in the dialog. */
  readonly error: unknown
  readonly choose: (choice: { action: 'replace_delegate' | 'stop_workflows'; replacementUserId?: string }) => Promise<void>
  readonly cancel: () => void
}

export interface Resolvable {
  /**
   * Runs `call`. A resolution request opens the dialog instead of failing and answers `blocked`;
   * `onDone` runs once the change has gone through, after the call or after the resolved re-send.
   * Rejects with any other error.
   */
  readonly run: (call: () => Promise<unknown>, onDone?: () => void) => Promise<'done' | 'blocked'>
  readonly resolution: ResolutionState
}

export function useResolvableAction(subjectUserId: string): Resolvable {
  const { problems } = useAdminServices()
  const resolve = useResolveRemoval(subjectUserId)
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [error, setError] = useState<unknown>()
  const [busy, setBusy] = useState(false)

  const run = useCallback(
    async (call: () => Promise<unknown>, onDone?: () => void) => {
      try {
        await call()
        onDone?.()
        return 'done' as const
      } catch (e) {
        const required = problems.resolutionRequired(e)
        if (!required) throw e
        setError(undefined)
        setPhase({ kind: 'blocked', required, retry: async () => void (await call()), onDone })
        return 'blocked' as const
      }
    },
    [problems],
  )

  const choose: ResolutionState['choose'] = async (choice) => {
    if (phase.kind !== 'blocked') return
    const plan = planResolution({ ...choice, subjectUserId })
    if (!plan.ok) {
      setError(new Error(plan.failure))
      return
    }
    setBusy(true)
    setError(undefined)
    try {
      await resolve.mutateAsync(plan.value)
      // IAM re-runs its check on the original call.
      await phase.retry()
      setPhase({ kind: 'idle' })
      phase.onDone?.()
    } catch (e) {
      // A second resolution request (more work appeared) keeps the dialog open with the new numbers.
      const again = problems.resolutionRequired(e)
      if (again && phase.kind === 'blocked') setPhase({ ...phase, required: again })
      else setError(e)
    } finally {
      setBusy(false)
    }
  }

  return {
    run,
    resolution: {
      open: phase.kind === 'blocked',
      ...(phase.kind === 'blocked' ? { required: phase.required } : {}),
      busy,
      error,
      choose,
      cancel: () => {
        setPhase({ kind: 'idle' })
        setError(undefined)
      },
    },
  }
}
