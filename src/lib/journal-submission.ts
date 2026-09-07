export type SubmissionMode = 'DRAFT' | 'CONFIRM' | 'AUTO';
export type JournalStatus = 'PRESENT' | 'N' | 'HV' | null;

/** AUTO is resolved for each row on the server, never trusted as a permission. */
export function confirmsRow(mode: SubmissionMode, canConfirm: boolean) {
  return mode === 'CONFIRM' || (mode === 'AUTO' && canConfirm);
}

export function submissionMode(rows: {editable: boolean; canConfirm: boolean}[]): SubmissionMode {
  const editable = rows.filter(row => row.editable);
  if (!editable.some(row => row.canConfirm)) return 'DRAFT';
  return editable.every(row => row.canConfirm) ? 'CONFIRM' : 'AUTO';
}
