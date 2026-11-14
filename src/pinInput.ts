export const PIN_LENGTH = 6;

export function appendPinDigit(current: string, digit: string): string {
  if (!/^\d$/.test(digit) || current.length >= PIN_LENGTH) return current;
  return current + digit;
}

export function removePinDigit(current: string): string {
  return current.slice(0, -1);
}

export function isValidPin(value: string): boolean {
  return /^\d{6}$/.test(value);
}
