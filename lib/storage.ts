/**
 * LocalStorage persistence layer.
 *
 * Safety rules (see README):
 * - ALL CertiChain data lives under the versioned namespace `certichain:v1:*`.
 *   Nothing outside the namespace is ever read, written, or erased.
 * - Malformed/corrupt JSON degrades to the fallback value (and a console
 *   warning) instead of crashing the app.
 * - Quota errors are caught and reported to the caller, so sync work never
 *   blocks the UI with an unhandled exception.
 */

import type { AppPreferences, DemoSession, VerificationLog, Certificate } from "./types";

export const STORAGE_NAMESPACE = "certichain";
export const STORAGE_VERSION = "v1";

const k = (name: string) => `${STORAGE_NAMESPACE}:${STORAGE_VERSION}:${name}`;

export const STORAGE_KEYS = {
  certificates: k("certificates"),
  verificationLogs: k("verification-logs"),
  session: k("session"),
  preferences: k("preferences"),
} as const;

function isBrowser(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

/** Detect usable LocalStorage (some private modes throw on access). */
export function storageAvailable(): boolean {
  if (!isBrowser()) return false;
  try {
    const probe = `${k("probe")}`;
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/** Read and parse a JSON key. Returns fallback when missing or malformed. */
export function readJson<T>(key: string, fallback: T): T {
  try {
    if (!isBrowser()) return fallback;
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed;
  } catch (error) {
    console.warn(`[CertiChain] Could not read storage key "${key}" — using fallback.`, error);
    return fallback;
  }
}

/** Write JSON to a key. Returns false on quota/unavailable errors. */
export function writeJson(key: string, value: unknown): boolean {
  try {
    if (!isBrowser()) return false;
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`[CertiChain] Could not write storage key "${key}".`, error);
    return false;
  }
}

export function removeKey(key: string): void {
  try {
    if (!isBrowser()) return;
    window.localStorage.removeItem(key);
  } catch (error) {
    console.warn(`[CertiChain] Could not remove storage key "${key}".`, error);
  }
}

/**
 * Erase ONLY CertiChain demo data (all keys inside our namespace). Unrelated
 * website keys in LocalStorage are never touched. Returns count of keys removed.
 */
export function eraseAppData(): number {
  if (!isBrowser()) return 0;
  let removed = 0;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(`${STORAGE_NAMESPACE}:`)) doomed.push(key);
    }
    for (const key of doomed) {
      window.localStorage.removeItem(key);
      removed++;
    }
  } catch {
    // ignore access errors
  }
  return removed;
}

/** List every key in our namespace (useful for diagnostics). */
export function listAppDataKeys(): string[] {
  if (!isBrowser()) return [];
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(`${STORAGE_NAMESPACE}:`)) keys.push(key);
    }
    return keys;
  } catch {
    return [];
  }
}

/* ---------- Typed accessors used by the store ---------- */

export function readCertificates(fallback: Certificate[] = []): Certificate[] {
  return readJson<Certificate[]>(STORAGE_KEYS.certificates, fallback);
}

export function readVerificationLogs(fallback: VerificationLog[] = []): VerificationLog[] {
  return readJson<VerificationLog[]>(STORAGE_KEYS.verificationLogs, fallback);
}

export function readSession(fallback: DemoSession | null = null): DemoSession | null {
  return readJson<DemoSession | null>(STORAGE_KEYS.session, fallback);
}

export function readPreferences(fallback: AppPreferences = {}): AppPreferences {
  return readJson<AppPreferences>(STORAGE_KEYS.preferences, fallback);
}

/* ---------- Cross-tab synchronization ---------- */

type Listener = (key: string) => void;
const listeners = new Set<Listener>();

/**
 * Subscribe to changes for our namespace keys. Handles:
 *  - the `storage` event (updates from OTHER tabs),
 *  - same-tab notifications via notifySelf after local writes.
 */
export function subscribeToStorage(listener: Listener): () => void {
  listeners.add(listener);
  if (isBrowser()) {
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === null || // full clear
        event.key.startsWith(`${STORAGE_NAMESPACE}:`)
      ) {
        listener(event.key ?? "");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }
  return () => {
    listeners.delete(listener);
  };
}

/** Fire same-tab listeners after a local write (storage event does not fire). */
export function notifySelf(key: string): void {
  for (const listener of listeners) listener(key);
}
