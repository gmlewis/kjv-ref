import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useMyProgress, useDueReviews, useMyBookmarks, useCreateSessionMutation, useAwardAchievementMutation, useUpdateProgressMutation, useUpsertReviewScheduleMutation, useUpdateDailyGoalMutation, useSetClozeLevelMutation } from '../hooks';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CheckCircle, XCircle, RotateCcw, Sparkles, Zap, Target,
  Award, BookOpen, ArrowLeft, ChevronRight, Shuffle, Filter,
  Minus, Trophy, Layers, AlignLeft, Eye, Hash, Star, X,
} from 'lucide-react';
import { parseVerseRef, parseVerseRangeRef } from '../utils/urlHelpers';
import { BIBLE_BOOKS } from '../utils/bibleBooks';

const BOOK_ORDER = new Map(BIBLE_BOOKS.map((b, i) => [b.name, i]));

import { KJV_VERSES, type KJVVerse } from '../data/kjv-verses';
import { getKJVVerse } from '../data/kjv-bible';
import { extractKeywords, assessDifficulty } from '../utils/spacedRepetition';
import {
  buildWordBank, checkWordBankAnswer,
  toFirstLetters,
  getVanishingClozeLevel, applyVanishingCloze, getVanishingClozeAnswers, getVanishingClozeMask, firstLetterOf,
  diffWords, type DiffToken,
} from '../utils/practiceHelpers';

type PracticeMode = 'word-bank' | 'first-letters' | 'simplified-vanishing-cloze' | 'vanishing-cloze' | 'multiple-choice' | 'reference' | 'recall';
type PerformanceRating = 'excellent' | 'good' | 'poor';

const MODE_INFO: Record<PracticeMode, { label: string; description: string; icon: any; badge?: string; highlight?: boolean }> = {
  'word-bank':                 { label: 'Word Bank',                 description: 'Tap the shuffled words into the correct order',        icon: Layers,    badge: 'Tap to order',   highlight: true },
  'first-letters':             { label: 'First Letters',             description: 'Each word shown as its first letter only — fill in the rest', icon: AlignLeft, badge: 'Hint-guided',    highlight: true },
  'simplified-vanishing-cloze':{ label: 'Simplified Vanishing Cloze', description: 'Blanks grow with mastery — type just the first letter of each blanked word', icon: Eye, badge: 'Adapts to you',  highlight: true },
  'vanishing-cloze':           { label: 'Vanishing Cloze',           description: 'Blanks increase as your mastery grows',                icon: Eye,       badge: 'Adapts to you',  highlight: true },
  'multiple-choice':           { label: 'Multiple Choice',           description: 'Select the correct verse text from four options',       icon: Award,     badge: undefined },
  'reference':                 { label: 'Reference Match',           description: 'Identify the correct reference for a verse',           icon: BookOpen,  badge: undefined },
  'recall':                    { label: 'Full Recall',               description: 'Type the complete verse from memory',                  icon: Target,    badge: 'Advanced' },
};

// Fisher–Yates shuffle using JavaScript's built-in Math.random().
// Used for multiple-choice / reference options where we want a genuinely
// random order (not a stable per-seed order) — the correct answer should land
// in a different slot each verse and each session.
function shuffleWithMathRandom<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Seeded shuffle — stable per seed. Used for Word Bank / Vanishing Cloze,
// which need a deterministic order that stays the same while the user is
// interacting with a given verse.
function seededShuffle<T>(arr: T[], seed: number): T[] {
  // Mix the seed so adjacent seeds land in different PRNG states
  let s = (seed ^ 0x9e3779b9) >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function normalizeText(t: string) {
  return t.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
}

function scoreRecall(input: string, target: string): number {
  const inputWords = normalizeText(input).split(' ');
  const targetWords = normalizeText(target).split(' ');
  if (targetWords.length === 0) return 0;
  let matches = 0;
  targetWords.forEach((w, i) => { if (inputWords[i] === w) matches++; });
  return Math.round((matches / targetWords.length) * 100);
}

// ─── Session Summary ──────────────────────────────────────────────────────────
function SessionSummary({
  score, total, mode, onRestart, onNewMode,
}: { score: number; total: number; mode: PracticeMode; onRestart: () => void; onNewMode: () => void }) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const grade = pct >= 90 ? 'Excellent!' : pct >= 70 ? 'Great job!' : pct >= 50 ? 'Good effort!' : 'Keep practicing!';
  return (
    <div className="glassmorphism rounded-3xl p-10 shadow-2xl text-center animate-fade-in">
      <div className="inline-block p-5 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 shadow-xl mb-6 animate-float">
        <Trophy className="w-14 h-14 text-white" />
      </div>
      <h2 className="text-4xl font-bold gradient-text mb-2">Session Complete!</h2>
      <p className="text-gray-600 text-xl mb-8">{grade}</p>
      <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto mb-8">
        <div className="glassmorphism rounded-xl p-4"><p className="text-3xl font-bold gradient-text">{pct}%</p><p className="text-xs text-gray-500 mt-1">Score</p></div>
        <div className="glassmorphism rounded-xl p-4"><p className="text-3xl font-bold gradient-text">{score}</p><p className="text-xs text-gray-500 mt-1">Correct</p></div>
        <div className="glassmorphism rounded-xl p-4"><p className="text-3xl font-bold gradient-text">{total}</p><p className="text-xs text-gray-500 mt-1">Total</p></div>
      </div>
      <div className="flex gap-4 justify-center flex-wrap">
        <button onClick={onRestart} className="btn-primary text-white py-3 px-8 rounded-xl font-bold shadow-lg flex items-center gap-2">
          <RotateCcw className="w-5 h-5" /> Practice Again
        </button>
        <button onClick={onNewMode} className="btn-secondary py-3 px-8 rounded-xl font-bold flex items-center gap-2">
          <Shuffle className="w-5 h-5" /> Change Mode
        </button>
        <Link to="/"><button className="glassmorphism py-3 px-8 rounded-xl font-bold text-gray-700 hover:shadow-lg transition-all">Dashboard</button></Link>
      </div>
    </div>
  );
}

