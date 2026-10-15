"use client";

/**
 * Settings & data management. Everything here operates ONLY on CertiChain’s
 * own namespaced LocalStorage keys (`certichain:v1:*`) — unrelated website
 * keys are never touched.
 */

import Link from "next/link";
import { AlertTriangle, Database, RotateCcw, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { useStore, useToast } from "@/components/providers";
import {
  Badge,
  Button,
  Card,
  Modal,
  SectionTitle,
} from "@/components/ui";
import { listAppDataKeys } from "@/lib/storage";
import { useState } from "react";
import { DEMO_ACTIVE_SAMPLE, DEMO_REVOKED_SAMPLE, DEMO_TAMPER_SAMPLE } from "@/lib/demo-data";

export default function SettingsPage() {
  const {
    ready,
    storageOk,
    profile,
    profiles,
    login,
    logout,
    restoreDemo,
    eraseAll,
    certificates,
    logs,
  } = useStore();
  const toast = useToast();

  const [confirmRestore, setConfirmRestore] = useState(false);
  const [confirmErase, setConfirmErase] = useState(false);
  const keys = ready && storageOk ? listAppDataKeys() : [];

  if (!ready) return null;

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Settings & data"
        description="Manage the demo session, the local registry, and the storage this app owns."
      />

      {/* Demo profile */}
      <Card>
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink">
          <UserRound className="h-4 w-4 text-brand-soft" /> Demo profile
        </h2>
        <p className="mb-4 text-xs text-muted">
          Simulated login stored locally. It shapes the UI only — it is not
          authentication and provides no security.
        </p>
        <div className="flex flex-wrap gap-2">
          {profiles.map((candidate) => (
            <Button
              key={candidate.id}
              size="sm"
              variant={profile?.id === candidate.id ? "primary" : "secondary"}
              disabled={profile?.id === candidate.id}
              onClick={() => {
                login(candidate.id);
                toast({ title: "Switched demo profile", description: candidate.name, variant: "success" });
              }}
            >
              {candidate.name} · {candidate.role}
            </Button>
          ))}
          {profile ? (
            <Button size="sm" variant="ghost" onClick={() => { logout(); toast({ title: "Demo role cleared" }); }}>
              Sign out of demo
            </Button>
          ) : null}
        </div>
      </Card>

      {/* Data management */}
      <Card>
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink">
          <Database className="h-4 w-4 text-brand-soft" /> Local data
        </h2>
        <p className="mb-4 text-xs text-muted">
          All app state lives in this browser’s LocalStorage under the versioned
          namespace <code className="font-mono text-brand-soft">certichain:v1:*</code>.
          Storage available: {storageOk ? <Badge tone="good">yes</Badge> : <Badge tone="bad">no</Badge>}.
        </p>
        <ul className="mb-4 grid gap-1 text-xs text-faint sm:grid-cols-2">
          <li>Certificates: <span className="text-ink tabular-nums">{certificates.length}</span></li>
          <li>Verification logs: <span className="text-ink tabular-nums">{logs.length}</span></li>
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => setConfirmRestore(true)}
          >
            <RotateCcw className="h-4 w-4" /> Restore demo data
          </Button>
          <Button variant="danger" onClick={() => setConfirmErase(true)}>
            <Trash2 className="h-4 w-4" /> Erase all CertiChain data
          </Button>
          <Link href="/history"><Button variant="ghost">View history</Button></Link>
        </div>

        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-muted hover:text-ink">
            Show the {keys.length} storage key(s) this app owns
          </summary>
          <ul className="mt-2 space-y-1 font-mono text-[11px] text-faint">
            {keys.map((key) => (
              <li key={key}>{key}</li>
            ))}
          </ul>
        </details>
      </Card>

      {/* Known demo records */}
      <Card>
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink">
          <ShieldCheck className="h-4 w-4 text-good" /> Demo walkthrough references
        </h2>
        <p className="mb-3 text-xs text-muted">
          The bundled sample registry (restore above if you edited it) contains:
        </p>
        <ul className="space-y-2 text-xs text-muted">
          <li>
            <code className="font-mono text-brand-soft">{DEMO_ACTIVE_SAMPLE.id}</code> — active, {DEMO_ACTIVE_SAMPLE.studentName}. Prints VERIFIED when checked unmodified.
          </li>
          <li>
            <code className="font-mono text-brand-soft">{DEMO_TAMPER_SAMPLE.id}</code> — active, {DEMO_TAMPER_SAMPLE.studentName}. The canonical tamper exercise: open its verification page, edit a field, watch it go TAMPERED.
          </li>
          <li>
            <code className="font-mono text-brand-soft">{DEMO_REVOKED_SAMPLE.id}</code> — ships pre-revoked ({DEMO_REVOKED_SAMPLE.studentName}). Always returns REVOKED, even when the fingerprint still matches.
          </li>
        </ul>
      </Card>

      {/* Honest security statement */}
      <Card className="border-warn/30">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-warn">
          <AlertTriangle className="h-4 w-4" /> Scope &amp; security statement
        </h2>
        <p className="text-xs leading-relaxed text-muted">
          This hackathon MVP uses browser-local data and simulated role
          selection. It demonstrates client-side credential workflows and
          cryptographic fingerprinting; it does not provide server-enforced
          authorization, a globally shared registry, or actual Ethereum
          consensus. LocalStorage is not immutable — the browser user can modify
          it, and revocation/roles are demo state, not security guarantees.
        </p>
      </Card>

      <Modal
        open={confirmRestore}
        onClose={() => setConfirmRestore(false)}
        title="Restore demo data?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmRestore(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                const ok = await restoreDemo();
                setConfirmRestore(false);
                toast({
                  title: ok ? "Demo data restored" : "Restore failed",
                  description: ok
                    ? "Certificates and verification logs were replaced by the bundled demo set."
                    : "Storage write failed.",
                  variant: ok ? "success" : "error",
                });
              }}
            >
              <RotateCcw className="h-4 w-4" /> Restore
            </Button>
          </>
        }
      >
        <p>
          Replaces CertiChain’s own data in this browser (certificates +
          verification history) with the bundled demo set. Only{" "}
          <code className="font-mono">certichain:v1:*</code> keys are touched —
          nothing else in your browser storage.
        </p>
      </Modal>

      <Modal
        open={confirmErase}
        onClose={() => setConfirmErase(false)}
        title="Erase all CertiChain data?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmErase(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                eraseAll();
                setConfirmErase(false);
                toast({ title: "All CertiChain data erased", description: "Certificates, logs, demo session, and preferences were removed. Demo data will re-seed on the next page load.", variant: "info" });
              }}
            >
              <Trash2 className="h-4 w-4" /> Erase everything
            </Button>
          </>
        }
      >
        <p>
          Removes every key under <code className="font-mono">certichain:v1:</code>{" "}
          (certificates, logs, profile, preferences) from this browser. Other
          websites’ data is untouched. It cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
