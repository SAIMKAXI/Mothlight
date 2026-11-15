const URDU_SCRIPT_PATTERN = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/u;

/** Returns true when text contains Urdu/Arabic-script characters. */
export function containsUrduScript(value: string): boolean {
  return URDU_SCRIPT_PATTERN.test(value);
}
