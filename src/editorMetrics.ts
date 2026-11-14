export type CursorMetrics = { row:number; column:number; columns:number };

/** Map a native TextInput selection offset onto the measured monospaced paper grid. */
export function getCursorMetrics(text:string, selectionOffset:number, availableWidth:number, glyphWidth:number):CursorMetrics {
  const columns=Math.max(1,Math.floor(availableWidth/Math.max(glyphWidth,1)));
  const safeOffset=Math.max(0,Math.min(selectionOffset,text.length));
  const prefix=Array.from(text.slice(0,safeOffset));
  let row=0, column=0;
  for (const character of prefix) {
    if (character==='\n') { row+=1; column=0; continue; }
    if (column>=columns) { row+=1; column=0; }
    column+=1;
  }
  return {row,column,columns};
}

export function classifyEdit(previous:string,next:string):'key'|'space'|'return'|'backspace'|'paste'|'none' {
  if (previous===next) return 'none';
  const delta=next.length-previous.length;
  if (Math.abs(delta)>1) return 'paste';
  if (delta<0) return 'backspace';
  let prefix=0;
  while (prefix<previous.length && prefix<next.length && previous[prefix]===next[prefix]) prefix+=1;
  const inserted=next.slice(prefix,prefix+delta);
  if (inserted==='\n') return 'return';
  if (inserted===' ') return 'space';
  return 'key';
}
