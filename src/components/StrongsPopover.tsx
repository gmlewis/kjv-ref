import { useEffect, useRef } from 'react';
import { ExternalLink } from 'lucide-react';
import type { StrongsEntry } from '../data/strongs';
import { bibleHubLexiconUrl, blueBibleUrl } from '../utils/studyLinks';

interface Props {
  entry: StrongsEntry;
  onClose: () => void;
}

export function StrongsPopover({ entry, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const isHebrew = entry.strongs.startsWith('H');

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    // Defer so the triggering click doesn't immediately close
    const tid = setTimeout(() => document.addEventListener('mousedown', handleClick), 0);
    return () => { clearTimeout(tid); document.removeEventListener('mousedown', handleClick); };
  }, [onClose]);

  const definition = entry.definition?.trim() || entry.kjv_def || '';

  return (
    <div
      ref={ref}
      className="w-72 glassmorphism rounded-2xl p-4 shadow-2xl border border-purple-200 text-left"
      role="dialog"
      aria-label={`Strong's ${entry.strongs}`}
    >
      {/* Strong's number badge */}
      <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold font-mono mb-2">
        {entry.strongs}
      </span>

      {/* Lemma */}
      <div
        className="text-3xl font-serif mb-1"
        dir={isHebrew ? 'rtl' : 'ltr'}
        lang={isHebrew ? 'he' : 'el'}
      >
        {entry.lemma}
      </div>

      {/* Transliteration */}
      {entry.translit && (
        <p className="text-sm italic text-gray-600 mb-0.5">{entry.translit}</p>
      )}

      {/* Pronunciation */}
      {entry.pronunciation && entry.pronunciation !== entry.translit && (
        <p className="text-xs text-gray-500 mb-1">/{entry.pronunciation}/</p>
      )}

      {/* Definition */}
      {definition && (
        <p className="text-sm text-gray-700 leading-snug border-t border-purple-100 pt-2 mt-2">
          {definition}
        </p>
      )}

      {/* KJV usage if different from definition */}
      {entry.kjv_def && entry.kjv_def !== definition && (
        <p className="text-xs text-gray-500 mt-1">
          <span className="font-semibold">KJV:</span> {entry.kjv_def}
        </p>
      )}

      {/* External study links */}
      <div className="flex gap-1.5 mt-3 pt-2 border-t border-purple-100 flex-wrap">
        <a
          href={bibleHubLexiconUrl(entry.strongs)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold transition-colors"
        >
          BibleHub <ExternalLink className="w-3 h-3" />
        </a>
        <a
          href={blueBibleUrl(entry.strongs)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold transition-colors"
        >
          Blue Letter Bible <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
