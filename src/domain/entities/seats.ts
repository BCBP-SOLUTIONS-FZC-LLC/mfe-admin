/** Seats as P-27 answers: the whole answer. The grace date the spec wants is not returned (IAM-FE-Q3). */
export interface SeatUsage {
  readonly activeUsers: number
  readonly pendingInvitations: number
  readonly licensedSeats: number
}
