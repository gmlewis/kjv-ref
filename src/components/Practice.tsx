import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useMyProgress, useDueReviews, useMyBookmarks, useCreateSessionMutation, useAwardAchievementMutation, useUpdateProgressMutation, useUpsertReviewScheduleMutation, useUpdateDailyGoalMutation } from '../hooks';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CheckCircle, XCircle, RotateCcw, Sparkles, Zap, Target,
  Award, BookOpen, ArrowLeft, ChevronRight, Shuffle, Filter,
  Minus, Trophy, Layers, AlignLeft, Eye, Hash, Star, X,
} from 'lucide-react';
import { parseVerseRef } from '../utils/urlHelpers';

import { KJV_VERSES, type KJVVerse } from '../data/kjv-verses';
import { getKJVVerse } from '../data/kjv-bible';
import { extractKeywords, assessDifficulty } from '../utils/spacedRepetition';
import {
  buildWordBank, checkWordBankAnswer,
  toFirstLetters,
  getVanishingClozeLevel, applyVanishingCloze, getVanishingClozeAnswers,
} from '../utils/practiceHelpers';

type PracticeMode = 'word-bank' | 'first-letters' | 'vanishing-cloze' | 'multiple-choice' | 'reference' | 'recall';
type PerformanceRating = 'excellent' | 'good' | 'poor';

const MODE_INFO: Record<PracticeMode, { label: string; description: string; icon: any; badge?: string; highlight?: boolean }> = {
  'word-bank':       { label: 'Word Bank',       description: 'Tap the shuffled words into the correct order',        icon: Layers,    badge: 'Tap to order',   highlight: true },
  'first-letters':   { label: 'First Letters',   description: 'Each word shown as its first letter only — fill in the rest', icon: AlignLeft, badge: 'Hint-guided',    highlight: true },
  'vanishing-cloze': { label: 'Vanishing Cloze', description: 'Blanks increase as your mastery grows',                icon: Eye,       badge: 'Adapts to you',  highlight: true },
  'multiple-choice': { label: 'Multiple Choice', description: 'Select the correct verse text from four options',       icon: Award,     badge: undefined },
  'reference':       { label: 'Reference Match', description: 'Identify the correct reference for a verse',           icon: BookOpen,  badge: undefined },
  'recall':          { label: 'Full Recall',      description: 'Type the complete verse from memory',                  icon: Target,    badge: 'Advanced' },
};

// Seeded shuffle — stable per verse index
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(((seed * (i + 1) * 2654435761) >>> 0) % (i + 1));
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

