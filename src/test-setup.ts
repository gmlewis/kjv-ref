import '@testing-library/jest-dom';

// Polyfill localStorage for Bun's test runner (jsdom provides it, but Bun may not)
if (typeof globalThis.localStorage === 'undefined' || !globalThis.localStorage) {
  const store = new Map<string, string>();
  const localStoragePolyfill = {
    getItem(key: string): string | null {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string): void {
      store.set(key, String(value));
    },
    removeItem(key: string): void {
      store.delete(key);
    },
    clear(): void {
      store.clear();
    },
    key(index: number): string | null {
      return Array.from(store.keys())[index] ?? null;
    },
    get length(): number {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStoragePolyfill,
    writable: true,
    configurable: true,
  });
}
