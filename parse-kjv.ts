import { readFileSync, writeFileSync } from 'fs';

const kjvBooks = [
  { name: 'Genesis', abbreviation: 'Ge', testament: 'old', order: 1, chapters: 50 },
  { name: 'Exodus', abbreviation: 'Ex', testament: 'old', order: 2, chapters: 40 },
  { name: 'Leviticus', abbreviation: 'Le', testament: 'old', order: 3, chapters: 27 },
  { name: 'Numbers', abbreviation: 'Nu', testament: 'old', order: 4, chapters: 36 },
  { name: 'Deuteronomy', abbreviation: 'De', testament: 'old', order: 5, chapters: 34 },
  { name: 'Joshua', abbreviation: 'Jo', testament: 'old', order: 6, chapters: 24 },
  { name: 'Judges', abbreviation: 'Ju', testament: 'old', order: 7, chapters: 21 },
  { name: 'Ruth', abbreviation: 'Ru', testament: 'old', order: 8, chapters: 4 },
  { name: '1 Samuel', abbreviation: '1S', testament: 'old', order: 9, chapters: 31 },
  { name: '2 Samuel', abbreviation: '2S', testament: 'old', order: 10, chapters: 24 },
  { name: '1 Kings', abbreviation: '1K', testament: 'old', order: 11, chapters: 22 },
  { name: '2 Kings', abbreviation: '2K', testament: 'old', order: 12, chapters: 25 },
  { name: '1 Chronicles', abbreviation: '1Ch', testament: 'old', order: 13, chapters: 29 },
  { name: '2 Chronicles', abbreviation: '2Ch', testament: 'old', order: 14, chapters: 36 },
  { name: 'Ezra', abbreviation: 'Ez', testament: 'old', order: 15, chapters: 10 },
  { name: 'Nehemiah', abbreviation: 'Ne', testament: 'old', order: 16, chapters: 13 },
  { name: 'Esther', abbreviation: 'Es', testament: 'old', order: 17, chapters: 10 },
  { name: 'Job', abbreviation: 'Job', testament: 'old', order: 18, chapters: 42 },
  { name: 'Psalms', abbreviation: 'Ps', testament: 'old', order: 19, chapters: 150 },
  { name: 'Proverbs', abbreviation: 'Pr', testament: 'old', order: 20, chapters: 31 },
  { name: 'Ecclesiastes', abbreviation: 'Ec', testament: 'old', order: 21, chapters: 12 },
  { name: 'Song of Solomon', abbreviation: 'So', testament: 'old', order: 22, chapters: 8 },
  { name: 'Isaiah', abbreviation: 'Is', testament: 'old', order: 23, chapters: 66 },
  { name: 'Jeremiah', abbreviation: 'Je', testament: 'old', order: 24, chapters: 52 },
  { name: 'Lamentations', abbreviation: 'La', testament: 'old', order: 25, chapters: 5 },
  { name: 'Ezekiel', abbreviation: 'Eze', testament: 'old', order: 26, chapters: 48 },
  { name: 'Daniel', abbreviation: 'Da', testament: 'old', order: 27, chapters: 12 },
  { name: 'Hosea', abbreviation: 'Ho', testament: 'old', order: 28, chapters: 14 },
  { name: 'Joel', abbreviation: 'Joe', testament: 'old', order: 29, chapters: 3 },
  { name: 'Amos', abbreviation: 'Am', testament: 'old', order: 30, chapters: 9 },
  { name: 'Obadiah', abbreviation: 'Ob', testament: 'old', order: 31, chapters: 1 },
  { name: 'Jonah', abbreviation: 'Jon', testament: 'old', order: 32, chapters: 4 },
  { name: 'Micah', abbreviation: 'Mi', testament: 'old', order: 33, chapters: 7 },
  { name: 'Nahum', abbreviation: 'Na', testament: 'old', order: 34, chapters: 3 },
  { name: 'Habakkuk', abbreviation: 'Ha', testament: 'old', order: 35, chapters: 3 },
  { name: 'Zephaniah', abbreviation: 'Ze', testament: 'old', order: 36, chapters: 3 },
  { name: 'Haggai', abbreviation: 'Hag', testament: 'old', order: 37, chapters: 2 },
  { name: 'Zechariah', abbreviation: 'Zec', testament: 'old', order: 38, chapters: 14 },
  { name: 'Malachi', abbreviation: 'Ma', testament: 'old', order: 39, chapters: 4 },
  { name: 'Matthew', abbreviation: 'Mt', testament: 'new', order: 40, chapters: 28 },
  { name: 'Mark', abbreviation: 'Mk', testament: 'new', order: 41, chapters: 16 },
  { name: 'Luke', abbreviation: 'Lu', testament: 'new', order: 42, chapters: 24 },
  { name: 'John', abbreviation: 'Jn', testament: 'new', order: 43, chapters: 21 },
  { name: 'Acts', abbreviation: 'Ac', testament: 'new', order: 44, chapters: 28 },
  { name: 'Romans', abbreviation: 'Ro', testament: 'new', order: 45, chapters: 16 },
  { name: '1 Corinthians', abbreviation: '1Co', testament: 'new', order: 46, chapters: 16 },
  { name: '2 Corinthians', abbreviation: '2Co', testament: 'new', order: 47, chapters: 13 },
  { name: 'Galatians', abbreviation: 'Ga', testament: 'new', order: 48, chapters: 6 },
  { name: 'Ephesians', abbreviation: 'Ep', testament: 'new', order: 49, chapters: 6 },
  { name: 'Philippians', abbreviation: 'Ph', testament: 'new', order: 50, chapters: 4 },
  { name: 'Colossians', abbreviation: 'Col', testament: 'new', order: 51, chapters: 4 },
  { name: '1 Thessalonians', abbreviation: '1Th', testament: 'new', order: 52, chapters: 5 },
  { name: '2 Thessalonians', abbreviation: '2Th', testament: 'new', order: 53, chapters: 3 },
  { name: '1 Timothy', abbreviation: '1Ti', testament: 'new', order: 54, chapters: 6 },
  { name: '2 Timothy', abbreviation: '2Ti', testament: 'new', order: 55, chapters: 4 },
  { name: 'Titus', abbreviation: 'Tit', testament: 'new', order: 56, chapters: 3 },
  { name: 'Philemon', abbreviation: 'Phm', testament: 'new', order: 57, chapters: 1 },
  { name: 'Hebrews', abbreviation: 'He', testament: 'new', order: 58, chapters: 13 },
  { name: 'James', abbreviation: 'Ja', testament: 'new', order: 59, chapters: 5 },
  { name: '1 Peter', abbreviation: '1P', testament: 'new', order: 60, chapters: 5 },
  { name: '2 Peter', abbreviation: '2P', testament: 'new', order: 61, chapters: 3 },
  { name: '1 John', abbreviation: '1J', testament: 'new', order: 62, chapters: 5 },
  { name: '2 John', abbreviation: '2J', testament: 'new', order: 63, chapters: 1 },
  { name: '3 John', abbreviation: '3J', testament: 'new', order: 64, chapters: 1 },
  { name: 'Jude', abbreviation: 'Jud', testament: 'new', order: 65, chapters: 1 },
  { name: 'Revelation', abbreviation: 'Re', testament: 'new', order: 66, chapters: 22 },
];

