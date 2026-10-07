// Mesmo alfabeto do backend (groupRules.TOKEN_ALPHABET): sem I, L, O, 0, 1.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const TOKEN_LENGTH = 8;
const CODE_RE = new RegExp(`^[${ALPHABET}]{${TOKEN_LENGTH}}$`);

export const normalizeCode = (raw: string): string => raw.replace(/\s+/g, '').toUpperCase();
export const isValidCode = (code: string): boolean => CODE_RE.test(code);

// torv://join/ABCD2345, exp://192.168.0.2:8081/--/join/ABCD2345 (Expo Go) etc. Qualquer coisa fora disso → null.
export function joinTokenFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = /(?:^|\/)join\/([^/?#\s]+)/i.exec(url);
  if (!match) return null;
  let raw: string;
  try {
    raw = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  const code = normalizeCode(raw);
  return isValidCode(code) ? code : null;
}
