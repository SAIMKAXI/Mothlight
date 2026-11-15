export type FormattedLineKind = 'heading' | 'bullet' | 'quote' | 'divider' | 'body' | 'empty';
export type FormattedLine = { kind: FormattedLineKind; text: string };

/** Interpret the small, deliberately limited set of formatting markers Mothlight writes. */
export function parseFormattedLine(line: string): FormattedLine {
  if (!line.trim()) return { kind: 'empty', text: '' };
  if (line.startsWith('## ')) return { kind: 'heading', text: line.slice(3) };
  if (line.startsWith('# ')) return { kind: 'heading', text: line.slice(2) };
  if (line.startsWith('• ') || line.startsWith('· ')) return { kind: 'bullet', text: line.slice(2) };
  if (line.startsWith('> ')) return { kind: 'quote', text: line.slice(2) };
  if (/^—\s*—\s*—$/.test(line.trim())) return { kind: 'divider', text: '' };
  return { kind: 'body', text: line };
}
