// The small status marks of a member row, in the dashboard's Aura palette: the membership status as a
// pill, how the person signs in (password or the company's SSO), and their availability dot.
import { useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import type { Availability, UserSource } from '../../../domain/entities/user'
import { APP_ID } from '../../../shared/constants/app'

export type Tone = 'success' | 'warning' | 'danger'

const TONE: Record<Tone, { dot: string; classes: string }> = {
  success: { dot: 'bg-emerald-500', classes: 'bg-emerald-500/12 text-emerald-800 dark:text-emerald-200' },
  warning: { dot: 'bg-amber-500', classes: 'bg-aura-accent-amber-soft text-aura-text' },
  danger: { dot: 'bg-red-500', classes: 'bg-aura-accent-coral-soft text-aura-text' },
}

/** A small status pill: a coloured dot and a word, in the Aura palette. */
export function Pill({ tone, children }: { tone: Tone; children: string }) {
  const s = TONE[tone]
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${s.classes}`}>
      <span aria-hidden="true" className={`size-1.5 rounded-full ${s.dot}`} />
      {children}
    </span>
  )
}

export type StatusKind = 'active' | 'suspended' | 'disabled'

const STATUS: Record<StatusKind, { text: string; tone: Tone }> = {
  active: { text: 'users.status.active', tone: 'success' },
  suspended: { text: 'users.status.suspended', tone: 'warning' },
  disabled: { text: 'users.status.disabled', tone: 'danger' },
}

export function StatusPill({ kind }: { kind: StatusKind }) {
  const t = useT(APP_ID)
  return <Pill tone={STATUS[kind].tone}>{t(STATUS[kind].text)}</Pill>
}

export function SignInBadge({ source }: { source: UserSource }) {
  const t = useT(APP_ID)
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-md border border-aura-border px-2 py-0.5 text-xs font-medium text-aura-muted">
      {t(source === 'federated' ? 'users.signIn.federated' : 'users.signIn.local')}
    </span>
  )
}

const AVAILABILITY: Record<Availability, { text: string; dot: string }> = {
  available: { text: 'users.availability.available', dot: 'bg-emerald-500' },
  busy: { text: 'users.availability.busy', dot: 'bg-red-500' },
  ooo: { text: 'users.availability.ooo', dot: 'bg-amber-500' },
}

export function AvailabilityDot({ availability }: { availability: Availability }) {
  const t = useT(APP_ID)
  const a = AVAILABILITY[availability]
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm">
      <span aria-hidden="true" className={`size-2 rounded-full ${a.dot}`} />
      {t(a.text)}
    </span>
  )
}
