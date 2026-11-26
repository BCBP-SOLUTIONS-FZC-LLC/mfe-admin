// The audit exports this admin started. The Audit Log has no "list my exports" route, only
// `GET /audit/exports/:id`, so the screen keeps the IDs itself (per workspace, newest first, so they
// survive a reload) and asks the service about each. An export stays retrievable for 7 days.
export interface ExportJobStore {
  /** The tracked export IDs, newest first. */
  list(): readonly string[]
  /** Starts tracking an export (moves it to the front if it is already tracked; keeps the newest few). */
  add(exportId: string): void
  remove(exportId: string): void
}
