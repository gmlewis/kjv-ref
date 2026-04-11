/**
 * Runtime URL registry for large reference data files.
 *
 * In production the app is deployed WITHOUT the large static data files.
 * Instead, those files live in Prophet file storage. React components use
 * useFile() to get presigned download URLs, then register them here so that
 * the plain-fetch data loaders (kjv-bible.ts, strongs.ts, interlinear.ts)
 * can pick them up without needing React context.
 *
 * In development the registry stays empty and all loaders fall back to the
 * relative URLs served by Vite from the public/ directory.
 */

const _urls = new Map<string, string>();

/** Register a resolved download URL for a data file key. */
export function setDataUrl(key: string, url: string): void {
  _urls.set(key, url);
}

/**
 * Return the registered URL for `key`, or `fallback` if not yet registered.
 * The fallback is the relative path used in development.
 */
export function getDataUrl(key: string, fallback: string): string {
  return _urls.get(key) ?? fallback;
}

/** True once a URL has been registered for this key. */
export function hasDataUrl(key: string): boolean {
  return _urls.has(key);
}
