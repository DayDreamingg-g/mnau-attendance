export type RosterJournalState = 'EMPTY' | 'DRAFT' | 'CONFIRMED';

/** The expected roster includes every linked group, including missing marks. */
export function journalStateFromCounts(expected: number, marked: number, confirmed: number): RosterJournalState {
  if (marked === 0) return 'EMPTY';
  return expected > 0 && marked === expected && confirmed === expected ? 'CONFIRMED' : 'DRAFT';
}

/** Also suitable for the currently visible group segment on a lesson card. */
export function journalStateForRoster(expected: number, attendance: {confirmed: boolean}[]) {
  return journalStateFromCounts(expected, attendance.length, attendance.filter(row => row.confirmed).length);
}

export function journalStateLabel(state: RosterJournalState) {
  return state === 'CONFIRMED' ? 'Підтверджено' : state === 'DRAFT' ? 'Частково заповнено / чернетка' : 'Не заповнено';
}
