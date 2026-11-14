type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Read and validate the note route attached to a local reminder notification. */
export function getReminderNoteId(data: unknown): string | null {
  if (!isRecord(data)) return null;
  return typeof data.noteId === 'string' && data.noteId.trim()
    ? data.noteId
    : null;
}
