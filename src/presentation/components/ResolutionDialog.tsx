// E2a step 2: the member is covering work for others, so IAM asks what happens to it first. Hand the
// coverage to another active member, or stop those workflows; then the original change goes ahead.
import { useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { useState } from 'react'
import { APP_ID } from '../../shared/constants/app'
import type { ResolutionState } from '../features/members/useResolvableAction'
import { useProblemText } from '../features/useProblemText'
import Dialog from './Dialog'
import ProblemDetails from './ProblemDetails'
import MemberPicker from './identity/MemberPicker'

type Choice = 'replace_delegate' | 'stop_workflows'

export default function ResolutionDialog({ state, subjectUserId, subjectName }: { state: ResolutionState; subjectUserId: string; subjectName: string }) {
  const t = useT(APP_ID)
  const problemText = useProblemText()
  const [choice, setChoice] = useState<Choice | undefined>()
  const [replacement, setReplacement] = useState('')
  if (!state.open || !state.required) return null
  const { required } = state
  const canReplace = required.allowedActions.includes('replace_delegate')
  const canStop = required.allowedActions.includes('stop_workflows')
  const selected = choice ?? (canReplace ? 'replace_delegate' : 'stop_workflows')

  // Our own refusals (no replacement chosen) arrive as plain Errors named by the rule's failure code.
  const message = (e: unknown) =>
    e instanceof Error && e.message === 'replacement-required' ? t('resolve.error.replacement') : e instanceof Error && e.message === 'replacement-is-subject' ? t('resolve.error.subject') : problemText(e)

  return (
    <Dialog title={t('resolve.title', { name: subjectName })} onClose={state.cancel}>
      <p className="mb-3">{t('resolve.body', { name: subjectName, count: required.activeWorkflows })}</p>
      <fieldset className="mb-4 flex flex-col gap-3">
        {canReplace && (
          <label className="flex flex-col gap-2">
            <span className="flex items-center gap-2">
              <input type="radio" className="radio radio-sm" name="resolution" checked={selected === 'replace_delegate'} onChange={() => setChoice('replace_delegate')} />
              {t('resolve.replace')}
            </span>
            {selected === 'replace_delegate' && <MemberPicker label={t('resolve.picker')} value={replacement} onChange={setReplacement} excludeUserId={subjectUserId} />}
          </label>
        )}
        {canStop && (
          <label className="flex flex-col gap-1">
            <span className="flex items-center gap-2">
              <input type="radio" className="radio radio-sm" name="resolution" checked={selected === 'stop_workflows'} onChange={() => setChoice('stop_workflows')} />
              {t('resolve.stop')}
            </span>
            {selected === 'stop_workflows' && <span className="text-sm text-base-content/70">{t('resolve.stopHint')}</span>}
          </label>
        )}
      </fieldset>
      {state.error !== undefined && (
        <div role="alert" className="mb-4 flex flex-wrap items-center gap-2 text-error">
          <span>{message(state.error)}</span>
          <ProblemDetails error={state.error} />
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={state.cancel}>
          {t('confirm.cancel')}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={state.busy}
          onClick={() => void state.choose(selected === 'replace_delegate' ? { action: selected, replacementUserId: replacement } : { action: selected })}
        >
          {state.busy ? t('confirm.working') : t('resolve.apply')}
        </button>
      </div>
    </Dialog>
  )
}
