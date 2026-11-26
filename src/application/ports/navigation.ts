// Where the admin screens send the user next, outside this remote: the plan upgrade when no seat is
// free (E1). The shell's router does the move; the screens only ask.
export interface AdminNavigation {
  /** Opens the plan upgrade (seats) for this workspace. */
  upgrade(): void
}
