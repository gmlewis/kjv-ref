import { BOOK_ABBR_MAP } from '../data/kjv-bible';

// ─── Reverse map: full name → internal abbreviation ─────────────────────────
const NAME_TO_ABBR = new Map<string, string>(
  Object.entries(BOOK_ABBR_MAP).map(([abbr, info]) => [info.name, abbr])
);

// ─── STEP Bible abbreviations (3-letter SBL-style) ──────────────────────────
// Maps our internal book abbreviation → STEP Bible URL abbreviation
const ABBR_TO_STEP: Record<string, string> = {
  Ge: 'Gen',   Exo: 'Exo',  Lev: 'Lev',  Num: 'Num',  Deu: 'Deu',
  Josh: 'Jos', Jdgs: 'Jdg', Ruth: 'Rut', '1Sm': '1Sa','2Sm': '2Sa',
  '1Ki': '1Ki','2Ki': '2Ki','1Chr': '1Ch','2Chr': '2Ch',Ezra: 'Ezr',
  Neh: 'Neh',  Est: 'Est',  Job: 'Job',  Psa: 'Psa',  Prv: 'Pro',
  Eccl: 'Ecc', SSol: 'Sng', Isa: 'Isa',  Jer: 'Jer',  Lam: 'Lam',
  Eze: 'Ezk',  Dan: 'Dan',  Hos: 'Hos',  Joel: 'Jol', Amos: 'Amo',
  Obad: 'Oba', Jonah: 'Jon',Mic: 'Mic',  Nahum: 'Nam',Hab: 'Hab',
  Zep: 'Zep',  Hag: 'Hag', Zec: 'Zec',  Mal: 'Mal',
  Mat: 'Mat',  Mark: 'Mrk',Luke: 'Luk', John: 'Jhn', Acts: 'Act',
  Rom: 'Rom',  '1Cor': '1Co','2Cor': '2Co',Gal: 'Gal',Eph: 'Eph',
  Phi: 'Php',  Col: 'Col', '1Th': '1Th','2Th': '2Th','1Tim': '1Ti',
  '2Tim': '2Ti',Titus: 'Tit',Phmn: 'Phm',Heb: 'Heb', Jas: 'Jas',
  '1Pet': '1Pe','2Pet': '2Pe','1Jn': '1Jn','2Jn': '2Jn','3Jn': '3Jn',
  Jude: 'Jud', Rev: 'Rev',
};

// ─── BibleHub interlinear URL helpers ────────────────────────────────────────

/** "Song of Solomon" → "song_of_solomon", "1 Samuel" → "1_samuel" */
function toBibleHubSlug(bookName: string): string {
  return bookName.toLowerCase().replace(/\s+/g, '_');
}

/** https://biblehub.com/interlinear/genesis/2-1.htm */
export function bibleHubInterlinearUrl(bookName: string, chapter: number, verse: number): string {
  return `https://biblehub.com/interlinear/${toBibleHubSlug(bookName)}/${chapter}-${verse}.htm`;
}

/** https://biblehub.com/hebrew/3615.htm  or  https://biblehub.com/greek/976.htm */
export function bibleHubLexiconUrl(strongs: string): string {
  const m = /^([HG])(\d+)/.exec(strongs);
  if (!m) return 'https://biblehub.com/';
  const lang = m[1] === 'H' ? 'hebrew' : 'greek';
  return `https://biblehub.com/${lang}/${m[2]}.htm`;
}

// ─── Blue Letter Bible URL helpers ───────────────────────────────────────────

/** https://www.blueletterbible.org/lexicon/h3615/kjv/wlc/0-1/ */
export function blueBibleUrl(strongs: string): string {
  const m = /^([HG])(\d+)/.exec(strongs);
  if (!m) return 'https://www.blueletterbible.org/';
  const prefix = m[1].toLowerCase();
  const num = m[2];
  const src = m[1] === 'H' ? 'wlc' : 'tr';
  return `https://www.blueletterbible.org/lexicon/${prefix}${num}/kjv/${src}/0-1/`;
}

// ─── STEP Bible URL helpers ───────────────────────────────────────────────────

/** https://www.stepbible.org/?q=reference=Gen.2.1 */
export function stepBibleUrl(bookName: string, chapter: number, verse: number): string {
  const internalAbbr = NAME_TO_ABBR.get(bookName);
  const stepAbbr = internalAbbr ? (ABBR_TO_STEP[internalAbbr] ?? internalAbbr) : bookName.slice(0, 3);
  return `https://www.stepbible.org/?q=reference=${stepAbbr}.${chapter}.${verse}`;
}
