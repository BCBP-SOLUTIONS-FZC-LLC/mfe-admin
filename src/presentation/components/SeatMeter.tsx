// Seats as a hard cap (IAM-UX-8): active members plus pending invitations against the licence.
// Room, full (used ≥ licensed: invitations blocked) or over (active > licensed). Drawn as a card: the
// figure, a two-part bar (active, invited), what is free, and "Upgrade plan" once nothing is.
import { useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import type { SeatUsage } from '../../domain/entities/seats'
import { seatState, seatsUsed } from '../../domain/rules/admin-rules'
import { APP_ID } from '../../shared/constants/app'
import { btnPrimary, card } from './styles'

export default function SeatMeter({ usage, onUpgrade }: { usage: SeatUsage; onUpgrade?: () => void }) {
  const t = useT(APP_ID)
  const state = seatState(usage)
  const used = seatsUsed(usage)
  const licensed = Math.max(usage.licensedSeats, 1)
  const percent = (n: number) => `${Math.min(100, (n / licensed) * 100)}%`
  const summary = t('users.seats.summary', { used, licensed: usage.licensedSeats, active: usage.activeUsers, pending: usage.pendingInvitations })
  const free = Math.max(usage.licensedSeats - used, 0)
  return (
    <div className={`${card} flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-6`} data-seat-state={state}>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-aura-text">{t('users.seats.title')}</h2>
          <span className="text-sm text-aura-muted">{summary}</span>
        </div>
        <div
          role="progressbar"
          aria-label={summary}
          aria-valuemin={0}
          aria-valuemax={usage.licensedSeats}
          aria-valuenow={Math.min(used, usage.licensedSeats)}
          className="flex h-2.5 w-full overflow-hidden rounded-full bg-aura-hover"
        >
          <span className={`h-full ${state === 'room' ? 'bg-aura-primary' : 'bg-aura-accent-coral'}`} style={{ width: percent(usage.activeUsers) }} />
          <span className="h-full bg-aura-secondary/60" style={{ width: percent(usage.pendingInvitations) }} />
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-aura-muted">
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2 rounded-full bg-aura-primary" />
            {t('users.seats.legend.active', { count: usage.activeUsers })}
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2 rounded-full bg-aura-secondary/60" />
            {t('users.seats.legend.invited', { count: usage.pendingInvitations })}
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2 rounded-full bg-aura-hover ring-1 ring-aura-border" />
            {t('users.seats.legend.free', { count: free })}
          </li>
        </ul>
        {state === 'full' && <span role="status" className="text-sm font-medium text-aura-text">{t('users.seats.full')}</span>}
        {state === 'over' && <span role="status" className="text-sm font-medium text-aura-text">{t('users.seats.over')}</span>}
      </div>
      {state !== 'room' && onUpgrade && (
        <button type="button" className={btnPrimary} onClick={onUpgrade}>
          {t('users.seats.upgrade')}
        </button>
      )}
    </div>
  )
}