// ─── Vanishing Cloze Mode ─────────────────────────────────────────────────────
function VanishingClozeMode({
  verse, timesRecited, seed, onResult,
}: { verse: KJVVerse; timesRecited: number; seed: number; onResult: (correct: boolean) => void }) {
  const level = getVanishingClozeLevel(timesRecited) as 0 | 1 | 2 | 3 | 4;
  const blankedText = useMemo(() => applyVanishingCloze(verse.text, level, seed), [verse, level, seed]);
  const missingWords = useMemo(() => getVanishingClozeAnswers(verse.text, level, seed), [verse, level, seed]);

  const [userInput, setUserInput] = useState('');
  const [checked, setChecked] = useState(false);
  const [recallScore, setRecallScore] = useState<number | null>(null);

  const levelLabels = ['Study Mode', '25% hidden', '50% hidden', '75% hidden', 'Full Recall'];
  const levelColors = ['text-blue-600', 'text-green-600', 'text-yellow-600', 'text-orange-600', 'text-red-600'];
  const levelBg = ['bg-blue-100', 'bg-green-100', 'bg-yellow-100', 'bg-orange-100', 'bg-red-100'];

  // Level 0: study card — just read and tap "Got it"
  if (level === 0) {
    return (
      <div className="space-y-4">
        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold ${levelBg[0]} ${levelColors[0]}`}>
          <Hash className="w-3 h-3" /> Level 0 — {levelLabels[0]}
        </div>
        <div className="verse-card rounded-xl p-6 bg-gradient-to-br from-blue-50 to-indigo-50">
          <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">Read this verse:</p>
          <p className="verse-text text-xl text-gray-800 leading-relaxed italic">"{verse.text}"</p>
        </div>
        <p className="text-sm text-gray-500">Study this verse carefully. As you practice more, words will be hidden progressively.</p>
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

  const handleCheck = () => {
    const pct = scoreRecall(userInput, verse.text);
    setRecallScore(pct);
    setChecked(true);
    onResult(pct >= 70);
  };

  return (
    <div className="space-y-4">
      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold ${levelBg[level]} ${levelColors[level]}`}>
        <Hash className="w-3 h-3" /> Level {level} — {levelLabels[level]}
      </div>

      {/* Blanked verse */}
      <div className="verse-card rounded-xl p-5 bg-gradient-to-br from-purple-50 to-indigo-50">
        <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">Fill in the blanks:</p>
        <p className="verse-text text-xl text-gray-800 leading-relaxed">{blankedText}</p>
        {!checked && missingWords.length > 0 && (
          <p className="text-xs text-purple-600 font-semibold mt-3">{missingWords.length} word{missingWords.length !== 1 ? 's' : ''} hidden</p>
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
            Check Answer
          </button>
        </>
      ) : (
        <>
          <div className="p-4 rounded-xl bg-green-50 border border-green-200">
            <p className="text-xs font-semibold text-gray-500 mb-2">Hidden words were:</p>
            <div className="flex flex-wrap gap-2">
              {missingWords.map((w, i) => (
                <span key={i} className="px-3 py-1 bg-green-200 text-green-800 rounded-lg font-bold text-sm">{w}</span>
              ))}
            </div>
          </div>
          {recallScore !== null && (
            <div className={`p-4 rounded-xl flex items-center gap-3 ${
              recallScore >= 70 ? 'bg-green-50 border border-green-200' :
              recallScore >= 50 ? 'bg-yellow-50 border border-yellow-200' :
              'bg-red-50 border border-red-200'
            }`}>
              {recallScore >= 70 ? <CheckCircle className="w-7 h-7 text-green-500" /> :
               recallScore >= 50 ? <Minus className="w-7 h-7 text-yellow-500" /> :
               <XCircle className="w-7 h-7 text-red-500" />}
              <p className="font-bold">{recallScore >= 70 ? 'Well done!' : 'Keep going!'} ({recallScore}% match)</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Practice Session ─────────────────────────────────────────────────────────
function PracticeSession({
  verses, mode, progressMap, onComplete,
}: {
  verses: KJVVerse[];
  mode: PracticeMode;
  progressMap: Map<string, { timesRecited: number }>;
  onComplete: (score: number, total: number, results: { verse: KJVVerse; correct: boolean; rating: PerformanceRating }[]) => void;
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
  const seed = idx * 31 + 7;

  // MC options
  const others = useMemo(() => verses.filter((_, i) => i !== idx), [verses, idx]);
  const shuffledOthers = useMemo(() => seededShuffle(others, seed), [others, seed]);
  const textOptions = useMemo(() => seededShuffle([verse.text, ...shuffledOthers.slice(0, 3).map(v => v.text)], idx * 17 + 3), [verse, shuffledOthers, idx]);
  const refOptions = useMemo(() => seededShuffle([verse.reference, ...shuffledOthers.slice(0, 3).map(v => v.reference)], idx * 13 + 5), [verse, shuffledOthers, idx]);

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

  const handleRecallCheck = () => {
    const pct = scoreRecall(userInput, verse.text);
    setRecallScore(pct);
    const correct = pct >= 80;
    recordResult(correct);
  };

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
          <span className="font-bold text-purple-600 text-xl">{verse.reference}</span>
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

        {/* ── VANISHING CLOZE ── */}
        {mode === 'vanishing-cloze' && (
          <VanishingClozeMode key={idx} verse={verse} timesRecited={timesRecited} seed={seed} onResult={(correct) => { setRevealed(true); setTotal(t => t + 1); if (correct) setScore(s => s + 1); setResults(r => [...r, { verse, correct, rating: correct ? 'excellent' : 'poor' }]); }} />
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
                  Check Answer
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
const RECOMMENDED_MODES: PracticeMode[] = ['word-bank', 'first-letters', 'vanishing-cloze', 'multiple-choice', 'reference'];

function ModeSelector({ onSelect, dueCount }: { onSelect: (mode: PracticeMode) => void; dueCount: number }) {
  const [showAll, setShowAll] = useState(false);
  const gradients: Record<PracticeMode, string> = {
    'word-bank':       'from-purple-500 to-indigo-600',
    'first-letters':   'from-blue-500 to-cyan-600',
    'vanishing-cloze': 'from-teal-500 to-green-600',
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
  const [difficultyFilter, setDifficultyFilter] = useState<"all" | "easy" | "medium" | "hard">("all");
  const [collectionFilter, setCollectionFilter] = useState(false);
  const [showCollectionList, setShowCollectionList] = useState(false);
  const [extraCollectionVerses, setExtraCollectionVerses] = useState<KJVVerse[]>([]);
  const { mutate: doCreateSession } = useCreateSessionMutation();
  const { mutate: doAwardAchievement } = useAwardAchievementMutation();
  const { mutate: doUpdateProgress } = useUpdateProgressMutation();
  const { mutate: doUpsertReviewSchedule } = useUpsertReviewScheduleMutation();
  const { mutate: doUpdateDailyGoal } = useUpdateDailyGoalMutation();

  const targetReference = params.reference ? decodeURIComponent(params.reference) : null;

  // State variables
  const [mode, setMode] = useState<PracticeMode | null>(null);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const [finalScore, setFinalScore] = useState<{ score: number; total: number }>({ score: 0, total: 0 });

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

  // Build a map: reference → { timesRecited } from progress data
  const progressMap = useMemo(() => {
    const map = new Map<string, { timesRecited: number }>();
    for (const p of progressData ?? []) {
      if (p?.verse?.reference) map.set(p.verse.reference, { timesRecited: p.timesRecited ?? 0 });
    }
    return map;
  }, [progressData]);

  // Due review count
  const dueCount = (dueReviewData ?? []).filter(r => r?.dueDate && new Date(r.dueDate) <= new Date()).length;

  const verses = useMemo(() => {
    if (targetReference) {
      const v = KJV_VERSES.find(v => v.reference === targetReference);
      return v ? [v] : KJV_VERSES;
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
  }, [targetReference, difficultyFilter, collectionFilter, bookmarkedRefs, extraCollectionVerses, dueReviewData, progressMap]);

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
                  {targetReference ? `Practice: ${targetReference}` : 'Practice Mode'}
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
                        if (a.book !== b.book) return a.book.localeCompare(b.book);
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
        />
      )}
    </div>
  );
}

export default Practice;
