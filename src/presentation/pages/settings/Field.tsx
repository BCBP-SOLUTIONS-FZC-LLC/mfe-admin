// Layout pieces of the settings cards: a titled section with its intro, a labelled field with an optional
// hint, and the on/off switch for a boolean. Plain markup on the Aura tokens: the inputs keep their real
// labels (htmlFor), so the fields stay named for assistive technology and for tests.
import type { ReactNode } from 'react'

export function SectionHeader({ id, title, intro }: { id: string; title: string; intro?: string }) {
  return (
    <div>
      <h2 id={id} className="text-lg font-semibold text-aura-text">
        {title}
      </h2>
      {intro && <p className="mt-1 text-sm text-aura-muted">{intro}</p>}
    </div>
  )
}

export function Field({ label, htmlFor, hintId, hint, children }: { label: string; htmlFor: string; hintId?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-aura-text">
        {label}
      </label>
      {children}
      {hint && (
        <span id={hintId} className="text-xs text-aura-muted">
          {hint}
        </span>
      )}
    </div>
  )
}

/** A checkbox drawn as a switch: still a checkbox for the keyboard and assistive technology. */
export function Switch({ id, checked, disabled, describedBy, onChange }: { id: string; checked: boolean; disabled: boolean; describedBy: string; onChange: (checked: boolean) => void }) {
  return (
    <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
      <input id={id} type="checkbox" className="peer absolute inset-0 z-10 m-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed" checked={checked} disabled={disabled} aria-describedby={describedBy} onChange={(e) => onChange(e.target.checked)} />
      <span aria-hidden="true" className="h-6 w-11 rounded-full bg-aura-border transition-colors peer-checked:bg-aura-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-aura-primary peer-disabled:opacity-50" />
      <span aria-hidden="true" className="absolute start-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5 rtl:peer-checked:-translate-x-5" />
    </span>
  )
}
