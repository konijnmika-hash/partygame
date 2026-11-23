// Input validation + light profanity filtering for usernames and free text.

const BLOCKED = [
  'fuck', 'shit', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'asshole', 'bastard', 'slut', 'whore',
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'rape', 'nazi', 'hitler', 'penis', 'vagina', 'porn',
  'wank', 'twat', 'kike', 'spic', 'chink', 'dyke', 'tranny',
];

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' };

function normalizeForFilter(s: string): string {
  return s
    .toLowerCase()
    .split('')
    .map((c) => LEET[c] || c)
    .join('')
    .replace(/[^a-z]/g, '');
}

export function containsProfanity(s: string): boolean {
  const n = normalizeForFilter(s);
  return BLOCKED.some((w) => n.includes(w));
}

/** Replace blocked words (case-insensitive, whole-ish tokens) with asterisks. */
export function cleanText(s: string): string {
  return s.replace(/[A-Za-z0-9@$!]+/g, (tok) => (containsProfanity(tok) ? '*'.repeat(tok.length) : tok));
}

/** Remove control characters, collapse whitespace, trim and cap length. */
export function sanitizeText(input: unknown, maxLen: number): string {
  if (typeof input !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  let s = input.replace(/[\u0000-\u001F\u007F\u200B-\u200F\u2028-\u202E\u2066-\u2069]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length > maxLen) s = s.slice(0, maxLen).trim();
  return cleanText(s);
}

export const USERNAME_RE = /^[A-Za-z0-9_\- ]{3,16}$/;

export function validateUsername(name: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof name !== 'string') return { ok: false, error: 'Username required' };
  const v = name.replace(/\s+/g, ' ').trim();
  if (v.length < 3) return { ok: false, error: 'At least 3 characters' };
  if (v.length > 16) return { ok: false, error: 'At most 16 characters' };
  if (!USERNAME_RE.test(v)) return { ok: false, error: 'Letters, numbers, spaces, _ and - only' };
  if (containsProfanity(v)) return { ok: false, error: 'Please pick a friendlier name' };
  return { ok: true, value: v };
}

export function validatePassword(pw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof pw !== 'string') return { ok: false, error: 'Password required' };
  if (pw.length < 6) return { ok: false, error: 'At least 6 characters' };
  if (pw.length > 128) return { ok: false, error: 'Too long' };
  return { ok: true, value: pw };
}

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const ROOM_CODE_LENGTH = 4;

export function normalizeRoomCode(code: unknown): string | null {
  if (typeof code !== 'string') return null;
  const c = code.trim().toUpperCase();
  if (c.length !== ROOM_CODE_LENGTH) return null;
  for (const ch of c) if (!ROOM_CODE_ALPHABET.includes(ch)) return null;
  return c;
}

export { ROOM_CODE_ALPHABET };

/** Loose answer matching for typed guesses: case/space/punctuation-insensitive with small typo tolerance. */
export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^(the|a|an) /, '')
    .replace(/[^a-z0-9]/g, '');
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Returns 'exact' | 'close' | 'no' comparing a guess against one or more accepted answers. */
export function matchAnswer(guess: string, answers: string[]): 'exact' | 'close' | 'no' {
  const g = normalizeAnswer(guess);
  if (!g) return 'no';
  let close = false;
  for (const ans of answers) {
    const a = normalizeAnswer(ans);
    if (!a) continue;
    if (g === a) return 'exact';
    const tol = a.length >= 8 ? 2 : a.length >= 5 ? 1 : 0;
    const d = levenshtein(g, a);
    if (d <= tol) return 'exact';
    if (d <= tol + 1) close = true;
  }
  return close ? 'close' : 'no';
}
