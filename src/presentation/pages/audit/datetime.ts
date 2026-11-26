// The date fields of the audit filter. The wire is UTC (IAM-UX-14); the input is the viewer's local time.

/** A UTC instant as the value of a `datetime-local` input (the viewer's local time), or '' for none. */
export function toInputValue(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** The value of a `datetime-local` input as a UTC instant, or undefined for none or an invalid date. */
export function fromInputValue(local: string): string | undefined {
  if (!local) return undefined
  const d = new Date(local)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}
