import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMyBookmarks, useCreateBookmarkMutation, useRemoveBookmarkMutation, notifyStorageChange } from '../hooks';
import { getBookmarks, setBookmarks } from '../storage';
import { Star, BookOpen, ArrowLeft, ArrowRight, Dumbbell, Loader2, ChevronRight } from 'lucide-react';
import { BIBLE_BOOKS } from '../utils/bibleBooks';
import { getKJVVerse, type KJVVerseEntry } from '../data/kjv-bible';
import { verseAnchorId, buildChapterUrl, buildChapterUrlRange, parseVerseRangeRef } from '../utils/urlHelpers';

// ─── Sort references in Bible book order ──────────────────────────────────────

const BOOK_ORDER: Record<string, number> = {};
for (let i = 0; i < BIBLE_BOOKS.length; i++) {
  BOOK_ORDER[BIBLE_BOOKS[i].name] = i;
}

function parseRef(ref: string): { book: string; chapter: number; verse: number } | null {
  const m = ref.match(/^(.+?) (\d+):(\d+)(?:-(\d+))?$/);
  if (!m) return null;
  return { book: m[1], chapter: parseInt(m[2], 10), verse: parseInt(m[3], 10) };
}

function sortRefs(refs: string[]): string[] {
  return [...refs].sort((a, b) => {
    const pa = parseRef(a);
    const pb = parseRef(b);
    if (!pa || !pb) return a.localeCompare(b);
    const oa = BOOK_ORDER[pa.book] ?? 999;
    const ob = BOOK_ORDER[pb.book] ?? 999;
    if (oa !== ob) return oa - ob;
    if (pa.chapter !== pb.chapter) return pa.chapter - pb.chapter;
    return pa.verse - pb.verse;
  });
}

// ─── Favorites component ──────────────────────────────────────────────────────

interface FavoriteEntry {
  reference: string;
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd: number;
  isRange: boolean;
  text: string | null;
  verses: KJVVerseEntry[];
}