// Map various abbreviations to standard ones
const abbrMap: Record<string, string> = {
  'Ge': 'Ge', 'Ge1': 'Ge', 'Gen': 'Ge', 'Gn': 'Ge',
  'Ex': 'Ex', 'Ex1': 'Ex', 'Exo': 'Ex', 'Exo1': 'Ex',
  'Le': 'Le', 'Lev': 'Le', 'Lv': 'Le',
  'Nu': 'Nu', 'Num': 'Nu', 'Nm': 'Nu',
  'De': 'De', 'De1': 'De', 'Deu': 'De', 'Dt': 'De',
  'Jo': 'Jo', 'Jos': 'Jo', 'Josh': 'Jo', 'Jos1': 'Jo',
  'Ju': 'Ju', 'Jd': 'Ju', 'Jdgs': 'Ju', 'Judg': 'Ju', 'Jdg': 'Ju',
  'Ru': 'Ru', 'Rut': 'Ru', 'Rth': 'Ru',
  '1S': '1S', '1Sa': '1S', '1Sam': '1S', '1Saml': '1S', '1Sm': '1S', '1Sm1': '1S',
  '2S': '2S', '2Sa': '2S', '2Sam': '2S', '2Saml': '2S', '2Sm': '2S', '2Sm1': '2S',
  '1K': '1K', '1Ki': '1K', '1Kgs': '1K', '1Kg': '1K',
  '2K': '2K', '2Ki': '2K', '2Kgs': '2K', '2Kg': '2K',
  '1Ch': '1Ch', '1Chr': '1Ch', '1Chrl': '1Ch', '1Chron': '1Ch',
  '2Ch': '2Ch', '2Chr': '2Ch', '2Chrl': '2Ch', '2Chron': '2Ch',
  'Ez': 'Ez', 'Ezr': 'Ez', 'Ezra': 'Ez',
  'Ne': 'Ne', 'Neh': 'Ne', 'Neh1': 'Ne',
  'Es': 'Es', 'Est': 'Es', 'Esth': 'Es', 'Est1': 'Es',
  'Job': 'Job', 'Jb': 'Job',
  'Ps': 'Ps', 'Psa': 'Ps', 'Psalms': 'Ps', 'Psm': 'Ps',
  'Pr': 'Pr', 'Pro': 'Pr', 'Prov': 'Pr', 'Prv': 'Pr',
  'Ec': 'Ec', 'Eccl': 'Ec', 'Ecc': 'Ec', 'Eccles': 'Ec',
  'So': 'So', 'Song': 'So', 'SSol': 'So', 'Sng': 'So', 'Cant': 'So',
  'Is': 'Is', 'Isa': 'Is', 'Is1': 'Is',
  'Je': 'Je', 'Jer': 'Je', 'Jer1': 'Je',
  'La': 'La', 'Lam': 'La', 'Lmnt': 'La',
  'Eze': 'Eze', 'Ezek': 'Eze', 'Ezk': 'Eze', 'Eze1': 'Eze',
  'Da': 'Da', 'Dan': 'Da', 'Dn': 'Da',
  'Ho': 'Ho', 'Hos': 'Ho', 'Hosea': 'Ho',
  'Joe': 'Joe', 'Joel': 'Joe', 'Jl': 'Joe',
  'Am': 'Am', 'Amo': 'Am', 'Amos': 'Am',
  'Ob': 'Ob', 'Oba': 'Ob', 'Obad': 'Ob', 'Obadiah': 'Ob',
  'Jon': 'Jon', 'Jnh': 'Jon', 'Jonah': 'Jon',
  'Mi': 'Mi', 'Mic': 'Mi', 'Micah': 'Mi',
  'Na': 'Na', 'Nah': 'Na', 'Nahum': 'Na',
  'Ha': 'Ha', 'Hab': 'Ha', 'Hab1': 'Ha',
  'Ze': 'Ze', 'Zep': 'Ze', 'Zeph': 'Ze', 'Zephaniah': 'Ze',
  'Hag': 'Hag', 'Hg': 'Hag',
  'Zec': 'Zec', 'Zech': 'Zec', 'Zc': 'Zec',
  'Ma': 'Ma', 'Mal': 'Ma', 'Malachi': 'Ma',
  'Mt': 'Mt', 'Mat': 'Mt', 'Matt': 'Mt', 'Mt1': 'Mt',
  'Mk': 'Mk', 'Mar': 'Mk', 'Mark': 'Mk', 'Mr': 'Mk',
  'Lu': 'Lu', 'Luk': 'Lu', 'Luke': 'Lu', 'Lk': 'Lu',
  'Jn': 'Jn', 'Joh': 'Jn', 'John': 'Jn', 'Jn1': 'Jn',
  'Ac': 'Ac', 'Act': 'Ac', 'Acts': 'Ac', 'Acts1': 'Ac',
  'Ro': 'Ro', 'Rom': 'Ro', 'Rom1': 'Ro',
  '1Co': '1Co', '1Cor': '1Co', '1Cor1': '1Co', '1Corinthians': '1Co',
  '2Co': '2Co', '2Cor': '2Co', '2Cor1': '2Co', '2Corinthians': '2Co',
  'Ga': 'Ga', 'Gal': 'Ga', 'Gal1': 'Ga',
  'Ep': 'Ep', 'Eph': 'Ep', 'Eph1': 'Ep', 'Ephes': 'Ep',
  'Ph': 'Ph', 'Phi': 'Ph', 'Phil': 'Ph', 'Php': 'Ph',
  'Col': 'Col', 'Col1': 'Col', 'Coloss': 'Col',
  '1Th': '1Th', '1Thes': '1Th', '1Thess': '1Th', '1Thess1': '1Th', '1Thes1': '1Th',
  '2Th': '2Th', '2Thes': '2Th', '2Thess': '2Th', '2Thess1': '2Th',
  '1Ti': '1Ti', '1Tim': '1Ti', '1Tim1': '1Ti', '1Timothy': '1Ti',
  '2Ti': '2Ti', '2Tim': '2Ti', '2Tim1': '2Ti', '2Timothy': '2Ti',
  'Tit': 'Tit', 'Titus': 'Tit',
  'Phm': 'Phm', 'Phlm': 'Phm', 'Phmn': 'Phm', 'Philem': 'Phm', 'Phlm1': 'Phm',
  'He': 'He', 'Heb': 'He', 'Heb1': 'He', 'Hebrews': 'He',
  'Ja': 'Ja', 'Jam': 'Ja', 'Jas': 'Ja', 'James': 'Ja',
  '1P': '1P', '1Pe': '1P', '1Pet': '1P', '1Pet1': '1P', '1Peter': '1P',
  '2P': '2P', '2Pe': '2P', '2Pet': '2P', '2Pet1': '2P', '2Peter': '2P',
  '1J': '1J', '1Jo': '1J', '1John': '1J', '1John1': '1J',
  '2J': '2J', '2Jo': '2J', '2John': '2J', '2John1': '2J',
  '3J': '3J', '3Jo': '3J', '3John': '3J', '3John1': '3J',
  'Jud': 'Jud', 'Jude': 'Jud', 'Jud1': 'Jud',
  'Re': 'Re', 'Rev': 'Re', 'Rev1': 'Re', 'Revel': 'Re', 'Rev2': 'Re',
};

