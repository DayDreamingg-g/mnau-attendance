export type SubmissionMode = 'DRAFT' | 'CONFIRM' | 'AUTO';
export type JournalStatus = 'PRESENT' | 'N' | 'HV' | null;

/** AUTO is resolved for each row on the server, never trusted as a permission. */
export function confirmsRow(mode: SubmissionMode, canConfirm: boolean) {
  void mode; return canConfirm;
}

export function submissionMode(rows: {editable: boolean; canConfirm: boolean}[]): SubmissionMode {
  void rows; return 'AUTO';
}