// ─── Word Bank Mode ───────────────────────────────────────────────────────────
function WordBankMode({ verse, seed, onResult }: { verse: KJVVerse; seed: number; onResult: (correct: boolean) => void }) {
  const bank = useMemo(() => buildWordBank(verse.text, seed), [verse, seed]);
  const [placed, setPlaced] = useState<string[]>([]);
  const [available, setAvailable] = useState<string[]>(bank);
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(false);

  const tapAvailable = (i: number) => {
    if (checked) return;
    const word = available[i];
    setAvailable(a => a.filter((_, idx) => idx !== i));
    setPlaced(p => [...p, word]);
  };

  const tapPlaced = (i: number) => {
    if (checked) return;
    const word = placed[i];
    setPlaced(p => p.filter((_, idx) => idx !== i));
    setAvailable(a => [...a, word]);
  };

  const handleCheck = () => {
    const isCorrect = checkWordBankAnswer(placed, verse.text);
    setCorrect(isCorrect);
    setChecked(true);
    onResult(isCorrect);
  };

  return (
    <div className="space-y-4">
      <p className="text-gray-500 italic text-sm">Tap words in the correct order to build the verse:</p>

      {/* Answer zone */}
      <div className={`min-h-20 p-4 rounded-xl border-2 transition-all ${
        !checked ? 'border-purple-200 bg-purple-50/50' :
        correct ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50'
      }`}>
        {placed.length === 0 ? (
          <p className="text-gray-400 text-sm italic">Tap words below to place them here...</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {placed.map((w, i) => (
              <button
                key={i}
                onClick={() => tapPlaced(i)}
                disabled={checked}
                className="px-3 py-1.5 bg-purple-500 text-white rounded-lg text-sm font-semibold shadow-sm hover:bg-purple-600 transition-colors disabled:cursor-default"
              >
                {w}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Word bank */}
      {!checked && (
        <div className="flex flex-wrap gap-2 p-4 glassmorphism rounded-xl">
          {available.map((w, i) => (
            <button
              key={i}
              onClick={() => tapAvailable(i)}
              className="px-3 py-1.5 bg-white border-2 border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:border-purple-400 hover:bg-purple-50 transition-all shadow-sm"
            >
              {w}
            </button>
          ))}
          {available.length === 0 && <p className="text-gray-400 text-sm italic">All words placed!</p>}
        </div>
      )}

      {/* Feedback */}
      {checked && (
        <div className={`p-4 rounded-xl flex items-start gap-3 ${correct ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          {correct ? <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" /> : <XCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />}
          <div>
            <p className="font-bold">{correct ? 'Perfect order!' : 'Not quite right'}</p>
            {!correct && <p className="text-sm text-gray-600 mt-1 italic">"{verse.text}"</p>}
          </div>
        </div>
      )}

      {!checked && (
        <button
          onClick={handleCheck}
          disabled={placed.length !== bank.length}
          className="w-full btn-primary text-white py-4 rounded-xl font-bold text-lg shadow-lg disabled:opacity-50"
        >
          Check Answer
        </button>
      )}
    </div>
  );
}

// ─── First Letters Mode ───────────────────────────────────────────────────────
// Tap-to-reveal: each word shows only its first letter as a chip.
// Tap a chip to reveal the word. Self-rate when done — no typing required.
function FirstLettersMode({ verse, onResult }: { verse: KJVVerse; onResult: (correct: boolean) => void }) {
  const words = useMemo(() => verse.text.split(' '), [verse]);
  const [revealed, setRevealed] = useState<boolean[]>(() => Array(words.length).fill(false));
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<boolean | null>(null);

  const allRevealed = revealed.every(Boolean);

  const revealWord = (i: number) => {
    if (done) return;
    setRevealed(r => { const n = [...r]; n[i] = true; return n; });
  };

  const revealAll = () => {
    if (done) return;
    setRevealed(Array(words.length).fill(true));
  };

  const handleResult = (correct: boolean) => {
    setResult(correct);
    setDone(true);
    onResult(correct);
  };

  // Extract the first letter (after any leading punctuation) plus any trailing punctuation
  function chipLabel(word: string): string {
    const m = word.match(/^([^a-zA-Z]*)([a-zA-Z])(.*)$/);
    if (!m) return word[0]?.toUpperCase() ?? '?';
    const trailing = m[3].replace(/[a-zA-Z]/g, ''); // keep only trailing punctuation
    return m[1] + m[2].toUpperCase() + trailing;
  }

  return (
    <div className="space-y-5">
      <p className="text-gray-500 italic text-sm">
        Tap each chip to reveal the word. Recall the verse as you go, then rate yourself.
      </p>

      {/* Word chip grid */}
      <div className="verse-card rounded-xl p-5 bg-gradient-to-br from-indigo-50 to-purple-50">
        <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">
          First letters — tap to reveal:
        </p>
        <div className="flex flex-wrap gap-2 leading-loose">
          {words.map((word, i) =>
            revealed[i] ? (
              <span key={i} className="verse-text text-gray-800 text-xl">{word}</span>
            ) : (
              <button
                key={i}
                onClick={() => revealWord(i)}
                disabled={done}
                className="px-3 py-1 bg-indigo-100 border-2 border-indigo-300 rounded-lg font-mono font-bold text-indigo-700 text-lg hover:bg-indigo-200 hover:border-indigo-500 active:scale-95 transition-all disabled:cursor-default min-w-[2.25rem] text-center"
              >
                {chipLabel(word)}
              </button>
            )
          )}
        </div>
      </div>

      {/* Actions */}
      {!done && (
        <div className="flex flex-wrap gap-3">
          {!allRevealed && (
            <button
              onClick={revealAll}
              className="px-5 py-3 glassmorphism rounded-xl font-bold text-gray-600 hover:shadow-md transition-all flex items-center gap-2"
            >
              <Eye className="w-5 h-5" /> Reveal All
            </button>
          )}
          <button
            onClick={() => handleResult(true)}
            className="flex-1 btn-primary text-white py-3 px-5 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-5 h-5" /> Got it!
          </button>
          <button
            onClick={() => handleResult(false)}
            className="flex-1 py-3 px-5 rounded-xl font-bold border-2 border-orange-300 text-orange-600 hover:bg-orange-50 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-5 h-5" /> Still learning
          </button>
        </div>
      )}

      {/* Post-result feedback */}
      {done && result !== null && (
        <div className={`p-4 rounded-xl flex items-center gap-3 ${
          result ? 'bg-green-50 border border-green-200' : 'bg-orange-50 border border-orange-200'
        }`}>
          {result
            ? <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
            : <RotateCcw className="w-6 h-6 text-orange-500 flex-shrink-0" />
          }
          <p className="font-bold">
            {result ? 'Great recall! Keep it up.' : 'Marked for more practice — you\'ll get it!'}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Simplified Vanishing Cloze Mode ─────────────────────────────────────────
// Same progressive-blanking scheme as Vanishing Cloze, but the user only types
// the FIRST LETTER of each blanked word into a small inline input. Pressing
// '?' in any input reveals that word and marks it incorrect. Keyboard
// shortcuts (⌘/Ctrl+Enter) are intentionally disabled in this mode.
function SimplifiedVanishingClozeMode({
  verse, timesRecited, customClozeLevel, seed, onResult, onLevelChange,
}: {
  verse: KJVVerse;
  timesRecited: number;
  customClozeLevel: 0 | 1 | 2 | 3 | 4 | null | undefined;
  seed: number;
  onResult: (correct: boolean) => void;
  onLevelChange: (level: 0 | 1 | 2 | 3 | 4 | null) => void;
}) {
  const autoLevel = getVanishingClozeLevel(timesRecited) as 0 | 1 | 2 | 3 | 4;
  const level = (customClozeLevel ?? autoLevel) as 0 | 1 | 2 | 3 | 4;
  const isOverride = customClozeLevel != null && customClozeLevel !== autoLevel;

  const words = useMemo(() => verse.text.split(' '), [verse]);
  const mask = useMemo(() => getVanishingClozeMask(verse.text, level, seed), [verse, level, seed]);
  const blankIndices = useMemo(() => mask.map((b, i) => b ? i : -1).filter(i => i >= 0), [mask]);

  // One-letter entry per blank. '' = empty, '?' = revealed (auto-incorrect).
  const [entries, setEntries] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState(false);
  // Per-blank result after check: 'correct' | 'wrong' | 'revealed'
  const [results, setResults] = useState<Record<number, 'correct' | 'wrong' | 'revealed'>>({});

  // Refs for auto-advancing focus between inputs.
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Reset state when verse / level changes.
  useEffect(() => {
    setEntries({});
    setChecked(false);
    setResults({});
    inputRefs.current = [];
    // Auto-focus the first blank input so keystrokes go to the input (not
    // the window, where global shortcuts like '?' / '/' / 'g' / 't' would
    // fire). Re-run when the verse/level changes so a fresh verse grabs
    // focus immediately.
    const t = setTimeout(() => {
      const firstIdx = blankIndices[0];
      if (firstIdx != null) inputRefs.current[firstIdx]?.focus();
    }, 0);
    return () => clearTimeout(t);
  }, [verse.reference, level, seed, blankIndices]);

  // Disable ALL global keyboard shortcuts while this mode is mounted.
  // The user interacts purely via the inline single-letter inputs, so any
  // keypress that isn't on an input must be swallowed (otherwise '?',
  // '/', 'g', 't', 'Home', 'End', ⌘/Ctrl+Enter, etc. would trigger nav
  // actions / open the shortcuts modal). Capture phase lets us intercept
  // before the bubble-phase handlers in Navigation.tsx / KeyboardModals.tsx.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // If focus is inside one of our inputs, let its React onKeyDown handle
      // it normally — but still swallow the global shortcut keys so they
      // don't double-fire (e.g. '?' would both reveal the word AND open the
      // shortcuts modal).
      const target = e.target as HTMLElement | null;
      const inOurInput = !!target && target.tagName === 'INPUT' &&
        (target as HTMLElement).closest('[data-svc-mode]') != null;

      // Global shortcut keys defined in Navigation.tsx + KeyboardModals.tsx:
      // '?', '/', 'g', 't', Home, End, and ⌘/Ctrl+Enter / ⌘/Ctrl+K.
      // We always suppress these in this mode. For all other keys we only
      // suppress when the event target is NOT one of our inputs (so normal
      // typing inside an input still works).
      const isShortcutKey =
        e.key === '?' || e.key === '/' ||
        e.key === 'g' || e.key === 't' ||
        e.key === 'Home' || e.key === 'End' ||
        ((e.metaKey || e.ctrlKey) && (e.key === 'Enter' || e.key === 'k'));

      if (isShortcutKey) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (!inOurInput) {
        // Swallow every other key too, so e.g. pressing 'a' while focus is on
        // the card body doesn't accidentally trigger anything and we keep the
        // user "trapped" in the input flow. We do NOT preventDefault for
        // modifier-only / navigation keys that the browser needs.
        if (e.key.length === 1 || e.key === 'Backspace') {
          e.preventDefault();
          e.stopPropagation();
          // Refocus the first empty blank so the keystroke isn't lost.
          const firstEmpty = blankIndices.find(i => !(entries[i] ?? '') && results[i] !== 'revealed');
          const focusIdx = firstEmpty ?? blankIndices[0];
          if (focusIdx != null) inputRefs.current[focusIdx]?.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [blankIndices, entries, results]);

  const allFilled = blankIndices.every(i => (entries[i] ?? '').length > 0);

  const handleEntry = (idx: number, raw: string) => {
    if (checked) return;
    // Take only the first character typed.
    const ch = raw.length > 0 ? raw[raw.length - 1] : '';
    setEntries(prev => ({ ...prev, [idx]: ch }));
    // Auto-advance to next blank input.
    const pos = blankIndices.indexOf(idx);
    if (ch && pos >= 0 && pos < blankIndices.length - 1) {
      const nextIdx = blankIndices[pos + 1];
      inputRefs.current[nextIdx]?.focus();
    }
  };

  const handleKey = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (checked) return;
    // '?' reveals the word for this blank and marks it incorrect.
    if (e.key === '?') {
      e.preventDefault();
      setEntries(prev => ({ ...prev, [idx]: '?' }));
      setResults(prev => ({ ...prev, [idx]: 'revealed' }));
      const pos = blankIndices.indexOf(idx);
      if (pos >= 0 && pos < blankIndices.length - 1) {
        const nextIdx = blankIndices[pos + 1];
        inputRefs.current[nextIdx]?.focus();
      }
      return;
    }
    // Backspace on empty input moves focus back to the previous blank.
    if (e.key === 'Backspace' && (entries[idx] ?? '') === '') {
      const pos = blankIndices.indexOf(idx);
      if (pos > 0) {
        e.preventDefault();
        const prevIdx = blankIndices[pos - 1];
        inputRefs.current[prevIdx]?.focus();
      }
    }
  };

  const handleCheck = useCallback(() => {
    const nextResults: Record<number, 'correct' | 'wrong' | 'revealed'> = {};
    let allCorrect = true;
    for (const idx of blankIndices) {
      const entry = entries[idx] ?? '';
      if (entry === '?') {
        nextResults[idx] = 'revealed';
        allCorrect = false;
        continue;
      }
      const expected = firstLetterOf(words[idx]).toLowerCase();
      const got = entry.toLowerCase();
      if (got && got === expected) {
        nextResults[idx] = 'correct';
      } else {
        nextResults[idx] = 'wrong';
        allCorrect = false;
      }
    }
    setResults(nextResults);
    setChecked(true);
    onResult(allCorrect);
  }, [entries, words, blankIndices, onResult]);

  // Level selector (shared UI with Vanishing Cloze).
  const LevelSelector = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-slate-500 dark:text-slate-200 flex items-center gap-1">
        <Hash className="w-3 h-3" /> Level:
      </span>
      {([0, 1, 2, 3, 4] as const).map((lvl) => {
        const active = lvl === level;
        const isAuto = lvl === autoLevel;
        return (
          <button
            key={lvl}
            onClick={() => onLevelChange(lvl)}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
              active
                ? `${CLOZE_LEVEL_BG[lvl]} ${CLOZE_LEVEL_COLORS[lvl]} border-current shadow-sm`
                : 'bg-white text-gray-500 dark:bg-slate-800 dark:text-slate-300 border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-400'
            }`}
            title={isAuto ? `Level ${lvl} — ${CLOZE_LEVEL_LABELS[lvl]} (auto)` : `Level ${lvl} — ${CLOZE_LEVEL_LABELS[lvl]}`}
          >
            {lvl}{isAuto && !isOverride ? '·auto' : ''}
          </button>
        );
      })}
      {isOverride && (
        <button
          onClick={() => onLevelChange(null)}
          className="px-2 py-1 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/40 transition-colors"
          title="Reset to the auto-computed level based on practice count"
        >
          Reset to auto
        </button>
      )}
    </div>
  );

  // Level 0: study card — same as Vanishing Cloze.
  if (level === 0) {
    return (
      <div className="space-y-4">
        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold ${CLOZE_LEVEL_BG[0]} ${CLOZE_LEVEL_COLORS[0]}`}>
          <Hash className="w-3 h-3" /> Level 0 — {CLOZE_LEVEL_LABELS[0]}
        </div>
        {LevelSelector}
        <div className="verse-card rounded-xl p-6 bg-gradient-to-br from-blue-50 to-indigo-50">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-300 mb-3 uppercase tracking-wide">Read this verse:</p>
          <p className="verse-text text-xl text-gray-800 leading-relaxed italic">"{verse.text}"</p>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-300">Study this verse carefully. As you practice more, words will be hidden progressively.</p>
        <button
          onClick={() => { setChecked(true); onResult(true); }}
          className="w-full btn-primary text-white py-4 rounded-xl font-bold text-lg shadow-lg"
          disabled={checked}
        >
          Got it! <CheckCircle className="inline w-5 h-5 ml-2" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-svc-mode>
      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold ${CLOZE_LEVEL_BG[level]} ${CLOZE_LEVEL_COLORS[level]}`}>
        <Hash className="w-3 h-3" /> Level {level} — {CLOZE_LEVEL_LABELS[level]}{isOverride ? ' (override)' : ''}
      </div>
      {LevelSelector}

      {/* Blanked verse with inline single-letter inputs */}
      <div className="verse-card rounded-xl p-5 bg-gradient-to-br from-teal-50 to-emerald-50">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-300 mb-3 uppercase tracking-wide">
          Type the first letter of each blanked word:
        </p>
        <div ref={containerRef} className="flex flex-wrap gap-1.5 leading-loose items-center">
          {words.map((word, i) => {
            if (!mask[i]) {
              return <span key={i} className="verse-text text-xl text-gray-800">{word}</span>;
            }
            const entry = entries[i] ?? '';
            const res = results[i];
            let inputClass = 'border-2 border-teal-300 bg-teal-50 text-teal-700 focus:border-teal-600 focus:outline-none';
            if (checked) {
              if (res === 'correct') inputClass = 'border-2 border-green-400 bg-green-50 text-green-700';
              else if (res === 'wrong') inputClass = 'border-2 border-red-400 bg-red-50 text-red-700';
              else if (res === 'revealed') inputClass = 'border-2 border-orange-400 bg-orange-50 text-orange-700';
            }
            return (
              <span key={i} className="inline-flex flex-col items-center">
                <input
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  value={entry}
                  onChange={(e) => handleEntry(i, e.target.value)}
                  onKeyDown={(e) => handleKey(i, e)}
                  disabled={checked}
                  maxLength={1}
                  aria-label={`First letter of word ${i + 1}`}
                  className={`w-8 h-10 text-center text-xl font-bold rounded-lg ${inputClass} ${checked ? 'cursor-default' : ''}`}
                />
                {checked && (
                  <span className="text-xs font-semibold text-gray-600 mt-0.5">{words[i]}</span>
                )}
              </span>
            );
          })}
        </div>
        {!checked && blankIndices.length > 0 && (
          <p className="text-xs text-teal-600 dark:text-teal-300 font-semibold mt-3">
            {blankIndices.length} word{blankIndices.length !== 1 ? 's' : ''} hidden · press <kbd className="kbd-key inline">?</kbd> to reveal a word (marked incorrect)
          </p>
        )}
      </div>

      {!checked ? (
        <button
          onClick={handleCheck}
          disabled={!allFilled}
          className="w-full btn-primary text-white py-4 rounded-xl font-bold text-lg shadow-lg disabled:opacity-50"
        >
          Check Answer
        </button>
      ) : (
        <>
          {/* Per-blank summary */}
          <div className="p-4 rounded-xl bg-white border border-gray-200 dark:bg-slate-800 dark:border-slate-700">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-200 mb-3 uppercase tracking-wide">Your answers:</p>
            <div className="flex flex-wrap gap-2 leading-loose">
              {blankIndices.map(idx => {
                const res = results[idx];
                const expected = firstLetterOf(words[idx]).toUpperCase();
                const got = (entries[idx] ?? '').toUpperCase();
                const label = res === 'revealed' ? 'Revealed' : got || '—';
                const color = res === 'correct'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-200'
                  : res === 'revealed'
                  ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-200'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200';
                return (
                  <span key={idx} className={`px-2 py-0.5 rounded font-semibold text-sm ${color}`} title={`Expected first letter: ${expected}`}>
                    {label} → {words[idx]}
                  </span>
                );
              })}
            </div>
          </div>
          <div className={`p-4 rounded-xl flex items-center gap-3 ${
            blankIndices.every(i => results[i] === 'correct')
              ? 'bg-green-50 border border-green-200 dark:bg-green-900/40 dark:border-green-700'
              : 'bg-red-50 border border-red-200 dark:bg-red-900/40 dark:border-red-700'
          }`}>
            {blankIndices.every(i => results[i] === 'correct')
              ? <CheckCircle className="w-7 h-7 text-green-500 dark:text-green-400" />
              : <XCircle className="w-7 h-7 text-red-500 dark:text-red-400" />}
            <p className="font-bold text-gray-800 dark:text-slate-100">
              {blankIndices.every(i => results[i] === 'correct')
                ? 'Well done! All first letters correct.'
                : 'Some letters were wrong or revealed — keep practicing!'}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Vanishing Cloze Mode ─────────────────────────────────────────────────────
const CLOZE_LEVEL_LABELS = ['Study Mode', '25% hidden', '50% hidden', '75% hidden', 'Full Recall'] as const;
// Each entry: [light-text, dark-text, light-bg, dark-bg] for high contrast in both modes.
const CLOZE_LEVEL_COLORS = [
  'text-blue-600 dark:text-blue-300',
  'text-green-600 dark:text-green-300',
  'text-yellow-600 dark:text-yellow-300',
  'text-orange-600 dark:text-orange-300',
  'text-red-600 dark:text-red-300',
];
const CLOZE_LEVEL_BG = [
  'bg-blue-100 dark:bg-blue-900/50',
  'bg-green-100 dark:bg-green-900/50',
  'bg-yellow-100 dark:bg-yellow-900/50',
  'bg-orange-100 dark:bg-orange-900/50',
  'bg-red-100 dark:bg-red-900/50',
];

function VanishingClozeMode({
  verse, timesRecited, customClozeLevel, seed, onResult, onLevelChange,
}: {
  verse: KJVVerse;
  timesRecited: number;
  customClozeLevel: 0 | 1 | 2 | 3 | 4 | null | undefined;
  seed: number;
  onResult: (correct: boolean) => void;
  onLevelChange: (level: 0 | 1 | 2 | 3 | 4 | null) => void;
}) {
  const autoLevel = getVanishingClozeLevel(timesRecited) as 0 | 1 | 2 | 3 | 4;
  // User override takes precedence; falls back to the auto-computed level.
  const level = (customClozeLevel ?? autoLevel) as 0 | 1 | 2 | 3 | 4;
  const isOverride = customClozeLevel != null && customClozeLevel !== autoLevel;
  const blankedText = useMemo(() => applyVanishingCloze(verse.text, level, seed), [verse, level, seed]);
  const missingWords = useMemo(() => getVanishingClozeAnswers(verse.text, level, seed), [verse, level, seed]);

  const [userInput, setUserInput] = useState('');
  const [checked, setChecked] = useState(false);
  const [recallScore, setRecallScore] = useState<number | null>(null);
  const [diff, setDiff] = useState<DiffToken[]>([]);

  const handleCheck = useCallback(() => {
    const pct = scoreRecall(userInput, verse.text);
    setRecallScore(pct);
    setDiff(diffWords(userInput, verse.text));
    setChecked(true);
    onResult(pct >= 70);
  }, [userInput, verse, onResult]);

  // Cmd/Ctrl+Enter submits; also works for the Level 0 "Got it" button.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!checked && (level !== 0 ? userInput.trim() : true)) {
          handleCheck();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [checked, level, userInput, handleCheck]);

  // Level selector (0–4) shown for every level so the user can override.
  const LevelSelector = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-slate-500 dark:text-slate-200 flex items-center gap-1">
        <Hash className="w-3 h-3" /> Level:
      </span>
      {([0, 1, 2, 3, 4] as const).map((lvl) => {
        const active = lvl === level;
        const isAuto = lvl === autoLevel;
        return (
          <button
            key={lvl}
            onClick={() => onLevelChange(lvl)}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
              active
                ? `${CLOZE_LEVEL_BG[lvl]} ${CLOZE_LEVEL_COLORS[lvl]} border-current shadow-sm`
                : 'bg-white text-gray-500 dark:bg-slate-800 dark:text-slate-300 border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-400'
            }`}
            title={isAuto ? `Level ${lvl} — ${CLOZE_LEVEL_LABELS[lvl]} (auto)` : `Level ${lvl} — ${CLOZE_LEVEL_LABELS[lvl]}`}
          >
            {lvl}{isAuto && !isOverride ? '·auto' : ''}
          </button>
        );
      })}
      {isOverride && (
        <button
          onClick={() => onLevelChange(null)}
          className="px-2 py-1 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/40 transition-colors"
          title="Reset to the auto-computed level based on practice count"
        >
          Reset to auto
        </button>
      )}
    </div>
  );

  // Level 0: study card — just read and tap "Got it"
  if (level === 0) {
    return (
      <div className="space-y-4">
        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold ${CLOZE_LEVEL_BG[0]} ${CLOZE_LEVEL_COLORS[0]}`}>
          <Hash className="w-3 h-3" /> Level 0 — {CLOZE_LEVEL_LABELS[0]}
        </div>
        {LevelSelector}
        <div className="verse-card rounded-xl p-6 bg-gradient-to-br from-blue-50 to-indigo-50">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-300 mb-3 uppercase tracking-wide">Read this verse:</p>
          <p className="verse-text text-xl text-gray-800 leading-relaxed italic">"{verse.text}"</p>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-300">Study this verse carefully. As you practice more, words will be hidden progressively.</p>
        <button
          onClick={() => { setChecked(true); onResult(true); }}
          className="w-full btn-primary text-white py-4 rounded-xl font-bold text-lg shadow-lg"
          disabled={checked}
        >
          Got it! <CheckCircle className="inline w-5 h-5 ml-2" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold ${CLOZE_LEVEL_BG[level]} ${CLOZE_LEVEL_COLORS[level]}`}>
        <Hash className="w-3 h-3" /> Level {level} — {CLOZE_LEVEL_LABELS[level]}{isOverride ? ' (override)' : ''}
      </div>
      {LevelSelector}

      {/* Blanked verse */}
      <div className="verse-card rounded-xl p-5 bg-gradient-to-br from-purple-50 to-indigo-50">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-300 mb-3 uppercase tracking-wide">Fill in the blanks:</p>
        <p className="verse-text text-xl text-gray-800 leading-relaxed">{blankedText}</p>
        {!checked && missingWords.length > 0 && (
          <p className="text-xs text-purple-600 dark:text-purple-300 font-semibold mt-3">{missingWords.length} word{missingWords.length !== 1 ? 's' : ''} hidden</p>
        )}
      </div>

      {!checked ? (
        <>
          <textarea
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Type the complete verse, including the blanked words..."
            className="w-full p-5 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none resize-none verse-text text-lg shadow-inner bg-white/70"
            rows={level <= 2 ? 3 : 5}
          />
          <button
            onClick={handleCheck}
            disabled={!userInput.trim()}
            className="w-full btn-primary text-white py-4 rounded-xl font-bold text-lg shadow-lg disabled:opacity-50"
          >
            Check Answer <span className="text-xs font-normal opacity-80 ml-2">⌘/Ctrl+Enter</span>
          </button>
        </>
      ) : (
        <>
          {/* Word-by-word diff: green = correct, red = wrong, dashed = missing, gray = extra */}
          <div className="p-4 rounded-xl bg-white border border-gray-200 dark:bg-slate-800 dark:border-slate-700">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-200 mb-3 uppercase tracking-wide">Your answer vs. correct verse:</p>
            <div className="flex flex-wrap gap-1.5 leading-loose">
              {diff.map((tok, i) => {
                if (tok.type === 'correct') {
                  return <span key={i} className="px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-200 rounded font-semibold text-sm">{tok.word}</span>;
                }
                if (tok.type === 'wrong') {
                  return (
                    <span key={i} className="px-2 py-0.5 bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200 rounded font-semibold text-sm" title={`Expected: ${tok.expected}`}>
                      <span className="line-through opacity-70">{tok.word}</span>{' '}→{' '}{tok.expected}
                    </span>
                  );
                }
                if (tok.type === 'missing') {
                  return <span key={i} className="px-2 py-0.5 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/60 dark:text-yellow-100 rounded font-semibold text-sm border border-dashed border-yellow-400 dark:border-yellow-500/70">{tok.expected}</span>;
                }
                return <span key={i} className="px-2 py-0.5 bg-gray-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300 rounded text-sm line-through" title="Extra word not in the verse">{tok.word}</span>;
              })}
            </div>
            <div className="flex gap-4 mt-3 text-xs text-slate-500 dark:text-slate-200">
              <span><span className="inline-block w-3 h-3 bg-green-100 dark:bg-green-900/60 rounded mr-1 align-middle" />correct</span>
              <span><span className="inline-block w-3 h-3 bg-red-100 dark:bg-red-900/60 rounded mr-1 align-middle" />wrong</span>
              <span><span className="inline-block w-3 h-3 bg-yellow-100 dark:bg-yellow-900/60 rounded border border-dashed border-yellow-400 dark:border-yellow-500/70 mr-1 align-middle" />missing</span>
              <span><span className="inline-block w-3 h-3 bg-gray-100 dark:bg-slate-700 rounded mr-1 align-middle" />extra</span>
            </div>
          </div>
          {recallScore !== null && (
            <div className={`p-4 rounded-xl flex items-center gap-3 ${
              recallScore >= 70 ? 'bg-green-50 border border-green-200 dark:bg-green-900/40 dark:border-green-700' :
              recallScore >= 50 ? 'bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/40 dark:border-yellow-700' :
              'bg-red-50 border border-red-200 dark:bg-red-900/40 dark:border-red-700'
            }`}>
              {recallScore >= 70 ? <CheckCircle className="w-7 h-7 text-green-500 dark:text-green-400" /> :
               recallScore >= 50 ? <Minus className="w-7 h-7 text-yellow-500 dark:text-yellow-400" /> :
               <XCircle className="w-7 h-7 text-red-500 dark:text-red-400" />}
              <p className="font-bold text-gray-800 dark:text-slate-100">{recallScore >= 70 ? 'Well done!' : 'Keep going!'} ({recallScore}% match)</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Practice Session ─────────────────────────────────────────────────────────
function PracticeSession({
  verses, mode, progressMap, onComplete, onSetClozeLevel,
}: {
  verses: KJVVerse[];
  mode: PracticeMode;
  progressMap: Map<string, { timesRecited: number; customClozeLevel?: 0 | 1 | 2 | 3 | 4 | null }>;
  onComplete: (score: number, total: number, results: { verse: KJVVerse; correct: boolean; rating: PerformanceRating }[]) => void;
  onSetClozeLevel: (reference: string, level: 0 | 1 | 2 | 3 | 4 | null) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [recallScore, setRecallScore] = useState<number | null>(null);
  const [results, setResults] = useState<{ verse: KJVVerse; correct: boolean; rating: PerformanceRating }[]>([]);

  const verse = verses[idx];
  // Per-verse random seed used by Word Bank / Vanishing Cloze (which need a
  // stable shuffle while the user is interacting with the same verse).
  const seed = idx * 31 + 7;

  // Pool of distractor verses for multiple-choice / reference modes.
  // When the session itself has fewer than 4 verses (e.g. practicing a single
  // favourited verse), there aren't enough "other" verses to draw distractors
  // from, so the correct answer would be the only option shown. Fall back to
  // the full curated KJV_VERSES pool to fill out the choices.
  const distractorPool = useMemo(() => {
    if (verses.length >= 4) return verses;
    const sessionRefs = new Set(verses.map(v => v.reference));
    return [...verses, ...KJV_VERSES.filter(v => !sessionRefs.has(v.reference))];
  }, [verses]);

  // MC options — truly randomized with Math.random(), stored in state so the
  // order is stable while the user views a given verse but differs across
  // verses and across sessions. (The previous seeded-by-idx approach pinned
  // the answer to the same slot in every session.)
  const [textOptions, setTextOptions] = useState<string[]>(() => {
    const others = distractorPool.filter(v => v.reference !== verse.reference);
    const picks = shuffleWithMathRandom(others).slice(0, 3).map(v => v.text);
    return shuffleWithMathRandom([verse.text, ...picks]);
  });
  const [refOptions, setRefOptions] = useState<string[]>(() => {
    const others = distractorPool.filter(v => v.reference !== verse.reference);
    const picks = shuffleWithMathRandom(others).slice(0, 3).map(v => v.reference);
    return shuffleWithMathRandom([verse.reference, ...picks]);
  });
  // Re-randomize options whenever the verse changes (advance / skip / restart)
  useEffect(() => {
    const others = distractorPool.filter(v => v.reference !== verse.reference);
    const textPicks = shuffleWithMathRandom(others).slice(0, 3).map(v => v.text);
    setTextOptions(shuffleWithMathRandom([verse.text, ...textPicks]));
    const refPicks = shuffleWithMathRandom(others).slice(0, 3).map(v => v.reference);
    setRefOptions(shuffleWithMathRandom([verse.reference, ...refPicks]));
  }, [idx, verse.reference, distractorPool]);

  const progress = ((idx) / verses.length) * 100;

  const recordResult = useCallback((correct: boolean) => {
    const rating: PerformanceRating = correct ? 'excellent' : 'poor';
    setTotal(t => t + 1);
    if (correct) setScore(s => s + 1);
    setResults(r => [...r, { verse, correct, rating }]);
    setRevealed(true);
  }, [verse]);

  const advance = useCallback(() => {
    if (idx + 1 >= verses.length) {
      onComplete(score, total, results);
    } else {
      setIdx(i => i + 1);
      setUserInput('');
      setSelectedOption(null);
      setRevealed(false);
      setRecallScore(null);
    }
  }, [idx, verses.length, score, total, results, onComplete]);

  const skipVerse = useCallback(() => {
    recordResult(false);
    setTimeout(() => advance(), 100);
  }, [recordResult, advance]);

  // Keyboard navigation for multiple-choice and reference modes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (mode !== 'multiple-choice' && mode !== 'reference') return;
      if (revealed) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advance(); }
        return;
      }
      const options = mode === 'reference' ? refOptions : textOptions;
      if (['1', '2', '3', '4'].includes(e.key)) {
        const idx = parseInt(e.key) - 1;
        if (idx < options.length) {
          const option = options[idx];
          const isCorrect = mode === 'reference' ? option === verse.reference : option === verse.text;
          handleChoiceSelect(option, isCorrect);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, revealed, textOptions, refOptions, verse, advance]);

  const handleRecallCheck = useCallback(() => {
    const pct = scoreRecall(userInput, verse.text);
    setRecallScore(pct);
    const correct = pct >= 80;
    recordResult(correct);
  }, [userInput, verse, recordResult]);

  // Cmd/Ctrl+Enter submits the Recall "Check Answer" button.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (mode !== 'recall') return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (!revealed && userInput.trim()) {
          e.preventDefault();
          handleRecallCheck();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, revealed, userInput, handleRecallCheck]);

  const handleChoiceSelect = (option: string, isCorrect: boolean) => {
    setSelectedOption(option);
    recordResult(isCorrect);
  };

  const timesRecited = progressMap.get(verse.reference)?.timesRecited ?? 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Progress bar */}
      <div className="glassmorphism rounded-2xl p-4 shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-600">Verse {idx + 1} of {verses.length}</span>
          <span className="text-sm font-bold text-purple-600">
            {total > 0 ? `${score}/${total} correct (${Math.round(score / total * 100)}%)` : 'Get started!'}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Card */}
      <div className="glassmorphism rounded-3xl p-8 shadow-2xl">
        <div className="flex items-center gap-2 mb-5">
          <BookOpen className="w-5 h-5 text-purple-500" />
          <span className="font-bold text-purple-600 text-xl">
            {mode === 'reference' && !revealed ? '???' : verse.reference}
          </span>
          <span className={`ml-auto text-xs px-2 py-1 rounded-full font-semibold ${
            verse.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
            verse.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' :
            'bg-red-100 text-red-700'
          }`}>{verse.difficulty}</span>
        </div>

        {/* ── WORD BANK ── */}
        {mode === 'word-bank' && (
          <WordBankMode key={idx} verse={verse} seed={seed} onResult={(correct) => { setRevealed(true); setTotal(t => t + 1); if (correct) setScore(s => s + 1); setResults(r => [...r, { verse, correct, rating: correct ? 'excellent' : 'poor' }]); }} />
        )}

        {/* ── FIRST LETTERS ── */}
        {mode === 'first-letters' && (
          <FirstLettersMode key={idx} verse={verse} onResult={(correct) => { setRevealed(true); setTotal(t => t + 1); if (correct) setScore(s => s + 1); setResults(r => [...r, { verse, correct, rating: correct ? 'excellent' : 'poor' }]); }} />
        )}

        {/* ── SIMPLIFIED VANISHING CLOZE ── */}
        {mode === 'simplified-vanishing-cloze' && (
          <SimplifiedVanishingClozeMode
            key={idx}
            verse={verse}
            timesRecited={timesRecited}
            customClozeLevel={progressMap.get(verse.reference)?.customClozeLevel ?? null}
            seed={seed}
            onLevelChange={(lvl) => onSetClozeLevel(verse.reference, lvl)}
            onResult={(correct) => { setRevealed(true); setTotal(t => t + 1); if (correct) setScore(s => s + 1); setResults(r => [...r, { verse, correct, rating: correct ? 'excellent' : 'poor' }]); }}
          />
        )}

        {/* ── VANISHING CLOZE ── */}
        {mode === 'vanishing-cloze' && (
          <VanishingClozeMode
            key={idx}
            verse={verse}
            timesRecited={timesRecited}
            customClozeLevel={progressMap.get(verse.reference)?.customClozeLevel ?? null}
            seed={seed}
            onLevelChange={(lvl) => onSetClozeLevel(verse.reference, lvl)}
            onResult={(correct) => { setRevealed(true); setTotal(t => t + 1); if (correct) setScore(s => s + 1); setResults(r => [...r, { verse, correct, rating: correct ? 'excellent' : 'poor' }]); }}
          />
        )}

        {/* ── RECALL ── */}
        {mode === 'recall' && (
          <div className="space-y-4">
            {!revealed ? (
              <>
                <p className="text-gray-500 italic text-sm">Type the complete verse from memory:</p>
                <textarea
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="Type the verse here exactly as written..."
                  className="w-full p-5 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none resize-none verse-text text-lg shadow-inner bg-white/70"
                  rows={5}
                />
                <button onClick={handleRecallCheck} disabled={!userInput.trim()} className="w-full btn-primary text-white py-4 rounded-xl font-bold text-lg shadow-lg disabled:opacity-50">
                  Check Answer <span className="text-xs font-normal opacity-80 ml-2">⌘/Ctrl+Enter</span>
                </button>
              </>
            ) : (
              <>
                <div className="verse-card rounded-xl p-5 bg-gradient-to-br from-purple-50 to-indigo-50">
                  <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Correct Answer:</p>
                  <p className="verse-text text-xl text-gray-800 leading-relaxed italic">"{verse.text}"</p>
                </div>
                {recallScore !== null && (
                  <div className={`p-4 rounded-xl flex items-center gap-3 ${recallScore >= 80 ? 'bg-green-50 border border-green-200' : recallScore >= 50 ? 'bg-yellow-50 border border-yellow-200' : 'bg-red-50 border border-red-200'}`}>
                    {recallScore >= 80 ? <CheckCircle className="w-7 h-7 text-green-500" /> : recallScore >= 50 ? <Minus className="w-7 h-7 text-yellow-500" /> : <XCircle className="w-7 h-7 text-red-500" />}
                    <p className="font-bold text-lg">{recallScore}% accuracy</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── MULTIPLE CHOICE ── */}
        {mode === 'multiple-choice' && (
          <div className="space-y-3">
            <p className="text-gray-500 italic text-sm mb-4">Which verse matches <strong className="text-purple-600">{verse.reference}</strong>?</p>
            {textOptions.map((option, i) => {
              const isCorrect = option === verse.text;
              const isSelected = option === selectedOption;
              let style = 'border-2 border-gray-200 hover:border-purple-400 hover:bg-purple-50';
              if (revealed && isCorrect) style = 'border-2 border-green-400 bg-green-50';
              else if (revealed && isSelected && !isCorrect) style = 'border-2 border-red-400 bg-red-50';
              return (
                <button key={i} onClick={() => !revealed && handleChoiceSelect(option, isCorrect)} disabled={revealed}
                  className={`w-full p-4 text-left rounded-xl transition-all font-medium verse-text text-sm leading-relaxed ${style}`}>
                  <span className="inline-block w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-bold text-center leading-6 mr-3">{String.fromCharCode(65 + i)}</span>
                  {option}
                  {revealed && isCorrect && <CheckCircle className="inline w-4 h-4 text-green-500 ml-2" />}
                  {revealed && isSelected && !isCorrect && <XCircle className="inline w-4 h-4 text-red-500 ml-2" />}
                </button>
              );
            })}
          </div>
        )}

        {/* ── REFERENCE ── */}
        {mode === 'reference' && (
          <div className="space-y-3">
            <div className="verse-card rounded-xl p-5 bg-gradient-to-br from-purple-50 to-indigo-50 mb-4">
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Identify this verse:</p>
              <p className="verse-text text-xl text-gray-800 leading-relaxed italic">"{verse.text}"</p>
            </div>
            <p className="text-gray-500 text-sm">Which reference is this verse from?</p>
            {refOptions.map((option, i) => {
              const isCorrect = option === verse.reference;
              const isSelected = option === selectedOption;
              let style = 'border-2 border-gray-200 hover:border-purple-400 hover:bg-purple-50';
              if (revealed && isCorrect) style = 'border-2 border-green-400 bg-green-50';
              else if (revealed && isSelected && !isCorrect) style = 'border-2 border-red-400 bg-red-50';
              return (
                <button key={i} onClick={() => !revealed && handleChoiceSelect(option, isCorrect)} disabled={revealed}
                  className={`w-full p-4 text-left rounded-xl transition-all font-bold ${style}`}>
                  <span className="inline-block w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-bold text-center leading-6 mr-3">{String.fromCharCode(65 + i)}</span>
                  {option}
                  {revealed && isCorrect && <CheckCircle className="inline w-4 h-4 text-green-500 ml-2" />}
                  {revealed && isSelected && !isCorrect && <XCircle className="inline w-4 h-4 text-red-500 ml-2" />}
                </button>
              );
            })}
          </div>
        )}

        {/* Next button */}
        {revealed && (
          <div className="flex gap-3 mt-6">
            <button
              onClick={skipVerse}
              className="flex-1 py-4 rounded-xl font-bold text-lg border-2 border-orange-300 text-orange-600 hover:bg-orange-50 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-5 h-5" /> Skip
            </button>
            <button
              onClick={advance}
              className="flex-[2] bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
            >
              {idx + 1 >= verses.length ? <><Trophy className="w-5 h-5" /> Finish Session</> : <>Next Verse <ChevronRight className="w-5 h-5" /></>}
            </button>
          </div>
        )}
      </div>

      {/* Keyword tip */}
      <div className="glassmorphism rounded-2xl p-5 shadow-lg bg-gradient-to-r from-purple-50 to-indigo-50">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-700">
            <strong>Key words:</strong> <span className="text-purple-600 font-semibold">{verse.keywords.join(', ')}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Mode Selector ────────────────────────────────────────────────────────────
const RECOMMENDED_MODES: PracticeMode[] = ['word-bank', 'first-letters', 'simplified-vanishing-cloze', 'vanishing-cloze', 'multiple-choice', 'reference'];

function ModeSelector({ onSelect, dueCount }: { onSelect: (mode: PracticeMode) => void; dueCount: number }) {
  const [showAll, setShowAll] = useState(false);
  const gradients: Record<PracticeMode, string> = {
    'word-bank':       'from-purple-500 to-indigo-600',
  'first-letters':             'from-blue-500 to-cyan-600',
  'simplified-vanishing-cloze':'from-teal-400 to-emerald-500',
  'vanishing-cloze':           'from-teal-500 to-green-600',
    'multiple-choice': 'from-green-500 to-emerald-600',
    'reference':       'from-orange-500 to-amber-600',
    'recall':          'from-red-500 to-pink-600',
  };

  const displayModes = showAll ? (Object.keys(MODE_INFO) as PracticeMode[]) : RECOMMENDED_MODES;

  return (
    <div className="space-y-4">
      {dueCount > 0 && (
        <div className="glassmorphism rounded-2xl p-5 border-2 border-orange-200 bg-orange-50/50">
          <p className="font-bold text-orange-700 flex items-center gap-2">
            <Zap className="w-5 h-5" /> {dueCount} verse{dueCount !== 1 ? 's' : ''} due for review today!
          </p>
          <p className="text-sm text-orange-600 mt-1">Choose any mode below — due verses will be prioritised.</p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {displayModes.map((mode) => {
          const info = MODE_INFO[mode];
          const Icon = info.icon;
          return (
            <button key={mode} onClick={() => onSelect(mode)} className={`glassmorphism rounded-2xl p-6 text-left card-hover group relative ${info.highlight ? 'border-2 border-purple-100' : ''}`}>
              {info.badge && (
                <span className="absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold">
                  {info.badge}
                </span>
              )}
              <div className={`inline-block p-3 rounded-xl bg-gradient-to-br ${gradients[mode]} shadow-lg mb-4 group-hover:scale-110 transition-transform`}>
                <Icon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">{info.label}</h3>
              <p className="text-gray-500 text-sm">{info.description}</p>
              <div className="mt-4 text-purple-600 font-semibold text-sm flex items-center gap-1">Start <ChevronRight className="w-4 h-4" /></div>
            </button>
          );
        })}
      </div>
      <button onClick={() => setShowAll(s => !s)} className="w-full glassmorphism py-3 rounded-xl text-sm font-semibold text-gray-500 hover:shadow-md transition-all">
        {showAll ? 'Show recommended modes only' : 'Show all modes (including Full Recall)'}
      </button>
    </div>
  );
}

// ─── Practice (main) ──────────────────────────────────────────────────────────
function Practice() {
  const params = useParams() as { reference?: string };
  const navigate = useNavigate();
  const [progressData] = useMyProgress();
  const [dueReviewData] = useDueReviews();
  const [bookmarkData] = useMyBookmarks();

  // Initialize filter from URL hash so users can bookmark filter state
  const [difficultyFilter, setDifficultyFilter] = useState<"all" | "easy" | "medium" | "hard">(() => {
    const h = window.location.hash.replace('#', '');
    if (['easy', 'medium', 'hard'].includes(h)) return h as "easy" | "medium" | "hard";
    return 'all';
  });
  const [collectionFilter, setCollectionFilter] = useState(() => window.location.hash === '#my-collection');
  const [showCollectionList, setShowCollectionList] = useState(false);
  const [extraCollectionVerses, setExtraCollectionVerses] = useState<KJVVerse[]>([]);
  const { mutate: doCreateSession } = useCreateSessionMutation();
  const { mutate: doAwardAchievement } = useAwardAchievementMutation();
  const { mutate: doUpdateProgress } = useUpdateProgressMutation();
  const { mutate: doUpsertReviewSchedule } = useUpsertReviewScheduleMutation();
  const { mutate: doUpdateDailyGoal } = useUpdateDailyGoalMutation();
  const { mutate: doSetClozeLevel } = useSetClozeLevelMutation();

  const targetReference = params.reference ? decodeURIComponent(params.reference) : null;

  // State variables
  const [mode, setMode] = useState<PracticeMode | null>(null);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const [finalScore, setFinalScore] = useState<{ score: number; total: number }>({ score: 0, total: 0 });

  // Update URL hash when filter changes so users can bookmark the filter
  useEffect(() => {
    const hash = collectionFilter ? '#my-collection' : `#${difficultyFilter}`;
    if (window.location.hash !== hash) {
      history.replaceState(null, '', hash);
    }
  }, [difficultyFilter, collectionFilter]);

  // Sync filter state from browser back/forward navigation
  useEffect(() => {
    const onHashChange = () => {
      const h = window.location.hash.replace('#', '');
      if (h === 'my-collection') {
        setCollectionFilter(true);
      } else if (['easy', 'medium', 'hard', 'all'].includes(h)) {
        setCollectionFilter(false);
        setDifficultyFilter(h as "all" | "easy" | "medium" | "hard");
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Bookmarked references set
  const bookmarkedRefs = useMemo<Set<string>>(() => new Set((bookmarkData ?? []).map(b => b.reference as string)), [bookmarkData]);

  // Load extra collection verses (bookmarked refs not in KJV_VERSES) when collection filter is active
  useEffect(() => {
    if (!collectionFilter || bookmarkedRefs.size === 0) { setExtraCollectionVerses([]); return; }
    const kvRefs = new Set(KJV_VERSES.map(v => v.reference));
    const missing = [...bookmarkedRefs].filter(r => !kvRefs.has(r));
    if (missing.length === 0) { setExtraCollectionVerses([]); return; }
    Promise.all(missing.map(ref => getKJVVerse(ref))).then(entries => {
      const extra: KJVVerse[] = [];
      for (const entry of entries) {
        if (!entry) continue;
        const m = entry.reference.match(/^(.+) (\d+):(\d+)$/);
        if (!m) continue;
        extra.push({
          reference: entry.reference,
          book: m[1],
          chapter: parseInt(m[2], 10),
          verse: entry.verse,
          text: entry.text,
          keywords: extractKeywords(entry.text),
          difficulty: assessDifficulty(entry.text),
          theme: 'custom',
        });
      }
      setExtraCollectionVerses(extra);
    });
  }, [collectionFilter, bookmarkedRefs]);

  // Load verses for a multi-verse range reference (e.g. "Psalms 23:1-6").
  // KJV_VERSES only has ~41 curated verses, so most verses in a range need
  // to be fetched from the full Bible data via getKJVVerse.
  const [targetRangeVerses, setTargetRangeVerses] = useState<KJVVerse[]>([]);
  // Single non-curated verse fetched from the full Bible (e.g. "Exodus 34:5").
  const [targetSingleVerse, setTargetSingleVerse] = useState<KJVVerse | null>(null);
  const isRangeReference = useMemo(() => {
    if (!targetReference) return false;
    const parsed = parseVerseRangeRef(targetReference);
    return parsed !== null && parsed.verseEnd > parsed.verseStart;
  }, [targetReference]);

  useEffect(() => {
    if (!targetReference || !isRangeReference) {
      setTargetRangeVerses([]);
      return;
    }
    const parsed = parseVerseRangeRef(targetReference);
    if (!parsed) { setTargetRangeVerses([]); return; }
    const { book, chapter, verseStart, verseEnd } = parsed;
    let cancelled = false;
    const refs: string[] = [];
    for (let v = verseStart; v <= verseEnd; v++) {
      refs.push(`${book} ${chapter}:${v}`);
    }
    // First, collect what we can from KJV_VERSES (synchronous)
    const kvMap = new Map(KJV_VERSES.map(v => [v.reference, v]));
    const found: KJVVerse[] = [];
    const missing: string[] = [];
    for (const ref of refs) {
      const kv = kvMap.get(ref);
      if (kv) found.push(kv);
      else missing.push(ref);
    }
    // Fetch missing verses from the full Bible
    if (missing.length === 0) {
      // Sort by verse number to ensure correct order
      found.sort((a, b) => a.verse - b.verse);
      if (!cancelled) setTargetRangeVerses(found);
      return;
    }
    Promise.all(missing.map(ref => getKJVVerse(ref))).then(entries => {
      if (cancelled) return;
      const extra: KJVVerse[] = [];
      for (const entry of entries) {
        if (!entry) continue;
        const m = entry.reference.match(/^(.+) (\d+):(\d+)$/);
        if (!m) continue;
        extra.push({
          reference: entry.reference,
          book: m[1],
          chapter: parseInt(m[2], 10),
          verse: entry.verse,
          text: entry.text,
          keywords: extractKeywords(entry.text),
          difficulty: assessDifficulty(entry.text),
          theme: 'custom',
        });
      }
      const all = [...found, ...extra].sort((a, b) => a.verse - b.verse);
      setTargetRangeVerses(all);
    });
    return () => { cancelled = true; };
  }, [targetReference, isRangeReference]);

  // Fetch a single target verse that is not in the curated KJV_VERSES list
  // (e.g. navigating from Favorites to /practice/Exodus%2034:5).
  useEffect(() => {
    if (!targetReference || isRangeReference) {
      setTargetSingleVerse(null);
      return;
    }
    const v = KJV_VERSES.find(x => x.reference === targetReference);
    if (v) { setTargetSingleVerse(null); return; }
    let cancelled = false;
    getKJVVerse(targetReference).then(entry => {
      if (cancelled || !entry) { setTargetSingleVerse(null); return; }
      const m = entry.reference.match(/^(.+) (\d+):(\d+)$/);
      if (!m) { setTargetSingleVerse(null); return; }
      setTargetSingleVerse({
        reference: entry.reference,
        book: m[1],
        chapter: parseInt(m[2], 10),
        verse: entry.verse,
        text: entry.text,
        keywords: extractKeywords(entry.text),
        difficulty: assessDifficulty(entry.text),
        theme: 'custom',
      });
    });
    return () => { cancelled = true; };
  }, [targetReference, isRangeReference]);

  // Build a map: reference → { timesRecited, customClozeLevel } from progress data
  const progressMap = useMemo(() => {
    const map = new Map<string, { timesRecited: number; customClozeLevel?: 0 | 1 | 2 | 3 | 4 | null }>();
    for (const p of progressData ?? []) {
      if (p?.verse?.reference) map.set(p.verse.reference, {
        timesRecited: p.timesRecited ?? 0,
        customClozeLevel: p.customClozeLevel ?? null,
      });
    }
    return map;
  }, [progressData]);

  // Due review count
  const dueCount = (dueReviewData ?? []).filter(r => r?.dueDate && new Date(r.dueDate) <= new Date()).length;

  const verses = useMemo(() => {
    if (targetReference) {
      // Multi-verse range (e.g. "Psalms 23:1-6")
      if (isRangeReference) {
        return targetRangeVerses;
      }
      // Single verse — try exact match in KJV_VERSES first, then fall back to
      // a verse fetched from the full Bible (e.g. a favourited non-curated verse).
      const v = KJV_VERSES.find(v => v.reference === targetReference);
      if (v) return [v];
      return targetSingleVerse ? [targetSingleVerse] : [];
    }
    let pool: KJVVerse[];
    if (collectionFilter) {
      const featured = KJV_VERSES.filter(v => bookmarkedRefs.has(v.reference));
      pool = [...featured, ...extraCollectionVerses];
    } else {
      pool = difficultyFilter === 'all' ? KJV_VERSES : KJV_VERSES.filter(v => v.difficulty === difficultyFilter);
    }
    // Sort: due verses first, then by times recited (least practiced first)
    return [...pool].sort((a, b) => {
      const aDue = (dueReviewData ?? []).some(r => r?.verse?.reference === a.reference && r?.dueDate && new Date(r.dueDate) <= new Date());
      const bDue = (dueReviewData ?? []).some(r => r?.verse?.reference === b.reference && r?.dueDate && new Date(r.dueDate) <= new Date());
      if (aDue !== bDue) return aDue ? -1 : 1;
      return (progressMap.get(a.reference)?.timesRecited ?? 0) - (progressMap.get(b.reference)?.timesRecited ?? 0);
    });
  }, [targetReference, isRangeReference, targetRangeVerses, targetSingleVerse, difficultyFilter, collectionFilter, bookmarkedRefs, extraCollectionVerses, dueReviewData, progressMap]);

  const handleComplete = async (score: number, total: number, results: { verse: KJVVerse; correct: boolean; rating: PerformanceRating }[]) => {
    setFinalScore({ score, total });
    setSessionComplete(true);
    try {
      await doCreateSession({
        versesPracticed: results.map(r => r.verse.reference),
        mode: mode === 'recall' ? 'recall' : mode === 'multiple-choice' ? 'multiple-choice' : mode === 'reference' ? 'reference' : 'fill-blank',
        score: total > 0 ? Math.round((score / total) * 100) : 0,
        totalQuestions: total,
      });

      // Update per-verse progress and review schedule
      for (const result of results) {
        const accuracy = result.correct ? 100 : 0;
        await doUpdateProgress({ reference: result.verse.reference, correct: result.correct, accuracy }).catch(() => {});
        const progress = (progressData ?? []).find((p: any) => p?.verse?.reference === result.verse.reference);
        const streak = result.correct ? (progress?.streak ?? 0) + 1 : 0;
        await doUpsertReviewSchedule({ reference: result.verse.reference, correct: result.correct, streak, accuracy }).catch(() => {});
      }

      // Update daily goal
      const totalCorrect = results.filter(r => r.correct).length;
      const prevCorrect = (progressData ?? []).reduce((sum: number, p: any) => sum + (p?.timesRecited ?? 0), 0);
      await doUpdateDailyGoal({ completedVerses: prevCorrect + totalCorrect }).catch(() => {});

      // Check achievements
      const correctCount = results.filter(r => r.correct).length;
      const masteredCount = (progressData ?? []).filter((p: any) => p?.status === 'mastered').length;
      const totalPracticed = (progressData ?? []).length;
      const newTotal = totalPracticed + results.filter(r => !(progressData ?? []).some((p: any) => p?.verse?.reference === r.verse.reference)).length;

      if (correctCount > 0) await doAwardAchievement({ type: 'first-verse' }).catch(() => {});
      if (newTotal >= 10 || totalPracticed >= 10) await doAwardAchievement({ type: 'ten-verses' }).catch(() => {});
      if (newTotal >= 50 || totalPracticed >= 50) await doAwardAchievement({ type: 'fifty-verses' }).catch(() => {});
      if (newTotal >= 100 || totalPracticed >= 100) await doAwardAchievement({ type: 'hundred-verses' }).catch(() => {});
      if (masteredCount >= 1) await doAwardAchievement({ type: 'master-level' }).catch(() => {});

      // Streak achievements (check if practiced on consecutive days)
      const sessions = JSON.parse(localStorage.getItem('kjv-memorize-sessions') ?? '[]');
      const daySet = new Set(sessions.map((s: any) => new Date(s.startTime).toISOString().split('T')[0]));
      const today = new Date().toISOString().split('T')[0];
      daySet.add(today);
      let streakDays = 0;
      const d = new Date(today);
      while (daySet.has(d.toISOString().split('T')[0])) {
        streakDays++;
        d.setDate(d.getDate() - 1);
      }
      if (streakDays >= 7) await doAwardAchievement({ type: 'seven-day-streak' }).catch(() => {});
      if (streakDays >= 30) await doAwardAchievement({ type: 'thirty-day-streak' }).catch(() => {});

      // Daily goal achievement
      const dailyGoal = JSON.parse(localStorage.getItem('kjv-memorize-daily-goal') ?? '{}');
      if (dailyGoal.completed) await doAwardAchievement({ type: 'daily-goal' }).catch(() => {});
    } catch { /* silently handle errors */ }
  };

  const handleRestart = () => { setSessionComplete(false); setSessionKey(k => k + 1); };
  const handleNewMode = () => { setMode(null); setSessionComplete(false); setSessionKey(k => k + 1); };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="glassmorphism rounded-3xl p-8 shadow-xl">
        <div className="flex items-center gap-4">
          {mode && (
            <button onClick={handleNewMode} className="p-2 rounded-xl hover:bg-purple-100 transition-colors">
              <ArrowLeft className="w-6 h-6 text-purple-600" />
            </button>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold gradient-text">
                  {mode === 'reference' && targetReference
                    ? 'Practice: Reference Match'
                    : targetReference ? `Practice: ${targetReference}`
                    : mode ? MODE_INFO[mode].label : 'Practice Mode'}
                </h1>
                <p className="text-gray-500">{mode ? MODE_INFO[mode].description : 'Choose your practice style'}</p>
              </div>
            </div>
          </div>
        </div>

        {!targetReference && !mode && (
          <div className="mt-5 pt-5 border-t border-purple-100 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-semibold text-gray-600 flex items-center gap-1"><Filter className="w-4 h-4" /> Difficulty:</span>
              {(['all', 'easy', 'medium', 'hard'] as const).map((d) => (
                <button key={d} onClick={() => { setDifficultyFilter(d); setCollectionFilter(false); setShowCollectionList(false); }}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    !collectionFilter && difficultyFilter === d
                      ? d === 'easy' ? 'bg-green-500 text-white shadow-md'
                        : d === 'medium' ? 'bg-yellow-500 text-white shadow-md'
                        : d === 'hard' ? 'bg-red-500 text-white shadow-md'
                        : 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md'
                      : 'glassmorphism text-gray-600 hover:shadow-md'
                  }`}>
                  {d === 'all' ? `All (${KJV_VERSES.length})` : `${d.charAt(0).toUpperCase() + d.slice(1)} (${KJV_VERSES.filter(v => v.difficulty === d).length})`}
                </button>
              ))}
              <button
                onClick={() => { setCollectionFilter(c => !c); if (collectionFilter) setShowCollectionList(false); }}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
                  collectionFilter
                    ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md'
                    : 'glassmorphism text-gray-600 hover:shadow-md'
                }`}
              >
                <Star className="w-3.5 h-3.5" />
                My Collection ({bookmarkedRefs.size})
              </button>
            </div>
            {verses.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCollectionList(s => !s)}
                  className="text-xs font-semibold text-purple-600 hover:text-purple-800 flex items-center gap-1 transition-colors"
                >
                  {collectionFilter && <Star className="w-3 h-3" />}
                  {showCollectionList ? 'Hide' : 'Show'} {verses.length} verse{verses.length !== 1 ? 's' : ''} in collection
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {sessionComplete ? (
        <SessionSummary score={finalScore.score} total={finalScore.total} mode={mode!} onRestart={handleRestart} onNewMode={handleNewMode} />
      ) : !mode ? (
        <>
          {collectionFilter && bookmarkedRefs.size === 0 ? (
            <div className="glassmorphism rounded-2xl p-12 shadow-lg text-center space-y-4">
              <Star className="w-12 h-12 text-purple-300 mx-auto" />
              <p className="text-gray-600 font-semibold">No favorites yet</p>
              <p className="text-gray-400 text-sm">Tap the star icon on any verse in the Books view to add it here.</p>
              <Link to="/books">
                <button className="btn-primary text-white py-2 px-6 rounded-xl font-bold">Browse Books</button>
              </Link>
            </div>
          ) : (
            <>
              <div className="glassmorphism rounded-2xl p-5 shadow-lg">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold text-purple-600">{verses.length} verse{verses.length !== 1 ? 's' : ''}</span> ready to practice
                  {targetReference && <span> · Focused on <strong>{targetReference}</strong></span>}
                  {collectionFilter && <span className="text-violet-600 font-semibold"> · My Collection</span>}
                  {dueCount > 0 && <span className="text-orange-600 font-semibold"> · {dueCount} due for review</span>}
                </p>
              </div>

              {showCollectionList && verses.length > 0 && (
                <div className="glassmorphism rounded-2xl p-4 shadow-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                      <Star className="w-4 h-4 text-yellow-500" /> {verses.length} verse{verses.length !== 1 ? 's' : ''} in collection
                    </h3>
                    <button onClick={() => setShowCollectionList(false)} className="p-1 rounded-lg hover:bg-purple-100 transition-colors" title="Close">
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                    {[...verses]
                      .sort((a, b) => {
                        const oa = BOOK_ORDER.get(a.book) ?? 999;
                        const ob = BOOK_ORDER.get(b.book) ?? 999;
                        if (oa !== ob) return oa - ob;
                        if (a.chapter !== b.chapter) return a.chapter - b.chapter;
                        return a.verse - b.verse;
                      })
                      .map((v) => (
                          <Link
                            key={v.reference}
                            to={`/books/${encodeURIComponent(v.book)}/${v.chapter}#v${v.verse}`}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-purple-50 transition-colors group"
                          >
                            {bookmarkedRefs.has(v.reference) && <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 flex-shrink-0" />}
                            <span className="text-sm font-semibold text-purple-700 group-hover:text-purple-900">{v.reference}</span>
                          </Link>
                      ))}
                  </div>
                </div>
              )}

              <ModeSelector onSelect={setMode} dueCount={dueCount} />
            </>
          )}
        </>
      ) : (
        <PracticeSession
          key={`${mode}-${difficultyFilter}-${collectionFilter}-${sessionKey}`}
          verses={verses}
          mode={mode}
          progressMap={progressMap}
          onComplete={handleComplete}
          onSetClozeLevel={(reference, level) => doSetClozeLevel({ reference, level })}
        />
      )}
    </div>
  );
}

export default Practice;