const kjvText = readFileSync('./kjv.txt', 'utf-8');
const lines = kjvText.split('\n');

const verses = [];
const chapterVerseCounts = new Map();

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
  // Match pattern: BookAbbr + Chapter:Verse (e.g., "Ge1:1", "1Sam1:1", "Rev22:1")
  // The format is: letters (possibly with leading digit) + digits (chapter) + : + digits (verse)
  const match = line.match(/^([A-Za-z0-9]+?)(\d+):(\d+)\s+(.*)$/);
  if (!match) continue;
  
  let rawAbbr = match[1];
  const chapter = match[2];
  const verseNum = match[3];
  const text = match[4];
  
  // The regex is non-greedy but may still capture some chapter digits
  // Try to match against known abbreviations
  let bookAbbr = abbrMap[rawAbbr];
  
  // If not found, try stripping trailing digits that might be chapter numbers
  if (!bookAbbr) {
    const stripped = rawAbbr.replace(/\d+$/, '');
    bookAbbr = abbrMap[stripped];
  }
  
  // If still not found, try adding common suffixes
  if (!bookAbbr) {
    for (const [key, value] of Object.entries(abbrMap)) {
      if (rawAbbr.startsWith(key)) {
        bookAbbr = value;
        break;
      }
    }
  }
  
  if (!bookAbbr) {
    console.error(`Unknown book abbreviation: ${rawAbbr}`);
    continue;
  }
  
  const book = kjvBooks.find(b => b.abbreviation === bookAbbr);
  if (!book) {
    console.error(`No book found for abbreviation: ${bookAbbr}`);
    continue;
  }
  
  const chapterKey = `${bookAbbr}${chapter}`;
  chapterVerseCounts.set(chapterKey, (chapterVerseCounts.get(chapterKey) || 0) + 1);
  
  const reference = `${book.name} ${chapter}:${verseNum}`;
  
  const keywords = extractKeywords(text);
  const difficulty = assessDifficulty(text);
  const theme = identifyTheme(text);
  
  verses.push({
    book: { name: book.name, abbreviation: book.abbreviation, testament: book.testament, order: book.order, chapters: book.chapters },
    chapter: { book: book, number: parseInt(chapter), verseCount: chapterVerseCounts.get(chapterKey) },
    number: parseInt(verseNum),
    text: text,
    reference: reference,
    keywords,
    difficulty,
    theme,
  });
}

