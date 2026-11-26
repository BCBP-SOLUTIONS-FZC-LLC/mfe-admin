// Shown instead of the invite form when no seat is free (IAM-UX-8: the seat meter comes before the form):
// it says why and offers the way on, the plan upgrade.
import { useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import Dialog from '../../components/Dialog'
import { btnOutline, btnPrimary } from '../../components/styles'
import { APP_ID } from '../../../shared/constants/app'

export default function UpgradePrompt({ licensed, onUpgrade, onClose }: { licensed: number; onUpgrade: () => void; onClose: () => void }) {
  const t = useT(APP_ID)
  return (
    <Dialog title={t('upgrade.title')} onClose={onClose}>
      <p className="mb-5 text-sm text-aura-muted">{t('upgrade.body', { licensed })}</p>
      <div className="flex justify-end gap-2">
        <button type="button" className={btnOutline} onClick={onClose}>
          {t('common.close')}
        </button>
        <button type="button" className={btnPrimary} onClick={onUpgrade}>
          {t('upgrade.cta')}
        </button>
      </div>
    </Dialog>
  )
}
