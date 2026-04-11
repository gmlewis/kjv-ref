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
    .filter(word => word.length > 2 && !commonWords.has(word.toLowerCase()))
    .slice(0, maxCount);
  
  return [...new Set(keywords)];
}

export function assessDifficulty(text: string): 'easy' | 'medium' | 'hard' {
  const wordCount = text.split(/\s+/).length;
  const avgWordLength = text.replace(/[^a-z]/gi, '').length / wordCount;
  const uniqueWords = new Set(text.toLowerCase().split(/\s+/)).size;
  
  if (wordCount < 15 && avgWordLength < 4.5) return 'easy';
  if (wordCount > 30 || avgWordLength > 6 || uniqueWords > 15) return 'hard';
  return 'medium';
}

export function calculateStreak(lastPracticedDates: Date[]): number {
  if (lastPracticedDates.length === 0) return 0;
  
  const sorted = [...lastPracticedDates].sort((a, b) => b.getTime() - a.getTime());
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
