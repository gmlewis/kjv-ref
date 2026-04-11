import type { KJVVerseEntry } from '../data/kjv-bible';

export function isBookmarked(reference: string, bookmarkedRefs: string[]): boolean {
  return bookmarkedRefs.includes(reference);
}

export function sortBookmarkedFirst(verses: KJVVerseEntry[], bookmarkedRefs: string[]): KJVVerseEntry[] {
  if (bookmarkedRefs.length === 0) return verses;
  const bookmarked = verses.filter(v => bookmarkedRefs.includes(v.reference));
  const rest = verses.filter(v => !bookmarkedRefs.includes(v.reference));
  return [...bookmarked, ...rest];
}

export function filterToBookmarked(verses: KJVVerseEntry[], refs: string[]): KJVVerseEntry[] {
  return verses.filter(v => refs.includes(v.reference));
}
