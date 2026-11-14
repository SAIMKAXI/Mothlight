export type TextSelection = { start: number; end: number };
export type FormatResult = { text: string; selection: TextSelection };

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lineTransform(line: string, prefix: string, remove: boolean): string {
  if (!line.trim()) return line;
  if (remove) return line.startsWith(prefix) ? line.slice(prefix.length) : line;
  return line.startsWith(prefix) ? line : prefix + line;
}

/**
 * Toggles a line prefix for the current line or every touched line.
 * The selection is mapped across inserted/removed prefixes so the editor caret
 * remains at the corresponding text position.
 */
export function toggleLinePrefix(
  text: string,
  selection: TextSelection,
  prefix: string,
): FormatResult {
  const start = clamp(Math.min(selection.start, selection.end), 0, text.length);
  const end = clamp(Math.max(selection.start, selection.end), 0, text.length);
  const blockStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const endProbe = start === end ? end : Math.max(start, end - 1);
  const nextNewline = text.indexOf('\n', endProbe);
  const blockEnd = nextNewline < 0 ? text.length : nextNewline;
  const originalBlock = text.slice(blockStart, blockEnd);
  const lines = originalBlock.split('\n');
  const nonEmpty = lines.filter((line) => line.trim().length > 0);
  const remove = nonEmpty.length > 0 && nonEmpty.every((line) => line.startsWith(prefix));
  const transformed = lines.map((line) => lineTransform(line, prefix, remove));

  const lineMaps: Array<{ oldStart: number; oldEnd: number; newStart: number; oldLine: string; newLine: string }> = [];
  let oldOffset = 0;
  let newOffset = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const oldLine = lines[index];
    const newLine = transformed[index];
    lineMaps.push({
      oldStart: oldOffset,
      oldEnd: oldOffset + oldLine.length,
      newStart: newOffset,
      oldLine,
      newLine,
    });
    oldOffset += oldLine.length + (index < lines.length - 1 ? 1 : 0);
    newOffset += newLine.length + (index < lines.length - 1 ? 1 : 0);
  }

  const mapOffset = (absoluteOffset: number): number => {
    const relative = clamp(absoluteOffset - blockStart, 0, originalBlock.length);
    for (let index = 0; index < lineMaps.length; index += 1) {
      const line = lineMaps[index];
      const isLast = index === lineMaps.length - 1;
      if (relative <= line.oldEnd || isLast) {
        const withinLine = clamp(relative - line.oldStart, 0, line.oldLine.length);
        const added = line.newLine.length > line.oldLine.length
          ? line.newLine.length - line.oldLine.length
          : 0;
        const removed = line.oldLine.length > line.newLine.length
          ? line.oldLine.length - line.newLine.length
          : 0;
        const mappedWithin = added
          ? withinLine + added
          : removed
            ? Math.max(0, withinLine - removed)
            : withinLine;
        return blockStart + line.newStart + mappedWithin;
      }
    }
    return blockStart + originalBlock.length;
  };

  const nextBlock = transformed.join('\n');
  const nextText = text.slice(0, blockStart) + nextBlock + text.slice(blockEnd);
  const mappedStart = mapOffset(start);
  const mappedEnd = mapOffset(end);

  return {
    text: nextText,
    selection: {
      start: clamp(Math.min(mappedStart, mappedEnd), 0, nextText.length),
      end: clamp(Math.max(mappedStart, mappedEnd), 0, nextText.length),
    },
  };
}

export function insertAtSelection(
  text: string,
  selection: TextSelection,
  replacement: string,
  maxLength = 6000,
): FormatResult {
  const start = clamp(Math.min(selection.start, selection.end), 0, text.length);
  const end = clamp(Math.max(selection.start, selection.end), 0, text.length);
  const nextText = (text.slice(0, start) + replacement + text.slice(end)).slice(0, maxLength);
  const caret = clamp(start + replacement.length, 0, nextText.length);
  return { text: nextText, selection: { start: caret, end: caret } };
}
