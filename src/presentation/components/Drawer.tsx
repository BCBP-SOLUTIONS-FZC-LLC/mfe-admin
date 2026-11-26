// A side drawer for the detail of one row (the audit entry): a modal dialog that slides in from the end
// edge, labelled, closed by Escape or its Close button, with focus kept inside it and returned to what
// opened it. It covers the page's controls, so it is modal like Dialog, not a floating panel.
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useFocusTrap } from '../../shared/hooks/useFocusTrap'

export default function Drawer({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId()
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(true, ref)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex h-full w-full max-w-md flex-col overflow-y-auto border-s border-aura-border bg-aura-surface p-6 text-aura-text shadow-2xl"
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-sm text-aura-muted">{subtitle}</p>}
        <div className="mt-4 flex flex-1 flex-col">{children}</div>
      </div>
    </div>
  )
}
