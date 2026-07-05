import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import { useMyBookmarks, useCreateBookmarkMutation, useRemoveBookmarkMutation } from '../hooks';
import { ChevronRight, BookOpen, Search, Star, ArrowLeft, ArrowRight, Dumbbell, Hash, Loader2, X, ExternalLink, LinkIcon } from 'lucide-react';

import { KJV_VERSES, getVersesByBook } from '../data/kjv-verses';
import { getKJVChapter, getKJVChapterList, type KJVVerseEntry, BOOK_ABBR_MAP } from '../data/kjv-bible';
import { searchKJV, type SearchResult } from '../data/kjv-search';
import { verseAnchorId, buildChapterUrl } from '../utils/urlHelpers';
import { getVerseWordData, type StrongsEntry } from '../data/strongs';
import { getInterlinearChapter, getInterlinearWordBook, type WordEntry } from '../data/interlinear';
import { bibleHubInterlinearUrl, stepBibleUrl } from '../utils/studyLinks';
import { StrongsPopover } from './StrongsPopover';
import { InterlinearWordPopover } from './InterlinearWordPopover';
// No longer needed for static site - dataUrls always returns fallback paths
import { BIBLE_BOOKS, getPrevNextChapter } from '../utils/bibleBooks';

// Target verse to scroll to on next ChapterView mount (set by search result clicks
// before navigation so the value is available synchronously at mount time).
let _pendingScrollVerse: number | null = null;

// ─── Highlight helper ────────────────────────────────────────────────────────
function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const terms = query.trim().split(/\s+/).filter(Boolean);
  // Build a regex from all query terms
  const escaped = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(re);
  return parts.map((part, i) =>
    re.test(part) ? <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5">{part}</mark> : part
  );
}

