import type { KJVVerse } from '../data/kjv-verses';
import type { ProgressEntry } from './types';
import { KJV_VERSES } from '../data/kjv-verses';

export interface Region {
  id: string;
  name: string;
  verses: KJVVerse[];
  /** Number of mastered lamps required in earlier regions before this unlocks. */
  unlockRequirement: { masteredInPriorRegions: number };
}

/**
 * The three starter regions, partitioning the curated verse set by difficulty.
 * Region 1 (easy) is always unlocked; region 2 (medium) unlocks at 5 mastered
 * lamps; region 3 (hard) unlocks at 12 mastered lamps.
 */
export function starterRegions(): Region[] {
  const easy = KJV_VERSES.filter(v => v.difficulty === 'easy');
  const medium = KJV_VERSES.filter(v => v.difficulty === 'medium');
  const hard = KJV_VERSES.filter(v => v.difficulty === 'hard');
  return [
    { id: 'gate', name: 'The Gate', verses: easy, unlockRequirement: { masteredInPriorRegions: 0 } },
    { id: 'hills', name: 'The Hills', verses: medium, unlockRequirement: { masteredInPriorRegions: 5 } },
    { id: 'river', name: 'The River', verses: hard, unlockRequirement: { masteredInPriorRegions: 12 } },
  ];
}

/**
 * Return the unlocked subset of `regions` (in order). A region is unlocked when
 * `masteredCount` (the player's total mastered lamps across all currently
 * unlocked regions) is at least its `masteredInPriorRegions` requirement.
 */
export function unlockedRegions(regions: Region[], masteredCount: number): Region[] {
  return regions.filter(r => masteredCount >= r.unlockRequirement.masteredInPriorRegions);
}

/**
 * Build a custom "road" region from an explicit list of references. `verses`
 * are filtered to those whose `reference` appears in `refs`, preserving the
 * `refs` order; references not found in `verses` are skipped. The resulting
 * region is immediately available for practice (unlock requirement 0).
 */
export function buildRoad(name: string, refs: string[], verses: KJVVerse[]): Region {
  const byRef = new Map<string, KJVVerse>();
  for (const v of verses) byRef.set(v.reference, v);
  const picked: KJVVerse[] = [];
  for (const ref of refs) {
    const v = byRef.get(ref);
    if (v) picked.push(v);
  }
  return {
    id: slugify(name),
    name,
    verses: picked,
    unlockRequirement: { masteredInPriorRegions: 0 },
  };
}

/**
 * Compute mastery progress for a region: `lit` is the number of the region's
 * verses whose reference has a progress entry with `status === 'mastered'`;
 * `total` is the number of verses in the region.
 */
export function masteryProgress(region: Region, progress: ProgressEntry[]): { lit: number; total: number } {
  const masteredRefs = new Set<string>();
  for (const p of progress) {
    if (p.status === 'mastered') masteredRefs.add(p.verse.reference);
  }
  let lit = 0;
  for (const v of region.verses) {
    if (masteredRefs.has(v.reference)) lit += 1;
  }
  return { lit, total: region.verses.length };
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}