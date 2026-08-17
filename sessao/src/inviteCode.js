const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 8;
export const INVITE_CODE_MIN_LENGTH = 6;

export function normalizeInviteCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z2-9]/g, "")
    .slice(0, INVITE_CODE_LENGTH);
}

export function generateInviteCode(random = globalThis.crypto) {
  if (!random?.getRandomValues) throw new Error("Secure random generator unavailable");
  const bytes = new Uint8Array(INVITE_CODE_LENGTH);
  random.getRandomValues(bytes);
  return Array.from(bytes, byte => ALPHABET[byte % ALPHABET.length]).join("");
}

export function isInviteCodeValid(value) {
  const code = normalizeInviteCode(value);
  return code.length >= INVITE_CODE_MIN_LENGTH && code.length <= INVITE_CODE_LENGTH;
}