function Favorites() {
  const [bookmarkData] = useMyBookmarks();
  const { mutate: doCreateBookmark } = useCreateBookmarkMutation();
  const { mutate: doRemoveBookmark } = useRemoveBookmarkMutation();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<FavoriteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVerse, setSelectedVerse] = useState<number | null>(null);
  const [highlightedVerse, setHighlightedVerse] = useState<number | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bookmarks = bookmarkData ?? [];
  const bookmarkRefToId = useMemo(() => new Map(bookmarks.map(b => [b.reference, b.id])), [bookmarks]);
  const bookmarkedRefs = useMemo(() => new Set(bookmarks.map(b => b.reference)), [bookmarks]);

  // Load all favorited verses
  useEffect(() => {
    if (!bookmarkData) return;
    setLoading(true);
    const refs = sortRefs([...bookmarkedRefs]);

    // Build entries — some are single verses, some are ranges
    const built: FavoriteEntry[] = [];
    const promises: Promise<void>[] = [];

    for (const ref of refs) {
      const parsed = parseVerseRangeRef(ref);
      if (!parsed) continue;
      const { book, chapter, verseStart, verseEnd } = parsed;
      const isRange = verseEnd > verseStart;
      const entry: FavoriteEntry = {
        reference: ref,
        book,
        chapter,
        verseStart,
        verseEnd,
        isRange,
        text: null,
        verses: [],
      };

      if (isRange) {
        // Load all verses in the range
        const versePromises: Promise<KJVVerseEntry | null>[] = [];
        for (let v = verseStart; v <= verseEnd; v++) {
          versePromises.push(getKJVVerse(`${book} ${chapter}:${v}`));
        }
        promises.push(Promise.all(versePromises).then(results => {
          entry.verses = results.filter((r): r is KJVVerseEntry => r !== null);
          if (entry.verses.length > 0) {
            entry.text = entry.verses.map(v => v.text).join(' ');
          }
          built.push(entry);
        }));
      } else {
        // Single verse
        promises.push(getKJVVerse(ref).then(v => {
          if (v) {
            entry.verses = [v];
            entry.text = v.text;
          }
          built.push(entry);
        }));
      }
    }

    Promise.all(promises).then(() => {
      // Sort the built entries by reference (they may be out of order due to async)
      built.sort((a, b) => {
        const oa = BOOK_ORDER[a.book] ?? 999;
        const ob = BOOK_ORDER[b.book] ?? 999;
        if (oa !== ob) return oa - ob;
        if (a.chapter !== b.chapter) return a.chapter - b.chapter;
        return a.verseStart - b.verseStart;
      });
      setEntries(built);
      setLoading(false);
    });
  }, [bookmarkData, bookmarkedRefs]);

  // ─── Bookmark toggle ─────────────────────────────────────────────────────────

  function handleUnfavorite(reference: string) {
    const existingId = bookmarkRefToId.get(reference);
    if (bookmarkedRefs.has(reference)) {
      if (existingId) {
        doRemoveBookmark({ bookmark: { id: existingId } }).catch(() => {});
      } else {
        const current = getBookmarks();
        const filtered = current.filter((b: any) => b.reference !== reference);
        setBookmarks(filtered);
        notifyStorageChange('kjv-memorize-bookmarks');
      }
    }
  }

  // ─── Arrow key navigation ────────────────────────────────────────────────────

  const scrollToEntry = useCallback((index: number) => {
    if (index < 0 || index >= entries.length) return;
    const entry = entries[index];
    const el = document.getElementById(verseAnchorId(index));
    if (el) {
      const navHeight = Math.ceil(document.querySelector('nav')?.getBoundingClientRect().height ?? 80);
      const top = el.getBoundingClientRect().top + window.scrollY - navHeight - 20;
      window.scrollTo({ top: Math.max(0, top) });
    }
    setSelectedVerse(index);
    setHighlightedVerse(index);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightedVerse(null), 600);
  }, [entries]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;
      }
      if (e.key === 'ArrowRight' && !e.shiftKey) {
        e.preventDefault();
        const next = (selectedVerse ?? -1) + 1;
        if (next < entries.length) scrollToEntry(next);
      } else if (e.key === 'ArrowLeft' && !e.shiftKey) {
        e.preventDefault();
        const prev = (selectedVerse ?? 1) - 1;
        if (prev >= 0) scrollToEntry(prev);
      } else if (e.key === 'ArrowRight' && e.shiftKey) {
        e.preventDefault();
        // Jump to last favorite
        if (entries.length > 0) scrollToEntry(entries.length - 1);
      } else if (e.key === 'ArrowLeft' && e.shiftKey) {
        e.preventDefault();
        // Jump to first favorite
        if (entries.length > 0) scrollToEntry(0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedVerse, entries.length, scrollToEntry]);

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="glassmorphism rounded-2xl p-12 shadow-lg text-center">
        <Loader2 className="w-10 h-10 text-purple-400 mx-auto mb-3 animate-spin" />
        <p className="text-gray-500">Loading favorites...</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in pb-12">
        <div className="glassmorphism rounded-3xl p-8 shadow-xl text-center">
          <div className="inline-block p-4 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-xl mb-4">
            <Star className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl font-bold gradient-text mb-3">Your Favorites</h1>
          <p className="text-gray-600 text-lg mb-4">You haven't favorited any verses yet.</p>
          <p className="text-gray-500 text-sm mb-6">
            Click the <Star className="w-4 h-4 inline text-yellow-500 fill-yellow-500" /> star icon
            next to any verse to add it here. You can also shift+click to favorite verse ranges.
          </p>
          <Link to="/books">
            <button className="btn-primary text-white py-3 px-6 rounded-xl font-bold">
              <BookOpen className="inline w-5 h-5 mr-2" /> Browse Books
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="glassmorphism rounded-3xl p-8 shadow-xl">
        <div className="flex items-center gap-4 mb-4">
          <div className="inline-block p-4 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-xl">
            <Star className="w-10 h-10 text-white fill-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold gradient-text">Your Favorites</h1>
            <p className="text-sm text-gray-400">
              {entries.length} favorite{entries.length !== 1 ? 's' : ''}
              {entries.filter(e => e.isRange).length > 0 && ` · ${entries.filter(e => e.isRange).length} range${entries.filter(e => e.isRange).length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <p className="text-sm text-gray-500">
          Use <kbd className="kbd-key inline">←</kbd> / <kbd className="kbd-key inline">→</kbd> to navigate between favorites.
          Click the <Star className="w-3 h-3 inline text-yellow-500 fill-yellow-500" /> star to remove a favorite.
        </p>
      </div>

      {/* Favorite entries */}
      <div className="space-y-3">
        {entries.map((entry, i) => (
          <div
            key={entry.reference}
            id={verseAnchorId(i)}
            className={`glassmorphism rounded-2xl p-5 shadow-md transition-all duration-150 ${
              highlightedVerse === i ? 'ring-4 ring-purple-400 ring-offset-2 bg-purple-50' : ''
            } ${
              selectedVerse === i ? 'verse-selected' : ''
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="font-bold text-purple-600 text-lg">{entry.reference}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    BIBLE_BOOKS.find(b => b.name === entry.book)?.testament === 'old'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {BIBLE_BOOKS.find(b => b.name === entry.book)?.testament === 'old' ? 'Old Testament' : 'New Testament'}
                  </span>
                  {entry.isRange && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold">
                      {entry.verseEnd - entry.verseStart + 1} verses
                    </span>
                  )}
                </div>
                {entry.text ? (
                  entry.isRange ? (
                    <div className="space-y-2">
                      {entry.verses.map((v, vi) => (
                        <p key={vi} className="verse-text text-gray-800 leading-relaxed text-sm">
                          <span className="font-bold text-purple-500 text-xs mr-2">{v.verse}</span>
                          {v.text}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="verse-text text-gray-800 leading-relaxed text-sm">{entry.text}</p>
                  )
                ) : (
                  <p className="text-gray-400 italic">Verse text not available</p>
                )}
              </div>
              <button
                onClick={() => handleUnfavorite(entry.reference)}
                className="p-1.5 rounded-lg hover:bg-purple-50 transition-colors flex-shrink-0"
                title="Remove from favorites"
              >
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              </button>
              <Link to={buildChapterUrlRange(entry.book, entry.chapter, { start: entry.verseStart, end: entry.verseEnd })}>
                <button
                  className="p-1.5 rounded-lg hover:bg-purple-50 transition-colors flex-shrink-0"
                  title="Read in context"
                >
                  <BookOpen className="w-4 h-4 text-purple-500" />
                </button>
              </Link>
              <Link to={`/practice/${encodeURIComponent(entry.reference)}`}>
                <button
                  className="btn-secondary text-white py-1.5 px-3 rounded-lg text-xs font-bold whitespace-nowrap flex items-center gap-1 flex-shrink-0"
                  title={entry.isRange ? 'Practice this range' : 'Practice this verse'}
                >
                  <Dumbbell className="w-3 h-3" /> Practice
                </button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Favorites;