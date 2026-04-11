export function verseAnchorId(verseNum: number): string {
  return `v${verseNum}`;
}

export function buildChapterUrl(book: string, chapter: number, verse?: number): string {
  const base = `/books/${encodeURIComponent(book)}/${chapter}`;
  return verse !== undefined ? `${base}#${verseAnchorId(verse)}` : base;
}
