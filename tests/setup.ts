/**
 * Test setup: a memory-backed localStorage polyfill exposed as a minimal
 * `window`, letting the browser-only storage layer (lib/storage.ts) run in
 * node. Destroyed between tests to simulate fresh page loads.
 */

const store = new Map<string, string>();

const memoryStorage = {
  getItem(name: string): string | null {
    return store.has(name) ? (store.get(name) as string) : null;
  },
  setItem(name: string, value: string): void {
    store.set(name, String(value));
  },
  removeItem(name: string): void {
    store.delete(name);
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

(globalThis as { window?: unknown }).window = { localStorage: memoryStorage };

export {};
