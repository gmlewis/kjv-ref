import { useEffect, useRef } from 'react';
import type { WordEntry } from '../data/interlinear';
import { bibleHubLexiconUrl, blueBibleUrl } from '../utils/studyLinks';
import { ExternalLink } from 'lucide-react';

interface Props {
  entry: WordEntry;
  isHebrew: boolean;
  onClose: () => void;
  style?: React.CSSProperties;
}

// ─── Parsing code humanizer ───────────────────────────────────────────────────

function humanizeParsing(code: string, isHebrew: boolean): string {
  if (!code) return '';
  if (isHebrew) {
    // ETCBC-style: e.g. "HVqp3ms", "HNcmpa", "HR/Ncfsa"
    const c = code.replace(/\/.*/g, ''); // take first segment before /
    if (c.startsWith('HVq')) return 'Verb · Qal';
    if (c.startsWith('HVN')) return 'Verb · Niphal';
    if (c.startsWith('HVp')) return 'Verb · Piel';
    if (c.startsWith('HVP')) return 'Verb · Pual';
    if (c.startsWith('HVh')) return 'Verb · Hiphil';
    if (c.startsWith('HVH')) return 'Verb · Hophal';
    if (c.startsWith('HVt')) return 'Verb · Hithpael';
    if (c.startsWith('HV')) return 'Verb';
    if (c.startsWith('HNc')) return 'Noun';
    if (c.startsWith('HNp')) return 'Proper Noun';
    if (c.startsWith('HN')) return 'Noun';
    if (c.startsWith('HPA') || c.startsWith('HPp')) return 'Pronoun';
    if (c.startsWith('HP')) return 'Pronoun';
    if (c.startsWith('HA')) return 'Adjective';
    if (c.startsWith('HTd')) return 'Definite Article';
    if (c.startsWith('HTo')) return 'Direct Object Marker';
    if (c.startsWith('HTc')) return 'Particle';
    if (c.startsWith('HT')) return 'Particle';
    if (c.startsWith('HR')) return 'Preposition';
    if (c.startsWith('HC') || c.startsWith('Hc')) return 'Conjunction';
    if (c.startsWith('HI')) return 'Interjection';
    return code.split('/')[0];
  } else {
    // Greek (BDAG-style): e.g. "N-NSF", "V-AAI-3S", "CONJ", "PREP"
    if (code === 'CONJ') return 'Conjunction';
    if (code === 'PREP') return 'Preposition';
    if (code === 'ADV') return 'Adverb';
    if (code === 'PRT' || code === 'PART') return 'Particle';
    if (code === 'INJ') return 'Interjection';
    if (code.startsWith('N-')) return 'Noun';
    if (code.startsWith('V-')) return 'Verb';
    if (code.startsWith('T-')) return 'Article';
    if (code.startsWith('P-')) return 'Pronoun';
    if (code.startsWith('ADJ')) return 'Adjective';
    if (code.startsWith('D-')) return 'Demonstrative';
    if (code.startsWith('R-')) return 'Relative Pronoun';
    if (code.startsWith('C-')) return 'Conditional';
    return code;
  }
}

export function InterlinearWordPopover({ entry, isHebrew, onClose, style }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [word, strongs, translit, gloss, parsing] = entry;

  const hasStrongs = !!strongs;
  const humanParsing = humanizeParsing(parsing, isHebrew);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    const tid = setTimeout(() => document.addEventListener('mousedown', handleClick), 0);
    return () => { clearTimeout(tid); document.removeEventListener('mousedown', handleClick); };
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={style}
      className="w-72 glassmorphism rounded-2xl p-4 shadow-2xl border border-emerald-200 text-left"
      role="dialog"
    >
      {/* Strong's badge */}
      {hasStrongs && (
        <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold font-mono mb-2">
          {strongs}
        </span>
      )}

      {/* Original word — large */}
      <div
        className="text-4xl font-serif mb-1 text-emerald-900"
        dir={isHebrew ? 'rtl' : 'ltr'}
        lang={isHebrew ? 'he' : 'el'}
      >
        {word}
      </div>

      {/* Transliteration */}
      {translit && (
        <p className="text-sm italic text-gray-600 mb-0.5">{translit}</p>
      )}

      {/* Gloss */}
      {gloss && (
        <p className="text-base font-semibold text-gray-800 mb-1">{gloss}</p>
      )}

      {/* Parsing */}
      {humanParsing && (
        <p className="text-xs text-gray-500 border-t border-emerald-100 pt-1.5 mt-1.5">
          {humanParsing}
          {parsing && humanParsing !== parsing && (
            <span className="ml-1 font-mono text-gray-400">({parsing})</span>
          )}
        </p>
      )}

      {/* External links — only when we have a Strong's number */}
      {hasStrongs && (
        <div className="flex gap-1.5 mt-3 pt-2 border-t border-emerald-100 flex-wrap">
          <a
            href={bibleHubLexiconUrl(strongs)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold transition-colors"
          >
            BibleHub <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href={blueBibleUrl(strongs)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold transition-colors"
          >
            Blue Letter Bible <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}
