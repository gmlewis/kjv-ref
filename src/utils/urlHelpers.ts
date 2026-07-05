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
