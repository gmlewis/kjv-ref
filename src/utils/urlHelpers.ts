export function verseAnchorId(verseNum: number): string {
  return `v${verseNum}`;
}

export function buildChapterUrl(book: string, chapter: number, verse?: number): string {
  const base = `/books/${encodeURIComponent(book)}/${chapter}`;
  return verse !== undefined ? `${base}#${verseAnchorId(verse)}` : base;
}

export function parseVerseRef(reference: string): { book: string; chapter: number; verse: number } | null {
  const m = reference.match(/^(.+) (\d+):(\d+)$/);
  if (!m) return null;
  return { book: m[1], chapter: parseInt(m[2], 10), verse: parseInt(m[3], 10) };
}

// ─── Verse range support ──────────────────────────────────────────────────────

export interface VerseRange {
  start: number;
  end: number;
}

/**
 * Parse a URL hash like "#v16" or "#v1-6" into a verse number or range.
 * Returns null if the hash doesn't match the expected format.
 */
export function parseVerseHash(hash: string): VerseRange | null {
  if (!hash.startsWith('#v')) return null;
  const rest = hash.slice(2);
  const m = rest.match(/^(\d+)(?:-(\d+))?$/);
  if (!m) return null;
  const start = parseInt(m[1], 10);
  if (isNaN(start)) return null;
  const end = m[2] ? parseInt(m[2], 10) : start;
  if (isNaN(end) || end < start) return null;
  return { start, end };
}

/**
 * Build a URL hash from a verse range: "#v16" for single verse, "#v1-6" for range.
 */
export function buildVerseHash(range: VerseRange): string {
  return range.start === range.end
    ? `#v${range.start}`
    : `#v${range.start}-${range.end}`;
}

/**
 * Build a full chapter URL with an optional verse range.
 */
export function buildChapterUrlRange(book: string, chapter: number, range?: VerseRange): string {
  const base = `/books/${encodeURIComponent(book)}/${chapter}`;
  return range ? `${base}${buildVerseHash(range)}` : base;
}
