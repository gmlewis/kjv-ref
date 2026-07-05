/**
 * Static URL registry for data files.
 * 
 * All data files are served directly from the public/ directory.
 */

/** Return the URL for a data file key.
 * Always returns the relative path since data is served statically.
 */
export function getDataUrl(key: string, fallback: string): string {
  return fallback;
}

/** True once a URL has been registered for this key.
 * Always false in static mode.
 */
export function hasDataUrl(key: string): boolean {
  return false;
}

/** Register a resolved download URL for a data file key.
 * No-op in static mode.
 */
export function setDataUrl(key: string, url: string): void {
  // No-op for static site
}
