/**
 * Normalises an Indian or international number to E.164.
 * Accepts "99719 32510", "+91 99719-32510", "09971932510", "919971932510".
 * Returns null when the number can't be a real phone number.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  if (trimmed.startsWith("+")) {
    return digits.length >= 10 && digits.length <= 15 ? `+${digits}` : null;
  }
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) return /^[6-9]/.test(digits) ? `+91${digits}` : null;
  if (digits.length === 12 && digits.startsWith("91")) return /^91[6-9]/.test(digits) ? `+${digits}` : null;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return null;
}
