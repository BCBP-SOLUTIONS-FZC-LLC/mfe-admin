// The look shared by the two mapping editors: a column header row and the grid each mapping row follows,
// so the identity-provider group, its target and the row's action line up on a wide screen and stack on a
// narrow one. The group name leads, an arrow shows the direction (group grants target).
export const GRID_DEPT = 'grid gap-2 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto]'
export const GRID_ROLE = 'grid gap-2 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_auto]'

export function RowHeader({ grid, columns }: { grid: string; columns: string[] }) {
  return (
    <div aria-hidden="true" className={`${grid} hidden px-2 text-xs font-semibold uppercase tracking-wide text-aura-muted md:grid`}>
      {columns.map((c) => (
        <span key={c}>{c}</span>
      ))}
      <span className="w-20" />
    </div>
  )
}