// ─── Search Panel ────────────────────────────────────────────────────────────
function SearchPanel({ onNavigateAway }: { onNavigateAway: () => void }) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [testament, setTestament] = useState<'all' | 'old' | 'new'>('all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus when panel opens
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounce: 300 ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Run search when debounced query or testament filter changes
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const opts = testament !== 'all' ? { testament } : {};
    searchKJV(debouncedQuery, opts).then(r => {
      setResults(r);
      setSearching(false);
    });
  }, [debouncedQuery, testament]);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="glassmorphism rounded-3xl p-8 shadow-xl">
        <div className="flex items-center gap-4 mb-4">
          <div className="inline-block p-4 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-xl">
            <Search className="w-10 h-10 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold gradient-text">Search Verses</h1>
            <p className="text-gray-600">Search all 24,857 KJV verses</p>
          </div>
        </div>

        {/* Search input */}
        <div className="relative mt-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search all 24,857 verses..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-12 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none bg-white/70 text-base"
          />
          {searching && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-400 w-5 h-5 animate-spin" />
          )}
          {!searching && query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Testament filter pills */}
        <div className="flex gap-2 mt-4 flex-wrap">
          {(['all', 'old', 'new'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTestament(t)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all shadow-sm ${
                testament === t
                  ? t === 'all'
                    ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white'
                    : t === 'old'
                    ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white'
                    : 'bg-gradient-to-r from-blue-400 to-indigo-600 text-white'
                  : 'glassmorphism text-gray-600 hover:shadow-md'
              }`}
            >
              {t === 'all' ? 'All' : t === 'old' ? 'Old Testament' : 'New Testament'}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {debouncedQuery.trim() && !searching && results.length === 0 && (
        <div className="glassmorphism rounded-2xl p-12 shadow-lg text-center">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">No results found for "{debouncedQuery}"</p>
          <p className="text-gray-400 text-sm mt-1">Try different keywords or check your spelling</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500 px-1">{results.length} result{results.length !== 1 ? 's' : ''}</p>
          {results.map(result => {
            const [bookName, rest] = result.reference.split(' ').length >= 3
              ? [result.book, result.reference.slice(result.book.length + 1)]
              : result.reference.split(/ (?=\d+:)/);
            const chapterNum = result.chapter;
            return (
              <Link
                key={result.reference}
                to={buildChapterUrl(result.book, chapterNum, result.verse)}
              >
                <div
                  className="glassmorphism rounded-2xl p-5 shadow-md cursor-pointer hover:shadow-lg hover:border-purple-200 border-2 border-transparent transition-all"
                  onClick={() => { _pendingScrollVerse = result.verse; onNavigateAway(); }}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="font-bold text-purple-600">{result.reference}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          result.book && BIBLE_BOOKS.find(b => b.name === result.book)?.testament === 'old'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {BIBLE_BOOKS.find(b => b.name === result.book)?.testament === 'old'
                            ? 'Old Testament'
                            : 'New Testament'}
                        </span>
                      </div>
                      <p className="verse-text text-gray-800 leading-relaxed text-sm">
                        {highlightText(result.text, debouncedQuery)}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Chapter View ────────────────────────────────────────────────────────────
function ChapterView({ bookName, chapterNum }: { bookName: string; chapterNum: number }) {
  const [verses, setVerses] = useState<KJVVerseEntry[]>([]);
  const [allChapters, setAllChapters] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [optimisticBookmarks, setOptimisticBookmarks] = useState<Set<string>>(new Set());
  const [highlightedVerse, setHighlightedVerse] = useState<number | null>(null);
  const [copiedVerse, setCopiedVerse] = useState<number | null>(null);

  // Capture scroll target synchronously at mount time.
  // _pendingScrollVerse is set by search result clicks (before navigation) to avoid
  // a race where cached data makes the effect fire before history.pushState sets the hash.
  // Falls back to window.location.hash for direct URL / bookmark navigation.
  const [scrollTarget] = useState<number | null>(() => {
    if (_pendingScrollVerse !== null) {
      const t = _pendingScrollVerse;
      _pendingScrollVerse = null;
      return t;
    }
    const hash = window.location.hash;
    if (!hash.startsWith('#v')) return null;
    const n = parseInt(hash.slice(2), 10);
    return isNaN(n) ? null : n;
  });

   // Compute book identity for URL resolution (plain variables, safe before hooks)
   const isOldTestament = BIBLE_BOOKS.find(b => b.name === bookName)?.testament === 'old';
   const internalAbbr = Object.entries(BOOK_ABBR_MAP).find(([, info]) => info.name === bookName)?.[0];

   useEffect(() => {
     setLoading(true);
     Promise.all([
       getKJVChapter(bookName, chapterNum),
       getKJVChapterList(bookName),
     ]).then(([v, c]) => {
       setVerses(v);
       setAllChapters(c);
       setLoading(false);
     });
   }, [bookName, chapterNum]);

  // Scroll to and highlight the target verse once data is loaded
  useEffect(() => {
    if (loading || verses.length === 0 || scrollTarget === null) return;
    setHighlightedVerse(scrollTarget);
    const el = document.getElementById(verseAnchorId(scrollTarget));
    if (el) {
      const navHeight = document.querySelector('nav')?.getBoundingClientRect().height ?? 80;
      const top = el.getBoundingClientRect().top + window.scrollY - navHeight - 16;
      window.scrollTo({ top, behavior: 'smooth' });
    }
    const timer = setTimeout(() => setHighlightedVerse(null), 2500);
    return () => clearTimeout(timer);
  }, [loading, verses, scrollTarget]);

  const [bookmarkData] = useMyBookmarks();
  const { mutate: doCreateBookmark } = useCreateBookmarkMutation();
  const { mutate: doRemoveBookmark } = useRemoveBookmarkMutation();

  const bookmarks = bookmarkData ?? [];
  const bookmarkRefToId = new Map(bookmarks.map(b => [b.reference, b.id]));
  // Merge server bookmarks with optimistic additions
  const bookmarkedRefs = new Set([
    ...bookmarks.map(b => b.reference),
    ...optimisticBookmarks,
  ]);

  function handleBookmarkToggle(reference: string) {
    const existingId = bookmarkRefToId.get(reference);
    if (bookmarkedRefs.has(reference) && !optimisticBookmarks.has(reference)) {
      // Remove bookmark
      setOptimisticBookmarks(prev => { const next = new Set(prev); next.delete(reference); return next; });
      if (existingId) {
        doRemoveBookmark({ bookmark: existingId }).catch(() => {
          // revert on error
        });
      }
    } else if (!bookmarkedRefs.has(reference)) {
      // Add bookmark optimistically
      setOptimisticBookmarks(prev => new Set([...prev, reference]));
      doCreateBookmark({ reference }).catch(() => {
        setOptimisticBookmarks(prev => { const next = new Set(prev); next.delete(reference); return next; });
      });
    } else {
      // was optimistic add, toggle off
      setOptimisticBookmarks(prev => { const next = new Set(prev); next.delete(reference); return next; });
    }
  }

  // Strong's concordance state
  const [strongsEnabled, setStrongsEnabled] = useState(() => {
    try { return localStorage.getItem('kjv-strongs-enabled') === '1'; } catch { return false; }
  });
  // Cache: verse reference → word data
  const [strongsCache, setStrongsCache] = useState<Map<string, Array<{ token: string; strongs: StrongsEntry | null }>>>(new Map());
  const [strongsLoading, setStrongsLoading] = useState(false);
  // Active popover: {reference, wordIndex, entry}
  const [activePopover, setActivePopover] = useState<{ ref: string; idx: number; entry: StrongsEntry; rect: DOMRect } | null>(null);
  const closePopoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load Strong's data when enabled and verses are ready
  useEffect(() => {
    if (!strongsEnabled || loading || verses.length === 0) return;
    const chapterKey = `${bookName}.${chapterNum}`;
    const allCached = verses.every(v => strongsCache.has(v.reference));
    if (allCached) return;
    setStrongsLoading(true);
    Promise.all(
      verses.map(v => {
        if (strongsCache.has(v.reference)) return Promise.resolve(null);
        return getVerseWordData(bookName, chapterNum, v.verse, v.text).then(data => ({ ref: v.reference, data }));
      })
    ).then(results => {
      setStrongsCache(prev => {
        const next = new Map(prev);
        for (const r of results) {
          if (r) next.set(r.ref, r.data);
        }
        return next;
      });
      setStrongsLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strongsEnabled, loading, verses]);

  function toggleStrongs() {
    const next = !strongsEnabled;
    setStrongsEnabled(next);
    try { localStorage.setItem('kjv-strongs-enabled', next ? '1' : '0'); } catch {}
  }

  // Interlinear (original language) state
  const [interlinearEnabled, setInterlinearEnabled] = useState(() => {
    try { return localStorage.getItem('kjv-interlinear-enabled') === '1'; } catch { return false; }
  });
  // Cache: verse number → original-language text
  const [interlinearCache, setInterlinearCache] = useState<Map<number, string>>(new Map());
  const [interlinearLoading, setInterlinearLoading] = useState(false);

  // Load interlinear data when enabled and verses are ready
  useEffect(() => {
    if (!interlinearEnabled || loading || verses.length === 0) return;
    const allCached = verses.every(v => interlinearCache.has(v.verse));
    if (allCached) return;
    setInterlinearLoading(true);
    getInterlinearChapter(bookName, chapterNum, verses.map(v => v.verse)).then(map => {
      setInterlinearCache(prev => {
        const next = new Map(prev);
        for (const [k, v] of map) next.set(k, v);
        return next;
      });
      setInterlinearLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interlinearEnabled, loading, verses]);

  function toggleInterlinear() {
    const next = !interlinearEnabled;
    setInterlinearEnabled(next);
    try { localStorage.setItem('kjv-interlinear-enabled', next ? '1' : '0'); } catch {}
  }

  // Per-word data for Layer 3 clickable interlinear words
  const [wordData, setWordData] = useState<Map<number, WordEntry[]>>(new Map());
  const [wordDataLoading, setWordDataLoading] = useState(false);

  useEffect(() => {
    if (!interlinearEnabled || loading || verses.length === 0) return;
    const abbr = internalAbbr;
    if (!abbr) return;
    setWordDataLoading(true);
    getInterlinearWordBook(abbr).then(bookMap => {
      const map = new Map<number, WordEntry[]>();
      for (const v of verses) {
        const key = `${abbr}.${chapterNum}.${v.verse}`;
        const words = bookMap[key];
        if (words) map.set(v.verse, words);
      }
      setWordData(map);
      setWordDataLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interlinearEnabled, loading, verses, internalAbbr, chapterNum]);

  // Active interlinear word popover
  const [activeWordPopover, setActiveWordPopover] = useState<{
    entry: WordEntry;
    rect: DOMRect;
  } | null>(null);

  function handleWordHover(entry: StrongsEntry, ref: string, idx: number, e: React.MouseEvent) {
    if (closePopoverTimerRef.current) clearTimeout(closePopoverTimerRef.current);
    setActivePopover({ ref, idx, entry, rect: (e.target as HTMLElement).getBoundingClientRect() });
  }

  function handleWordLeave() {
    closePopoverTimerRef.current = setTimeout(() => setActivePopover(null), 300);
  }

  function handlePopoverEnter() {
    if (closePopoverTimerRef.current) clearTimeout(closePopoverTimerRef.current);
  }

  // Set of references that have curated featured status (difficulty/theme metadata)
  const featuredRefs = new Set(KJV_VERSES.filter(v => v.book === bookName && v.chapter === chapterNum).map(v => v.reference));

  const bookmarkedInChapter = verses.filter(v => bookmarkedRefs.has(v.reference)).length;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="glassmorphism rounded-3xl p-8 shadow-xl">
        <div className="flex items-center gap-4 mb-4">
          <Link to={`/books/${encodeURIComponent(bookName)}`}>
            <button className="p-2 rounded-xl hover:bg-purple-100 transition-colors">
              <ArrowLeft className="w-6 h-6 text-purple-600" />
            </button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold gradient-text">{bookName} Chapter {chapterNum}</h1>
            <p className="text-sm text-gray-400">
              {verses.length} verse{verses.length !== 1 ? 's' : ''}
              {featuredRefs.size > 0 ? ` · ${featuredRefs.size} featured` : ''}
              {bookmarkedInChapter > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-purple-500 font-semibold">
                  <Star className="w-3 h-3" /> {bookmarkedInChapter} favorited
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Link to={`/books/${encodeURIComponent(bookName)}`}>
            <button className="btn-secondary text-white py-2 px-5 rounded-xl text-sm font-bold">
              <ArrowLeft className="inline w-4 h-4 mr-1" /> All Chapters
            </button>
          </Link>
          <button
            onClick={toggleStrongs}
            className={`py-2 px-4 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 ${
              strongsEnabled
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
                : 'glassmorphism text-gray-600 hover:shadow-md'
            }`}
            title="Toggle Strong's Concordance numbers"
          >
            <span className="font-serif text-base leading-none">{strongsEnabled ? 'α' : 'ג'}</span>
            Strong's {strongsEnabled ? 'On' : 'Off'}
          </button>
          <button
            onClick={toggleInterlinear}
            className={`py-2 px-4 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 ${
              interlinearEnabled
                ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md'
                : 'glassmorphism text-gray-600 hover:shadow-md'
            }`}
            title={`Toggle interlinear ${isOldTestament ? 'Hebrew' : 'Greek'} text`}
          >
            <span className="font-serif text-base leading-none">{isOldTestament ? 'ב' : 'λ'}</span>
            Interlinear {interlinearEnabled ? 'On' : 'Off'}
          </button>
        </div>
        {/* Prev / Next chapter navigation */}
        {(() => {
          const { prev, next } = getPrevNextChapter(bookName, chapterNum);
          return (
            <div className="flex items-center justify-between mt-3 gap-2">
              <Link to={buildChapterUrl(prev.book, prev.chapter)}>
                <button className="btn-secondary text-white py-2 px-5 rounded-xl text-sm font-bold">
                  <ArrowLeft className="inline w-4 h-4 mr-1" /> {prev.book} {prev.chapter}
                </button>
              </Link>
              <Link to={buildChapterUrl(next.book, next.chapter)}>
                <button className="btn-secondary text-white py-2 px-5 rounded-xl text-sm font-bold">
                  {next.book} {next.chapter} <ArrowRight className="inline w-4 h-4 ml-1" />
                </button>
              </Link>
            </div>
          );
        })()}
      </div>

      {/* All verses from kjv.txt */}
      {loading ? (
        <div className="glassmorphism rounded-2xl p-12 shadow-lg text-center">
          <Loader2 className="w-10 h-10 text-purple-400 mx-auto mb-3 animate-spin" />
          <p className="text-gray-500">Loading {bookName} {chapterNum}...</p>
        </div>
      ) : null}
      <div className="space-y-3">
        {verses.map((v) => {
          const isFeatured = featuredRefs.has(v.reference);
          return (
            <div
              key={v.reference}
              id={verseAnchorId(v.verse)}
              className={`glassmorphism rounded-2xl p-5 shadow-md transition-all duration-500 ${
                isFeatured ? 'border-2 border-purple-200' : ''
              } ${highlightedVerse === v.verse ? 'ring-4 ring-purple-400 ring-offset-2 bg-purple-50' : ''}`}
            >
              <div className="flex items-start gap-3">
                <span
                  onClick={() => {
                    const hash = `#v${v.verse}`;
                    history.replaceState(null, '', hash);
                    const el = document.getElementById(verseAnchorId(v.verse));
                    if (el) {
                      const navHeight = document.querySelector('nav')?.getBoundingClientRect().height ?? 80;
                      const top = el.getBoundingClientRect().top + window.scrollY - navHeight - 16;
                      window.scrollTo({ top, behavior: 'smooth' });
                    }
                    setHighlightedVerse(v.verse);
                    setTimeout(() => setHighlightedVerse(null), 2500);
                  }}
                  className="font-bold text-purple-500 text-sm min-w-[2.5rem] pt-0.5 cursor-pointer hover:text-purple-700 transition-colors"
                >{v.verse}</span>
                <div className="flex-1 min-w-0">
                  {strongsEnabled ? (
                    <p className="verse-text text-gray-800 leading-relaxed">
                      {strongsLoading && !strongsCache.has(v.reference) ? (
                        <span className="inline-block h-4 w-full bg-purple-100 rounded animate-pulse" />
                      ) : (
                        (strongsCache.get(v.reference) ?? [{ token: v.text, strongs: null }]).map((wd, wi) => (
                          <span key={wi} className="inline">
                            {wi > 0 ? ' ' : ''}
                            {wd.strongs ? (
                              <span
                                className="cursor-help underline decoration-dotted decoration-purple-400 hover:text-purple-700 transition-colors"
                                tabIndex={0}
                                onMouseEnter={e => handleWordHover(wd.strongs!, v.reference, wi, e)}
                                onMouseLeave={handleWordLeave}
                                onFocus={e => setActivePopover({ ref: v.reference, idx: wi, entry: wd.strongs!, rect: (e.target as HTMLElement).getBoundingClientRect() })}
                                onBlur={handleWordLeave}
                                onKeyDown={e => { if (e.key === 'Escape') setActivePopover(null); }}
                                onTouchEnd={e => {
                                  e.preventDefault();
                                  const isActive = activePopover?.ref === v.reference && activePopover?.idx === wi;
                                  if (isActive) { setActivePopover(null); } else {
                                    setActivePopover({ ref: v.reference, idx: wi, entry: wd.strongs!, rect: (e.target as HTMLElement).getBoundingClientRect() });
                                  }
                                }}
                              >
                                {wd.token}
                              </span>
                            ) : (
                              <span>{wd.token}</span>
                            )}
                          </span>
                        ))
                      )}
                    </p>
                  ) : (
                    <p className="verse-text text-gray-800 leading-relaxed">{v.text}</p>
                  )}
                  {interlinearEnabled && (
                    <div className="mt-2">
                      {/* Original language text */}
                      <div
                        dir={isOldTestament ? 'rtl' : 'ltr'}
                        lang={isOldTestament ? 'he' : 'el'}
                      >
                        {(wordDataLoading && !wordData.has(v.verse)) || (interlinearLoading && !interlinearCache.has(v.verse)) ? (
                          <span className="inline-block h-12 w-full bg-emerald-100 rounded animate-pulse" />
                        ) : wordData.has(v.verse) ? (
                          // Clickable word-by-word from STEPBible data
                          <span className="leading-loose" style={{ fontFamily: 'serif', fontSize: '3.5rem', lineHeight: '1.3' }}>
                            {wordData.get(v.verse)!.map((wordEntry, wi) => (
                              <span
                                key={wi}
                                className={`cursor-pointer rounded px-0.5 transition-colors hover:bg-emerald-700/30 ${
                                  activeWordPopover?.entry === wordEntry ? 'bg-emerald-700/30' : ''
                                } text-white`}
                                style={{ display: 'inline' }}
                                title="Click for word details"
                                onClick={e => {
                                  e.stopPropagation();
                                  if (activeWordPopover?.entry === wordEntry) {
                                    setActiveWordPopover(null);
                                  } else {
                                    setActiveWordPopover({ entry: wordEntry, rect: (e.target as HTMLElement).getBoundingClientRect() });
                                  }
                                }}
                              >
                                {wi > 0 ? ' ' : ''}{wordEntry[0]}
                              </span>
                            ))}
                          </span>
                        ) : interlinearCache.get(v.verse) ? (
                          // Fallback: plain text from WLC/TR if word data not available
                          <span
                            className="text-white leading-loose"
                            style={{ fontFamily: 'serif', fontSize: '3.5rem', lineHeight: '1.3', letterSpacing: '0.02em' }}
                          >
                            {interlinearCache.get(v.verse)}
                          </span>
                        ) : null}
                      </div>
                      {/* External study links */}
                      <div className="flex gap-2 mt-1.5 flex-wrap">
                        <a
                          href={stepBibleUrl(bookName, chapterNum, v.verse)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold transition-colors"
                          title="Open full interlinear in STEP Bible (free, no login)"
                        >
                          STEP Bible <ExternalLink className="w-3 h-3" />
                        </a>
                        <a
                          href={bibleHubInterlinearUrl(bookName, chapterNum, v.verse)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold transition-colors"
                          title="Word-by-word interlinear on BibleHub (free, no login)"
                        >
                          BibleHub <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleBookmarkToggle(v.reference)}
                  className="p-1.5 rounded-lg hover:bg-purple-50 transition-colors flex-shrink-0"
                  title={bookmarkedRefs.has(v.reference) ? 'Remove from favorites' : 'Add to favorites'}
                >
                  {bookmarkedRefs.has(v.reference)
                    ? <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    : <Star className="w-4 h-4 text-gray-400 hover:text-yellow-400" />
                  }
                </button>
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/kjv-ref/books/${encodeURIComponent(bookName)}/${chapterNum}#v${v.verse}`;
                    navigator.clipboard.writeText(url).then(() => {
                      setCopiedVerse(v.verse);
                      setTimeout(() => setCopiedVerse(null), 2000);
                    });
                  }}
                  className="p-1.5 rounded-lg hover:bg-purple-50 transition-colors flex-shrink-0"
                  title="Copy link to this verse"
                >
                  <LinkIcon className={`w-4 h-4 ${copiedVerse === v.verse ? 'text-green-500' : 'text-gray-400 hover:text-purple-400'}`} />
                </button>
                {isFeatured && (
                  <Link to={`/practice/${encodeURIComponent(v.reference)}`}>
                    <button className="btn-primary text-white py-1.5 px-3 rounded-lg text-xs font-bold whitespace-nowrap flex-shrink-0 flex items-center gap-1">
                      <Dumbbell className="w-3 h-3" /> Practice
                    </button>
                  </Link>
                )}
              </div>
              {isFeatured && (
                <div className="mt-2 ml-10">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-semibold inline-flex items-center gap-1">
                    <Star className="w-3 h-3" /> Featured
                  </span>
                </div>
              )}
            </div>
          );
        })}
        {verses.length === 0 && (
          <div className="glassmorphism rounded-2xl p-12 shadow-lg text-center">
            <p className="text-gray-400">No verses found for {bookName} {chapterNum}</p>
          </div>
        )}
      </div>

      {/* Chapter navigation */}
      {allChapters.length > 0 && (
        <div className="glassmorphism rounded-2xl p-6 shadow-lg">
          <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
            <Hash className="w-5 h-5 text-purple-500" /> Jump to Chapter
          </h3>
          <div className="flex flex-wrap gap-2">
            {allChapters.map((ch) => (
              <Link key={ch} to={`/books/${encodeURIComponent(bookName)}/${ch}`}>
                <button className={`w-10 h-10 rounded-lg text-sm font-bold transition-all ${
                  ch === chapterNum
                    ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg'
                    : 'glassmorphism text-gray-600 hover:shadow-md'
                }`}>
                  {ch}
                </button>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Interlinear word popover */}
      {activeWordPopover && createPortal(
        <InterlinearWordPopover
          entry={activeWordPopover.entry}
          isHebrew={isOldTestament}
          onClose={() => setActiveWordPopover(null)}
          style={{
            position: 'fixed',
            top: activeWordPopover.rect.bottom + 4,
            left: Math.min(activeWordPopover.rect.left, window.innerWidth - 296),
            zIndex: 9999,
          }}
        />,
        document.body
      )}

      {/* Strong's popover — rendered in a portal so it escapes backdrop-filter stacking contexts */}
      {activePopover && createPortal(
        <div
          style={{
            position: 'fixed',
            top: activePopover.rect.bottom + 4,
            left: Math.min(activePopover.rect.left, window.innerWidth - 296),
            zIndex: 9999,
          }}
          onMouseEnter={handlePopoverEnter}
          onMouseLeave={handleWordLeave}
        >
          <StrongsPopover entry={activePopover.entry} onClose={() => setActivePopover(null)} />
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── Book Detail View ─────────────────────────────────────────────────────────
function BookDetailView({ bookName }: { bookName: string }) {
  const book = BIBLE_BOOKS.find(b => b.name === bookName);
  const bookVerses = getVersesByBook(bookName);

  if (!book) {
    return (
      <div className="text-center py-20 glassmorphism rounded-3xl">
        <p className="text-2xl font-bold text-gray-400">Book not found</p>
        <Link to="/books">
          <button className="mt-4 btn-primary text-white py-3 px-6 rounded-xl font-bold">Back to Books</button>
        </Link>
      </div>
    );
  }

  const chaptersWithVerses = new Set(bookVerses.map(v => v.chapter));

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="glassmorphism rounded-3xl p-8 shadow-xl">
        <div className="flex items-center gap-4 mb-4">
          <Link to="/books">
            <button className="p-2 rounded-xl hover:bg-purple-100 transition-colors">
              <ArrowLeft className="w-6 h-6 text-purple-600" />
            </button>
          </Link>
          <div className={`p-4 rounded-2xl shadow-lg ${
            book.testament === 'old'
              ? 'bg-gradient-to-br from-amber-400 to-orange-500'
              : 'bg-gradient-to-br from-blue-400 to-indigo-600'
          }`}>
            <BookOpen className="w-10 h-10 text-white" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-semibold uppercase tracking-wide">
              {book.testament === 'old' ? 'Old' : 'New'} Testament
            </p>
            <h1 className="text-4xl font-bold gradient-text">{book.name}</h1>
            <p className="text-gray-500">{book.chapters} chapters · {bookVerses.length} featured verse{bookVerses.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex gap-3 flex-wrap mt-4">
          <Link to="/books">
            <button className="btn-secondary text-white py-2 px-5 rounded-xl text-sm font-bold">
              <ArrowLeft className="inline w-4 h-4 mr-1" /> All Books
            </button>
          </Link>
          <Link to="/practice">
            <button className="btn-primary text-white py-2 px-5 rounded-xl text-sm font-bold">
              <Dumbbell className="inline w-4 h-4 mr-1" /> Practice All Verses
            </button>
          </Link>
        </div>
      </div>

      {/* Chapters Grid */}
      <div className="glassmorphism rounded-2xl p-6 shadow-xl">
        <h2 className="text-2xl font-bold gradient-text mb-5 flex items-center gap-2">
          <Hash className="w-6 h-6 text-purple-500" /> Browse Chapters
        </h2>
        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
          {Array.from({ length: book.chapters }, (_, i) => i + 1).map((ch) => {
            const hasFeatured = chaptersWithVerses.has(ch);
            return (
              <Link key={ch} to={`/books/${encodeURIComponent(book.name)}/${ch}`}>
                <button className={`w-full aspect-square rounded-xl text-sm font-bold transition-all hover:scale-105 ${
                  hasFeatured
                    ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg'
                    : 'glassmorphism text-gray-600 hover:shadow-md'
                }`}>
                  {ch}
                </button>
              </Link>
            );
          })}
        </div>
        <p className="text-xs text-gray-500 mt-3 flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-purple-500 inline-block"></span>
          Chapters with featured verses
        </p>
      </div>

      {/* Featured Verses for this book */}
      {bookVerses.length > 0 && (
        <div className="glassmorphism rounded-2xl p-6 shadow-xl">
          <h2 className="text-2xl font-bold gradient-text mb-5 flex items-center gap-2">
            <Star className="w-6 h-6 text-yellow-500" /> Featured Verses
          </h2>
          <div className="grid gap-4">
            {bookVerses.map((verse) => (
              <div key={verse.reference} className="verse-card rounded-xl p-5 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-bold text-purple-600">{verse.reference}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      verse.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                      verse.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>{verse.difficulty}</span>
                  </div>
                  <p className="verse-text text-gray-700 italic text-sm leading-relaxed">"{verse.text}"</p>
                </div>
                <Link to={`/practice/${encodeURIComponent(verse.reference)}`}>
                  <button className="btn-primary text-white py-2 px-4 rounded-lg text-sm font-bold whitespace-nowrap flex-shrink-0">
                    Practice
                  </button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Books Grid (main list) ───────────────────────────────────────────────────
function BooksGrid() {
  const [view, setView] = useState<'grid' | 'search'>('grid');
  const [testamentFilter, setTestamentFilter] = useState<'all' | 'old' | 'new'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredBooks = BIBLE_BOOKS.filter(book => {
    const matchesTestament = testamentFilter === 'all' || book.testament === testamentFilter;
    const matchesSearch = book.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTestament && matchesSearch;
  });

  const booksWithVerses = new Set(KJV_VERSES.map(v => v.book));

  // When switching back to grid, reset search state
  const handleNavigateAway = useCallback(() => {
    setView('grid');
  }, []);

  if (view === 'search') {
    return (
      <div className="space-y-4 animate-fade-in pb-12">
        {/* Tab header */}
        <div className="glassmorphism rounded-2xl p-3 shadow-lg flex gap-2">
          <button
            onClick={() => setView('grid')}
            className="flex-1 py-2 px-4 rounded-xl text-sm font-semibold transition-all glassmorphism text-gray-600 hover:shadow-md flex items-center justify-center gap-2"
          >
            <BookOpen className="w-4 h-4" /> All Books
          </button>
          <button
            className="flex-1 py-2 px-4 rounded-xl text-sm font-semibold transition-all bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md flex items-center justify-center gap-2"
          >
            <Search className="w-4 h-4" /> Search
          </button>
        </div>
        <SearchPanel onNavigateAway={handleNavigateAway} />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Tab header */}
      <div className="glassmorphism rounded-2xl p-3 shadow-lg flex gap-2">
        <button
          className="flex-1 py-2 px-4 rounded-xl text-sm font-semibold transition-all bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md flex items-center justify-center gap-2"
        >
          <BookOpen className="w-4 h-4" /> All Books
        </button>
        <button
          onClick={() => setView('search')}
          className="flex-1 py-2 px-4 rounded-xl text-sm font-semibold transition-all glassmorphism text-gray-600 hover:shadow-md flex items-center justify-center gap-2"
        >
          <Search className="w-4 h-4" /> Search
        </button>
      </div>

      {/* Header */}
      <div className="text-center glassmorphism rounded-3xl p-8 shadow-xl">
        <div className="inline-block p-4 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-xl mb-4">
          <BookOpen className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-4xl font-bold gradient-text mb-3">Browse Bible Books</h1>
        <p className="text-gray-600 text-lg">Explore all 66 books of the Holy Bible</p>
        <p className="text-sm text-purple-600 font-semibold mt-2">
          {booksWithVerses.size} books have featured verses
        </p>
      </div>

      {/* Search and Filter */}
      <div className="glassmorphism rounded-2xl p-6 shadow-lg">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search books..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none bg-white/70"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'old', 'new'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setTestamentFilter(filter)}
                className={`px-5 py-3 rounded-xl font-semibold transition-all shadow-md ${
                  testamentFilter === filter
                    ? filter === 'all' ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white'
                      : filter === 'old' ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white'
                      : 'bg-gradient-to-r from-blue-400 to-indigo-600 text-white'
                    : 'glassmorphism text-gray-700 hover:shadow-lg'
                }`}
              >
                {filter === 'all' ? 'All' : filter === 'old' ? 'Old Testament' : 'New Testament'}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-3">Showing {filteredBooks.length} of {BIBLE_BOOKS.length} books</p>
      </div>

      {/* Books Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredBooks.map((book) => {
          const hasFeatured = booksWithVerses.has(book.name);
          const featuredCount = KJV_VERSES.filter(v => v.book === book.name).length;
          return (
            <Link key={book.name} to={`/books/${encodeURIComponent(book.name)}`}>
              <div className={`glassmorphism rounded-2xl p-6 card-hover cursor-pointer ${hasFeatured ? 'border-2 border-purple-100' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl shadow-lg ${
                      book.testament === 'old'
                        ? 'bg-gradient-to-br from-amber-400 to-orange-500'
                        : 'bg-gradient-to-br from-blue-400 to-indigo-600'
                    }`}>
                      <BookOpen className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{book.name}</h3>
                      <p className="text-sm text-gray-500">{book.chapters} chapters</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {hasFeatured && (
                      <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700 font-semibold flex items-center gap-1">
                        <Star className="w-3 h-3" /> {featuredCount} verse{featuredCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─── Books (router) ───────────────────────────────────────────────────────────
function Books() {
  const params = useParams();
  const { book, chapter } = params as { book?: string; chapter?: string };

  if (book && chapter) {
    const bookName = decodeURIComponent(book);
    const chapterNum = parseInt(chapter, 10);
    return <ChapterView bookName={bookName} chapterNum={chapterNum} />;
  }

  if (book) {
    const bookName = decodeURIComponent(book);
    return <BookDetailView bookName={bookName} />;
  }

  return <BooksGrid />;
}

export default Books;
