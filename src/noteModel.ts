export type NoteAttachment = {
  id: string;
  uri: string;
  name: string;
};

export type Note = {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  attachments: NoteAttachment[];
  reminderId?: string;
  reminderAt?: number;
};

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeAttachments(value: unknown, noteId: string): NoteAttachment[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry, index) => {
    if (!isRecord(entry) || typeof entry.uri !== 'string' || !entry.uri.trim()) return [];
    return [{
      id: typeof entry.id === 'string' && entry.id.trim()
        ? entry.id
        : `${noteId}-attachment-${index + 1}`,
      uri: entry.uri,
      name: typeof entry.name === 'string' && entry.name.trim()
        ? entry.name
        : 'Image attachment',
    }];
  });
}

/**
 * Normalize data written by older app versions before it enters the UI.
 * Older notes may not have an attachments array or reminder metadata.
 */
export function normalizeNotes(value: unknown, now = Date.now()): Note[] | null {
  if (!Array.isArray(value)) return null;

  return value.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.id !== 'string' || !entry.id.trim()) return [];

    const createdAt = finiteNumber(entry.createdAt, now);
    const content = typeof entry.content === 'string' ? entry.content.slice(0, 6000) : '';
    const title = typeof entry.title === 'string' && entry.title.trim()
      ? entry.title
      : 'Untitled note';
    const reminderId = typeof entry.reminderId === 'string' && entry.reminderId.trim()
      ? entry.reminderId
      : undefined;
    const reminderAt = typeof entry.reminderAt === 'number' && Number.isFinite(entry.reminderAt)
      ? entry.reminderAt
      : undefined;

    return [{
      id: entry.id,
      title,
      content,
      createdAt,
      updatedAt: finiteNumber(entry.updatedAt, createdAt),
      attachments: normalizeAttachments(entry.attachments, entry.id),
      ...(reminderId ? { reminderId } : {}),
      ...(reminderAt !== undefined ? { reminderAt } : {}),
    }];
  });
}

export function getNoteTitle(note: Pick<Note, 'title' | 'content'>): string {
  const firstLine = note.content.split('\n').map((line) => line.trim()).find(Boolean);
  return note.title !== 'Untitled note'
    ? note.title
    : (firstLine ? firstLine.slice(0, 42) : 'Untitled note');
}
