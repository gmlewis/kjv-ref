export interface KJVVerse {
  reference: string;
  book: string;
  chapter: number;
  verse: number;
  text: string;
  keywords: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  theme: string;
}

export const KJV_VERSES: KJVVerse[] = [
  { reference: 'Genesis 1:1', book: 'Genesis', chapter: 1, verse: 1, text: 'In the beginning God created the heaven and the earth.', keywords: ['beginning', 'God', 'created', 'heaven', 'earth'], difficulty: 'easy', theme: 'creation' },
  { reference: 'Genesis 1:27', book: 'Genesis', chapter: 1, verse: 27, text: 'So God created man in his own image, in the image of God created he him; male and female created he them.', keywords: ['God', 'created', 'man', 'image', 'male', 'female'], difficulty: 'medium', theme: 'creation' },
  { reference: 'Genesis 3:15', book: 'Genesis', chapter: 3, verse: 15, text: 'And I will put enmity between thee and the woman, and between thy seed and her seed; it shall bruise thy head, and thou shalt bruise his heel.', keywords: ['enmity', 'woman', 'seed', 'bruise', 'head', 'heel'], difficulty: 'hard', theme: 'prophecy' },
  { reference: 'Exodus 20:3', book: 'Exodus', chapter: 20, verse: 3, text: 'Thou shalt have no other gods before me.', keywords: ['gods', 'before', 'me'], difficulty: 'easy', theme: 'commandments' },
  { reference: 'Deuteronomy 6:5', book: 'Deuteronomy', chapter: 6, verse: 5, text: 'And thou shalt love the LORD thy God with all thine heart, and with all thy soul, and with all thy might.', keywords: ['love', 'LORD', 'God', 'heart', 'soul', 'might'], difficulty: 'easy', theme: 'love' },
  { reference: 'Joshua 1:9', book: 'Joshua', chapter: 1, verse: 9, text: 'Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.', keywords: ['strong', 'courage', 'afraid', 'dismayed', 'LORD', 'God'], difficulty: 'hard', theme: 'courage' },
  { reference: 'Psalm 1:1', book: 'Psalms', chapter: 1, verse: 1, text: 'Blessed is the man that walketh not in the counsel of the ungodly, nor standeth in the way of sinners, nor sitteth in the seat of the scornful.', keywords: ['Blessed', 'walketh', 'counsel', 'ungodly', 'sinners', 'scornful'], difficulty: 'medium', theme: 'wisdom' },
  { reference: 'Psalm 23:1', book: 'Psalms', chapter: 23, verse: 1, text: 'The LORD is my shepherd; I shall not want.', keywords: ['LORD', 'shepherd', 'want'], difficulty: 'easy', theme: 'faith' },
  { reference: 'Psalm 23:4', book: 'Psalms', chapter: 23, verse: 4, text: 'Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me.', keywords: ['valley', 'shadow', 'death', 'fear', 'evil', 'rod', 'staff', 'comfort'], difficulty: 'medium', theme: 'faith' },
  { reference: 'Psalm 46:10', book: 'Psalms', chapter: 46, verse: 10, text: 'Be still, and know that I am God: I will be exalted among the heathen, I will be exalted in the earth.', keywords: ['still', 'know', 'God', 'exalted', 'heathen', 'earth'], difficulty: 'easy', theme: 'faith' },
  { reference: 'Psalm 91:1', book: 'Psalms', chapter: 91, verse: 1, text: 'He that dwelleth in the secret place of the most High shall abide under the shadow of the Almighty.', keywords: ['dwelleth', 'secret', 'High', 'abide', 'shadow', 'Almighty'], difficulty: 'medium', theme: 'protection' },
  { reference: 'Psalm 100:1', book: 'Psalms', chapter: 100, verse: 1, text: 'Make a joyful noise unto the LORD, all ye lands.', keywords: ['joyful', 'noise', 'LORD', 'lands'], difficulty: 'easy', theme: 'worship' },
  { reference: 'Psalm 119:11', book: 'Psalms', chapter: 119, verse: 11, text: 'Thy word have I hid in mine heart, that I might not sin against thee.', keywords: ['word', 'hid', 'heart', 'sin'], difficulty: 'easy', theme: 'obedience' },
  { reference: 'Psalm 119:105', book: 'Psalms', chapter: 119, verse: 105, text: 'Thy word is a lamp unto my feet, and a light unto my path.', keywords: ['word', 'lamp', 'feet', 'light', 'path'], difficulty: 'easy', theme: 'scripture' },
  { reference: 'Proverbs 3:5', book: 'Proverbs', chapter: 3, verse: 5, text: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding.', keywords: ['Trust', 'LORD', 'heart', 'lean', 'understanding'], difficulty: 'easy', theme: 'wisdom' },
  { reference: 'Proverbs 3:6', book: 'Proverbs', chapter: 3, verse: 6, text: 'In all thy ways acknowledge him, and he shall direct thy paths.', keywords: ['ways', 'acknowledge', 'direct', 'paths'], difficulty: 'easy', theme: 'wisdom' },
  { reference: 'Proverbs 16:3', book: 'Proverbs', chapter: 16, verse: 3, text: 'Commit thy works unto the LORD, and thy thoughts shall be established.', keywords: ['Commit', 'works', 'LORD', 'thoughts', 'established'], difficulty: 'easy', theme: 'wisdom' },
  { reference: 'Isaiah 40:31', book: 'Isaiah', chapter: 40, verse: 31, text: 'But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.', keywords: ['wait', 'LORD', 'renew', 'strength', 'eagles', 'weary', 'faint'], difficulty: 'hard', theme: 'strength' },
  { reference: 'Isaiah 53:5', book: 'Isaiah', chapter: 53, verse: 5, text: 'But he was wounded for our transgressions, he was bruised for our iniquities: the chastisement of our peace was upon him; and with his stripes we are healed.', keywords: ['wounded', 'transgressions', 'bruised', 'iniquities', 'peace', 'stripes', 'healed'], difficulty: 'hard', theme: 'salvation' },
  { reference: 'Jeremiah 29:11', book: 'Jeremiah', chapter: 29, verse: 11, text: 'For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.', keywords: ['thoughts', 'LORD', 'peace', 'evil', 'expected', 'end'], difficulty: 'medium', theme: 'hope' },
  { reference: 'Matthew 5:3', book: 'Matthew', chapter: 5, verse: 3, text: 'Blessed are the poor in spirit: for theirs is the kingdom of heaven.', keywords: ['Blessed', 'poor', 'spirit', 'kingdom', 'heaven'], difficulty: 'easy', theme: 'beatitudes' },
  { reference: 'Matthew 6:33', book: 'Matthew', chapter: 6, verse: 33, text: 'But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you.', keywords: ['seek', 'kingdom', 'God', 'righteousness', 'things', 'added'], difficulty: 'medium', theme: 'faith' },
  { reference: 'Matthew 11:28', book: 'Matthew', chapter: 11, verse: 28, text: 'Come unto me, all ye that labour and are heavy laden, and I will give you rest.', keywords: ['Come', 'labour', 'heavy', 'laden', 'rest'], difficulty: 'easy', theme: 'comfort' },
  { reference: 'Matthew 28:19', book: 'Matthew', chapter: 28, verse: 19, text: 'Go ye therefore, and teach all nations, baptizing them in the name of the Father, and of the Son, and of the Holy Ghost:', keywords: ['teach', 'nations', 'baptizing', 'Father', 'Son', 'Holy Ghost'], difficulty: 'medium', theme: 'mission' },
  { reference: 'John 1:1', book: 'John', chapter: 1, verse: 1, text: 'In the beginning was the Word, and the Word was with God, and the Word was God.', keywords: ['beginning', 'Word', 'God'], difficulty: 'easy', theme: 'theology' },
  { reference: 'John 3:16', book: 'John', chapter: 3, verse: 16, text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.', keywords: ['God', 'loved', 'world', 'Son', 'believeth', 'perish', 'everlasting'], difficulty: 'medium', theme: 'salvation' },
  { reference: 'John 14:6', book: 'John', chapter: 14, verse: 6, text: 'Jesus saith unto him, I am the way, the truth, and the life: no man cometh unto the Father, but by me.', keywords: ['Jesus', 'way', 'truth', 'life', 'Father'], difficulty: 'easy', theme: 'salvation' },
  { reference: 'Romans 3:23', book: 'Romans', chapter: 3, verse: 23, text: 'For all have sinned, and come short of the glory of God;', keywords: ['sinned', 'short', 'glory', 'God'], difficulty: 'easy', theme: 'salvation' },
  { reference: 'Romans 6:23', book: 'Romans', chapter: 6, verse: 23, text: 'For the wages of sin is death; but the gift of God is eternal life through Jesus Christ our Lord.', keywords: ['wages', 'sin', 'death', 'gift', 'God', 'eternal', 'life', 'Jesus', 'Christ'], difficulty: 'medium', theme: 'salvation' },
  { reference: 'Romans 8:28', book: 'Romans', chapter: 8, verse: 28, text: 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.', keywords: ['things', 'work', 'good', 'love', 'God', 'called', 'purpose'], difficulty: 'hard', theme: 'faith' },
  { reference: 'Romans 12:2', book: 'Romans', chapter: 12, verse: 2, text: 'And be not conformed to this world: but be ye transformed by the renewing of your mind, that ye may prove what is that good, and acceptable, and perfect, will of God.', keywords: ['conformed', 'world', 'transformed', 'renewing', 'mind', 'prove', 'good', 'perfect', 'God'], difficulty: 'hard', theme: 'transformation' },
  { reference: 'Ephesians 2:8', book: 'Ephesians', chapter: 2, verse: 8, text: 'For by grace are ye saved through faith; and that not of yourselves: it is the gift of God:', keywords: ['grace', 'saved', 'faith', 'yourselves', 'gift', 'God'], difficulty: 'medium', theme: 'salvation' },
  { reference: 'Philippians 4:13', book: 'Philippians', chapter: 4, verse: 13, text: 'I can do all things through Christ which strengtheneth me.', keywords: ['things', 'Christ', 'strengtheneth'], difficulty: 'easy', theme: 'strength' },
  { reference: 'Philippians 4:19', book: 'Philippians', chapter: 4, verse: 19, text: 'But my God shall supply all your need according to his riches in glory by Christ Jesus.', keywords: ['God', 'supply', 'need', 'riches', 'glory', 'Christ', 'Jesus'], difficulty: 'medium', theme: 'provision' },
  { reference: 'Colossians 3:23', book: 'Colossians', chapter: 3, verse: 23, text: 'And whatsoever ye do, do it heartily, as to the Lord, and not unto men;', keywords: ['whatsoever', 'heartily', 'Lord', 'men'], difficulty: 'easy', theme: 'work' },
  { reference: '2 Timothy 3:16', book: '2 Timothy', chapter: 3, verse: 16, text: 'All scripture is given by inspiration of God, and is profitable for doctrine, for reproof, for correction, for instruction in righteousness:', keywords: ['scripture', 'inspiration', 'God', 'doctrine', 'reproof', 'correction', 'instruction'], difficulty: 'medium', theme: 'scripture' },
  { reference: 'Hebrews 11:1', book: 'Hebrews', chapter: 11, verse: 1, text: 'Now faith is the substance of things hoped for, the evidence of things not seen.', keywords: ['faith', 'substance', 'things', 'hoped', 'evidence', 'seen'], difficulty: 'easy', theme: 'faith' },
  { reference: 'James 1:5', book: 'James', chapter: 1, verse: 5, text: 'If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him.', keywords: ['wisdom', 'ask', 'God', 'giveth', 'liberally', 'upbraideth'], difficulty: 'medium', theme: 'wisdom' },
  { reference: '1 John 1:9', book: '1 John', chapter: 1, verse: 9, text: 'If we confess our sins, he is faithful and just to forgive us our sins, and to cleanse us from all unrighteousness.', keywords: ['confess', 'sins', 'faithful', 'just', 'forgive', 'cleanse', 'unrighteousness'], difficulty: 'medium', theme: 'forgiveness' },
  { reference: 'Revelation 3:20', book: 'Revelation', chapter: 3, verse: 20, text: 'Behold, I stand at the door, and knock: if any man hear my voice, and open the door, I will come in to him, and will sup with him, and he with me.', keywords: ['Behold', 'door', 'knock', 'hear', 'voice', 'open', 'sup'], difficulty: 'medium', theme: 'salvation' },
];

export function getVersesByBook(bookName: string): KJVVerse[] {
  return KJV_VERSES.filter(v => v.book === bookName);
}

export function getVersesByChapter(bookName: string, chapter: number): KJVVerse[] {
  return KJV_VERSES.filter(v => v.book === bookName && v.chapter === chapter);
}

export function findVerse(reference: string): KJVVerse | undefined {
  return KJV_VERSES.find(v => v.reference === reference);
}
