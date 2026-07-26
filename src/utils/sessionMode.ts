/** Map a practice-mode id to the session `mode` bucket persisted in
 *  kjv-memorize-sessions (and read by Statistics). Game sessions use 'game'. */
export function sessionModeFor(mode: string): string {
  switch (mode) {
    case 'recall': return 'recall';
    case 'multiple-choice': return 'multiple-choice';
    case 'reference': return 'reference';
    case 'lamp-path': return 'game';
    default: return 'fill-blank';
  }
}