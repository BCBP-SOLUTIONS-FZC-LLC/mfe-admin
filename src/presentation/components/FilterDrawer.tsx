// The "Filters" button and the drawer it opens from the end edge. The drawer holds the filter form; the
// form calls `close` once the filters are applied or cleared. The button shows how many filters are on.
import { useState, type ReactNode } from 'react'
import Drawer from './Drawer'
import { btnOutline } from './styles'

export default function FilterDrawer({ label, active, children }: { label: string; active: number; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  return (
    <>
      <button type="button" className={btnOutline} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {label}
        {active > 0 && (
          <span className="rounded-full bg-aura-primary px-1.5 text-xs font-semibold text-white" aria-label={String(active)}>
            {active}
          </span>
        )}
      </button>
      {open && (
        <Drawer title={label} onClose={close}>
          {children(close)}
        </Drawer>
      )}
    </>
  )
}
