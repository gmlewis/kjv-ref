import { format, addDays, differenceInDays } from 'date-fns';

export interface SpacedRepetitionSchedule {
  interval: number;
  easeFactor: number;
  dueDate: Date;
}

export function calculateNextReview(
  currentSchedule: SpacedRepetitionSchedule,
  performance: 'excellent' | 'good' | 'poor'
): SpacedRepetitionSchedule {
  const { interval, easeFactor } = currentSchedule;
  
  let newEaseFactor = easeFactor;
  let newInterval: number;
  
  switch (performance) {
    case 'excellent':
      newEaseFactor = Math.min(3.0, easeFactor + 0.1);
      newInterval = Math.round(interval * newEaseFactor);
      break;
    case 'good':
      newInterval = Math.round(interval * easeFactor);
      break;
    case 'poor':
      newEaseFactor = Math.max(1.3, easeFactor - 0.2);
      newInterval = 1;
      break;
  }
  
  return {
    interval: newInterval,
    easeFactor: newEaseFactor,
    dueDate: addDays(new Date(), newInterval),
  };
}

export function getInitialSchedule(): SpacedRepetitionSchedule {
  return {
    interval: 1,
    easeFactor: 2.5,
    dueDate: addDays(new Date(), 1),
  };
}

export function isDue(schedule: SpacedRepetitionSchedule): boolean {
  return schedule.dueDate <= new Date();
}

export function getDaysUntilDue(schedule: SpacedRepetitionSchedule): number {
  return differenceInDays(schedule.dueDate, new Date());
}

export function getDifficultyLabel(difficulty: string): string {
  switch (difficulty) {
    case 'easy':
      return 'Beginner';
    case 'medium':
      return 'Intermediate';
    case 'hard':
      return 'Advanced';
    default:
      return 'Unknown';
  }
}

export function formatVerseReference(book: string, chapter: number, verse: number): string {
  return `${book} ${chapter}:${verse}`;
}

export function extractKeywords(text: string, maxCount = 10): string[] {
  const commonWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
    'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'it', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they',
    'said', 'saying', 'saith', 'unto', 'hath', 'thou', 'ye', 'thy', 'thee', 'doth'
  ]);
  
  const words = text.replace(/[.,;:!?'"()]/g, '').split(/\s+/);
  const keywords = words
    .filter(word => word.length > 2 && !commonWords.has(word.toLowerCase()));
  // Dedup BEFORE slicing to maxCount — otherwise repeated early keywords
  // crowd out later unique keywords (e.g. "love ... love grace" with a small
  // maxCount would drop "grace" entirely).
  return [...new Set(keywords)].slice(0, maxCount);
}

export function assessDifficulty(text: string): 'easy' | 'medium' | 'hard' {
  // Trim and drop empty tokens so leading/trailing/extra whitespace does not
  // inflate the word count (which would dilute the average word length and
  // misclassify a single long word as "easy"). Empty input is trivially easy.
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  if (wordCount === 0) return 'easy';
  const avgWordLength = text.replace(/[^a-z]/gi, '').length / wordCount;
  const uniqueWords = new Set(words.map(w => w.toLowerCase())).size;

  if (wordCount < 15 && avgWordLength < 4.5) return 'easy';
  if (wordCount > 30 || avgWordLength > 6 || uniqueWords > 15) return 'hard';
  return 'medium';
}

export function calculateStreak(lastPracticedDates: Date[]): number {
  if (lastPracticedDates.length === 0) return 0;

  const sorted = [...lastPracticedDates].sort((a, b) => b.getTime() - a.getTime());

  // A streak is only "current" if the most recent practice was today or
  // yesterday (a one-day grace so a streak earned yesterday is not broken
  // until the day actually ends). Without this check, any non-empty history
  // — even a single practice from weeks ago — reported a phantom 1-day streak.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const mostRecent = new Date(sorted[0]);
  mostRecent.setHours(0, 0, 0, 0);
  if (differenceInDays(today, mostRecent) > 1) return 0;

  let streak = 1;

  for (let i = 1; i < sorted.length; i++) {
    const diff = differenceInDays(sorted[i - 1], sorted[i]);
    if (diff === 1) {
      streak++;
    } else if (diff > 1) {
      break;
    }
  }

  return streak;
}

export function formatRelativeDate(date: Date): string {
  const today = new Date();
  const diff = differenceInDays(date, today);
  
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 0 && diff <= 7) return `In ${diff} days`;
  if (diff < 0 && diff >= -7) return `${Math.abs(diff)} days ago`;
  
  return format(date, 'MMM d, yyyy');
}

export function getProgressPercentage(current: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((current / total) * 100);
}

export function generateBlankVerse(text: string, blankCount = 3): string {
  const words = text.split(' ');
  if (words.length <= 5) return text;
  
  const indices = new Set<number>();
  while (indices.size < Math.min(blankCount, Math.floor(words.length / 3))) {
    indices.add(Math.floor(Math.random() * words.length));
  }
  
  return words.map((word, i) => indices.has(i) ? '_____' : word).join(' ');
}
