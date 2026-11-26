// One audit entry in full (AL-2), in a side drawer: who did it, what and to what, from where (source
// service, retention tier), the request (IP address and the trace ID to quote, with Copy) and everything
// the entry recorded. The entry's own fields (names, metadata) are untrusted text and are shown as
// text, never as markup.
import { formatDate } from '@bcbp-solutions-fzc-llc/frontend-sdk/i18n'
import { useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { useState, type ReactNode } from 'react'
import type { AuditEntry } from '../../../domain/entities/audit'
import { auditFamilyOf } from '../../../domain/vocabulary'
import { APP_ID } from '../../../shared/constants/app'
import Drawer from '../../components/Drawer'
import Avatar from '../../components/identity/Avatar'
import { btnOutline } from '../../components/styles'
import { useAuditEntry } from '../../features/audit/useAudit'
import { EntryTypePill, entryTypeLabel } from './AuditTable'

const TIER_KEYS = { compliance_7y: 'audit.tier.compliance_7y', security_3y: 'audit.tier.security_3y', access_90d: 'audit.tier.access_90d' } as const

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-aura-border py-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-aura-muted">{title}</h3>
      {children}
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-sm text-aura-muted">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-aura-text">{children}</dd>
    </>
  )
}

export default function EntryDialog({ row, actor, onClose }: { row: AuditEntry; actor: string; onClose: () => void }) {
  const t = useT(APP_ID)
  const full = useAuditEntry(row.id)
  const [copied, setCopied] = useState(false)
  // The row is shown at once; the full entry replaces it when it arrives. If it cannot be loaded the row stays, and the drawer says so.
  const entry = full.data ?? row
  const metadata = Object.entries(entry.metadata)
  const family = auditFamilyOf(entry.entryType)
  const time = formatDate(entry.occurredAt, { dateStyle: 'medium', timeStyle: 'medium' })
  const grid = 'grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5'

  return (
    <Drawer title={t('audit.entry.title')} subtitle={entry.action} onClose={onClose}>
      <section className="flex items-center gap-3 pb-4">
        <Avatar name={actor} size="lg" />
        <div className="flex min-w-0 flex-col">
          <span className="text-xs text-aura-muted">{t('audit.entry.actor')}</span>
          <span className="truncate font-semibold text-aura-text">{actor}</span>
          <span className="text-xs text-aura-muted">{time}</span>
        </div>
      </section>

      <Section title={t('audit.entry.what')}>
        <dl className={grid}>
          <Row label={t('audit.entry.time')}>{time}</Row>
          <Row label={t('audit.entry.actor')}>{actor}</Row>
          <Row label={t('audit.entry.action')}>{entry.action}</Row>
          <Row label={t('audit.entry.entryType')}>
            <span className="flex flex-wrap items-center gap-2">
              {family && <EntryTypePill entryType={entry.entryType} />}
              <code className="text-xs">{entry.entryType}</code>
              <span className="sr-only">{family ? entryTypeLabel(t, entry.entryType) : ''}</span>
            </span>
          </Row>
          {(entry.target?.type || entry.target?.id) && <Row label={t('audit.entry.target')}>{[entry.target.type, entry.target.id].filter(Boolean).join(' ')}</Row>}
        </dl>
      </Section>

      <Section title={t('audit.entry.where')}>
        <dl className={grid}>
          <Row label={t('audit.entry.source')}>{entry.sourceService}</Row>
          {entry.retentionTier && (
            <Row label={t('audit.entry.retention')}>
              <span className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-aura-hover px-2.5 py-0.5 text-xs font-medium">{t(TIER_KEYS[entry.retentionTier])}</span>
                <code className="text-xs text-aura-muted">{entry.retentionTier}</code>
              </span>
            </Row>
          )}
        </dl>
      </Section>

      {(entry.ipAddress || entry.traceId) && (
        <Section title={t('audit.entry.request')}>
          <dl className={grid}>
            {entry.ipAddress && <Row label={t('audit.entry.ip')}><code className="text-xs">{entry.ipAddress}</code></Row>}
            {entry.traceId && (
              <Row label={t('audit.entry.trace')}>
                <span className="flex flex-wrap items-center gap-2">
                  <code className="text-xs">{entry.traceId}</code>
                  <button type="button" className={btnOutline} onClick={() => void navigator.clipboard?.writeText(entry.traceId!).then(() => setCopied(true))}>
                    {copied ? t('common.copied') : t('audit.entry.copyTrace')}
                  </button>
                </span>
              </Row>
            )}
          </dl>
        </Section>
      )}

      <Section title={t('audit.entry.metadata')}>
        {metadata.length === 0 ? (
          <p className="text-sm text-aura-muted">{t('audit.entry.noMetadata')}</p>
        ) : (
          <dl className={`${grid} rounded-lg bg-aura-canvas p-3`}>
            {metadata.map(([key, value]) => (
              <div key={key} className="contents">
                <dt className="text-xs text-aura-muted">{key}</dt>
                <dd className="break-all font-mono text-xs text-aura-text">{typeof value === 'string' ? value : JSON.stringify(value)}</dd>
              </div>
            ))}
          </dl>
        )}
      </Section>

      {full.isError && <p role="status" className="text-sm text-aura-muted">{t('audit.entry.refreshFailed')}</p>}
      <div className="mt-auto flex justify-end pt-4">
        <button type="button" className={btnOutline} onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </Drawer>
  )
}