function extractKeywords(text: string, maxCount = 10): string[] {
  const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'it', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'what', 'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'as', 'if', 'then', 'because', 'while', 'although', 'though', 'after', 'before', 'until', 'unless', 'since', 'except', 'through', 'during', 'without', 'toward', 'under', 'over', 'between', 'into', 'through', 'onto', 'upon', 'about', 'against', 'among', 'beside', 'beyond', 'near', 'off', 'up', 'down', 'out', 'off', 'away', 'back', 'here', 'there', 'where', 'when', 'how', 'why', 'said', 'saying', 'saith', 'unto', 'hath', 'thou', 'ye', 'thy', 'thine', 'thee', 'hath', 'doth', 'spake', 'spake', 'hath', 'hath']);
  
  const words = text.toLowerCase().replace(/[.,;:!?'"()]/g, '').split(/\s+/);
  const keywords = words
    .filter(word => word.length > 3 && !commonWords.has(word))
    .slice(0, 10);
  
  return [...new Set(keywords)];
}

function assessDifficulty(text: string): 'easy' | 'medium' | 'hard' {
  const wordCount = text.split(/\s+/).length;
  const avgWordLength = text.replace(/[^a-z]/gi, '').length / wordCount;
  const uniqueWords = new Set(text.toLowerCase().split(/\s+/)).size;
  
  if (wordCount < 15 && avgWordLength < 5) return 'easy';
  if (wordCount > 30 || avgWordLength > 6 || uniqueWords > 15) return 'hard';
  return 'medium';
}

function identifyTheme(text: string): string {
  const themes: Record<string, RegExp[]> = {
    faith: [/faith/i, /believe/i, /trust/i],
    love: [/love/i, /charity/i],
    hope: [/hope/i, /expect/i],
    salvation: [/save/i, /salvation/i, /redeem/i],
    righteousness: [/righteous/i, /justify/i],
    grace: [/grace/i, /mercy/i],
    judgment: [/judge/i, /wrath/i, /condemn/i],
    covenant: [/covenant/i, /promise/i, /testament/i],
    creation: [/create/i, /beginning/i, /heaven/i, /earth/i],
    obedience: [/obey/i, /commandment/i, /statute/i],
    prayer: [/pray/i, /prayer/i, /cry/i, /supplication/i],
    wisdom: [/wisdom/i, /understanding/i, /knowledge/i],
    forgiveness: [/forgive/i, /pardon/i, /iniquity/i],
    resurrection: [/rise/i, /resurrect/i, /life/i],
    kingdom: [/kingdom/i, /king/i, /reign/i],
    spirit: [/spirit/i, /holy spirit/i, /comforter/i],
    church: [/church/i, /assembly/i, /body/i],
    prophecy: [/prophecy/i, /prophet/i, /foretell/i],
    blessing: [/bless/i, /blessing/i],
    sin: [/sin/i, /transgression/i, /iniquity/i],
  };
  
  for (const [theme, patterns] of Object.entries(themes)) {
    if (patterns.some(pattern => pattern.test(text))) {
      return theme;
    }
  }
  
  return 'general';
}

const seedData = {
  books: kjvBooks,
  verses: verses.map(v => ({
    book: v.book,
    chapter: v.chapter,
    number: v.number,
    text: v.text,
    reference: v.reference,
    keywords: v.keywords,
    difficulty: v.difficulty,
    theme: v.theme,
  })),
};

writeFileSync('./seed-data.json', JSON.stringify(seedData, null, 2));
console.log(`Processed ${verses.length} verses from ${kjvBooks.length} books`);
console.log('Seed data written to seed-data.json');
