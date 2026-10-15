"use client";

/**
 * Central client-side store + toast system.
 *
 * - Registry, verification log, demo session and preferences are read from
 *   LocalStorage inside useEffect (never during server render), so there are
 *   no hydration mismatches. Consumers branch on `ready`.
 * - A single storage-key subscription keeps state correct across tabs and
 *   after same-tab writes.
 * - First-run seeding happens only when the registry key is absent.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  issueCertificateAsync,
  revokeCertificate,
  restoreCertificate,
  type IssueOptions,
  type IssueResult,
} from "@/lib/certificates";
import {
  STORAGE_KEYS,
  notifySelf,
  readPreferences,
  readSession,
  readVerificationLogs,
  readCertificates,
  storageAvailable,
  subscribeToStorage,
  removeKey,
  writeJson,
  eraseAppData,
} from "@/lib/storage";
import {
  DEMO_PROFILES,
  seedDemoRegistryIfEmpty,
  restoreDemoData,
} from "@/lib/demo-data";
import { logFromOutcome, logVerification, verify, type VerificationInput, type VerificationOutcome } from "@/lib/verification";
import type {
  AppPreferences,
  Certificate,
  DemoProfile,
  VerificationLog,
} from "@/lib/types";

/* ------------------------------ Toasts ------------------------------ */

export interface ToastCtor {
  title: string;
  description?: string;
  variant?: "success" | "error" | "info";
}

interface ToastItem extends ToastCtor {
  id: number;
}

const ToastContext = createContext<(toast: ToastCtor) => void>(() => {});

export function useToast(): (toast: ToastCtor) => void {
  return useContext(ToastContext);
}

function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const push = useCallback((toast: ToastCtor) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-[100] flex w-[min(92vw,22rem)] flex-col gap-2 print-hide"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto rounded-xl border px-4 py-3 shadow-lg backdrop-blur transition ${
              toast.variant === "success"
                ? "border-good/40 bg-good/10 text-good"
                : toast.variant === "error"
                  ? "border-bad/40 bg-bad/10 text-bad"
                  : "border-line bg-surface text-ink"
            }`}
          >
            <p className="text-sm font-medium">{toast.title}</p>
            {toast.description ? (
              <p className="mt-0.5 text-xs text-muted">{toast.description}</p>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ------------------------------ Store ------------------------------ */

interface AppStoreValue {
  ready: boolean;
  storageOk: boolean;
  certificates: Certificate[];
  logs: VerificationLog[];
  profile: DemoProfile | null;
  preferences: AppPreferences;
  profiles: DemoProfile[];
  issue: (input: Parameters<typeof issueCertificateAsync>[0], opts?: IssueOptions) => Promise<IssueResult>;
  revoke: (id: string, actor?: string) => IssueResult;
  unRevoke: (id: string) => IssueResult;
  runVerification: (input: VerificationInput) => Promise<VerificationOutcome>;
  login: (profileId: string) => void;
  logout: () => void;
  restoreDemo: () => Promise<boolean>;
  eraseAll: () => void;
  setPreference: <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => void;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

export function useStore(): AppStoreValue {
  const value = useContext(AppStoreContext);
  if (!value) throw new Error("useStore must be used within <Providers>");
  return value;
}

function AppStoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [storageOk, setStorageOk] = useState(true);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [logs, setLogs] = useState<VerificationLog[]>([]);
  const [profile, setProfile] = useState<DemoProfile | null>(null);
  const [preferences, setPreferences] = useState<AppPreferences>({});

  // Initialization lifecycle: read stored data, seed demo records on first
  // run (only when the registry key is absent), then mark ready.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = storageAvailable();
      setStorageOk(ok);
      if (ok) {
        await seedDemoRegistryIfEmpty();
      }
      if (cancelled) return;
      setCertificates(readCertificates());
      setLogs(readVerificationLogs());
      setPreferences(readPreferences());
      const session = readSession();
      if (session) {
        const found = DEMO_PROFILES.find((p) => p.id === session.profileId);
        if (found) setProfile(found);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep state in sync with other tabs and same-tab writes.
  useEffect(() => {
    const unsubscribe = subscribeToStorage((key) => {
      if (key === STORAGE_KEYS.certificates) setCertificates(readCertificates());
      if (key === STORAGE_KEYS.verificationLogs) setLogs(readVerificationLogs());
      if (key === STORAGE_KEYS.session) {
        const session = readSession();
        const found = session ? DEMO_PROFILES.find((p) => p.id === session.profileId) : null;
        setProfile(found ?? null);
      }
      if (key === STORAGE_KEYS.preferences) setPreferences(readPreferences());
    });
    return unsubscribe;
  }, []);

  const issue = useCallback<AppStoreValue["issue"]>(
    (input, opts) => issueCertificateAsync(input, opts),
    []
  );

  const revoke = useCallback<AppStoreValue["revoke"]>((id, actor) => {
    const result = revokeCertificate(id, actor);
    if (result.ok) setCertificates(readCertificates());
    return result;
  }, []);

  const unRevoke = useCallback<AppStoreValue["unRevoke"]>((id) => {
    const result = restoreCertificate(id);
    if (result.ok) setCertificates(readCertificates());
    return result;
  }, []);

  const runVerification = useCallback<AppStoreValue["runVerification"]>(
    async (input) => {
      const current = readCertificates();
      const outcome = await verify(input, current);
      const log = logFromOutcome(input, outcome);
      logVerification(log);
      setLogs(readVerificationLogs());
      return outcome;
    },
    []
  );

  const login = useCallback<AppStoreValue["login"]>((profileId) => {
    const startedAt = new Date().toISOString();
    try {
      window.localStorage.setItem(
        STORAGE_KEYS.session,
        JSON.stringify({ profileId, startedAt })
      );
      notifySelf(STORAGE_KEYS.session);
    } catch {
      /* quota issues handled by writeJson elsewhere */
    }
    const found = DEMO_PROFILES.find((p) => p.id === profileId) ?? null;
    setProfile(found);
  }, []);

  const logout = useCallback(() => {
    removeKey(STORAGE_KEYS.session);
    notifySelf(STORAGE_KEYS.session);
    setProfile(null);
  }, []);

  const restoreDemo = useCallback(async () => restoreDemoData(), []);

  const eraseAll = useCallback(() => {
    eraseAppData();
    setCertificates([]);
    setLogs([]);
    setProfile(null);
    setPreferences({});
    notifySelf(STORAGE_KEYS.certificates);
  }, []);

  const setPreference = useCallback<AppStoreValue["setPreference"]>((key, value) => {
    setPreferences((prev) => {
      const next = { ...prev, [key]: value };
      writeJson(STORAGE_KEYS.preferences, next);
      return next;
    });
  }, []);

  const value = useMemo<AppStoreValue>(
    () => ({
      ready,
      storageOk,
      certificates,
      logs,
      profile,
      preferences,
      profiles: DEMO_PROFILES,
      issue,
      revoke,
      unRevoke,
      runVerification,
      login,
      logout,
      restoreDemo,
      eraseAll,
      setPreference,
    }),
    [
      ready,
      storageOk,
      certificates,
      logs,
      profile,
      preferences,
      issue,
      revoke,
      unRevoke,
      runVerification,
      login,
      logout,
      restoreDemo,
      eraseAll,
      setPreference,
    ]
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AppStoreProvider>
      <ToastProvider>{children}</ToastProvider>
    </AppStoreProvider>
  );
}
