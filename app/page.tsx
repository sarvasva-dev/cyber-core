"use client";

/**
 * Landing page. Interactive demo card performs REAL verification against the
 * seeded local registry — no mocked statuses. Data lives per-browser.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  ClipboardCheck,
  Fingerprint,
  Landmark,
  Lock,
  MousePointerClick,
  ScanLine,
  Share2,
  TriangleAlert,
  UserRound,
  XCircle,
} from "lucide-react";
import { useStore } from "@/components/providers";
import { Button, Badge, Card } from "@/components/ui";
import { verificationUrl } from "@/lib/format";
import type { VerificationOutcome } from "@/lib/verification";

const RESULT_TONE: Record<string, { chip: string; label: string }> = {
  verified: { chip: "border-good/50 bg-good/10 text-good", label: "VERIFIED" },
  tampered: { chip: "border-bad/50 bg-bad/10 text-bad", label: "TAMPERED" },
  revoked: { chip: "border-warn/50 bg-warn/10 text-warn", label: "REVOKED" },
  not_found: { chip: "border-line bg-surface-2 text-muted", label: "NOT FOUND" },
  invalid_input: { chip: "border-line bg-surface-2 text-muted", label: "INVALID INPUT" },
  registry_lookup: { chip: "border-brand/50 bg-brand/10 text-brand-soft", label: "RECORD FOUND" },
};

/** Live check widget backed by the real local registry. */
function LiveCheckDemo() {
  const { ready, certificates, runVerification } = useStore();
  const [outcome, setOutcome] = useState<VerificationOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [alterGrade, setAlterGrade] = useState(false);

  const sample = useMemo(
    () => certificates.find((c) => c.id.startsWith("CRT-2025-M88X2Q")) ?? certificates[0],
    [certificates]
  );

  async function run() {
    if (!sample) return;
    setBusy(true);
    const result = await runVerification({
      id: sample.id,
      method: "metadata",
      metadata: {
        id: sample.id,
        studentName: sample.studentName,
        studentEmail: sample.studentEmail ?? "",
        course: sample.course,
        institution: sample.institution,
        department: sample.department ?? "",
        registrationNumber: sample.registrationNumber ?? "",
        grade: alterGrade ? "Third Class (edited by visitor)" : (sample.grade ?? ""),
        issueDate: sample.issueDate,
        expiryDate: sample.expiryDate ?? "",
        issuerName: sample.issuerName,
        notes: sample.notes ?? "",
      },
    });
    setOutcome(result);
    setBusy(false);
  }

  if (!ready) {
    return (
      <Card className="min-h-64 animate-pulse" aria-busy="true">
        <p className="text-sm text-muted">Initializing local demo registry…</p>
      </Card>
    );
  }

  if (!sample) {
    return (
      <Card className="min-h-64">
        <p className="text-sm text-muted">
          No demo certificate is available in this browser.{" "}
          <Link href="/settings" className="text-brand-soft hover:underline">
            Restore demo data
          </Link>{" "}
          to try the interactive check.
        </p>
      </Card>
    );
  }

  return (
    <Card className="min-h-64">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-faint">
          Interactive check · real local registry
        </p>
        <Badge tone="neutral">{sample.id}</Badge>
      </div>
      <p className="mt-2 text-sm text-muted">
        {sample.course} · {sample.institution}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={run} loading={busy} disabled={busy}>
          <ClipboardCheck className="h-4 w-4" /> Check authentic data
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setAlterGrade(true);
            setOutcome(null);
          }}
          disabled={busy}
          aria-pressed={alterGrade}
        >
          <TriangleAlert className="h-4 w-4" /> Tamper with the grade
        </Button>
        {alterGrade ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setAlterGrade(false);
              setOutcome(null);
            }}
          >
            Reset grade
          </Button>
        ) : null}
      </div>

      {outcome ? (
        <div
          role="status"
          className={`mt-4 rounded-lg border px-3 py-3 text-sm ${
            RESULT_TONE[outcome.result]?.chip ?? RESULT_TONE.invalid_input.chip
          }`}
        >
          <p className="font-semibold tracking-wide">
            {RESULT_TONE[outcome.result]?.label ?? outcome.result.toUpperCase()}
          </p>
          <p className="mt-1 text-xs leading-relaxed">{outcome.message}</p>
          <Link
            href={`/verify/${sample.id}`}
            className="mt-2 inline-flex items-center gap-1 text-xs text-brand-soft hover:underline"
          >
            Open the full verification page <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      ) : (
        <p className="mt-4 text-xs text-faint">
          Run a check with the authentic fields, then tamper with the grade and
          run again — the SHA-256 fingerprint will change and the result flips
          to TAMPERED.
        </p>
      )}
    </Card>
  );
}

function WorkflowStep({ n, title, detail }: { n: number; title: string; detail: string }) {
  return (
    <div className="relative rounded-xl border border-line bg-surface/70 p-5">
      <span className="absolute -top-3 left-5 rounded-full border border-brand/50 bg-night px-2 py-0.5 font-mono text-[11px] text-brand-soft">
        {String(n).padStart(2, "0")}
      </span>
      <h3 className="mt-1 text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">{detail}</p>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-line-soft bg-night/80 backdrop-blur print-hide">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-aqua font-bold text-night">
              C
            </span>
            <span className="text-sm font-semibold tracking-wide text-ink">
              CertiChain
            </span>
          </Link>
          <nav aria-label="Landing" className="hidden items-center gap-6 text-sm text-muted md:flex">
            <a href="#how-it-works" className="hover:text-ink">How it works</a>
            <a href="#features" className="hover:text-ink">Features</a>
            <a href="#roles" className="hover:text-ink">Who it’s for</a>
            <a href="#security" className="hover:text-ink">Security</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/verify" className="rounded-lg px-3 py-2 text-sm text-muted hover:text-ink">
              Verify
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-brand border border-brand/70 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-soft hover:text-night"
            >
              Explore demo
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pt-14 pb-16 sm:px-6 sm:pt-20">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <Badge tone="brand" className="mb-5">
                <Lock className="h-3 w-3" /> HackIndia AI &amp; CyberTech 2026 · Cybersecurity track
              </Badge>
              <h1 className="text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-5xl">
                Trust on paper is not enough.{" "}
                <span className="bg-gradient-to-r from-brand-soft to-aqua bg-clip-text text-transparent">
                  Verify every credential.
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">
                CertiChain issues digital certificates carrying a SHA-256
                cryptographic fingerprint, shares them through QR codes, and
                checks them in seconds — exposing forgeries through an instant
                hash mismatch. The demo runs entirely in your browser.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-lg border border-brand/70 bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-soft hover:text-night"
                >
                  Explore demo <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/verify"
                  className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink hover:border-brand"
                >
                  <ScanLine className="h-4 w-4" /> Verify a certificate
                </Link>
                <Link
                  href="/admin/issue"
                  className="inline-flex items-center gap-2 rounded-lg border border-transparent px-4 py-2.5 text-sm font-medium text-muted hover:text-ink"
                >
                  <MousePointerClick className="h-4 w-4" /> Issue a certificate
                </Link>
              </div>
              <p className="mt-6 text-xs text-faint">
                Demo runs locally in your browser (LocalStorage). No signup, no
                backend, no data ever leaves your device.
              </p>
            </div>
            <LiveCheckDemo />
          </div>
        </section>

        {/* Problem */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            Credential fraud is a quiet, expensive problem
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Resumes get screened in minutes, but certificates get checked rarely —
            and forged documents are cheap to produce.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              {
                title: "Forged certificates",
                detail:
                  "A convincing PDF is easy to fake and hard to disprove without the issuer.",
              },
              {
                title: "Manual verification",
                detail:
                  "Employers call or email institutions and wait days or weeks for confirmation.",
              },
              {
                title: "No universal experience",
                detail:
                  "Every issuer has a different process; there is no simple way for anyone to check.",
              },
            ].map((item) => (
              <Card key={item.title} className="border-l-2 border-l-bad/60">
                <h3 className="text-sm font-semibold text-ink">{item.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">{item.detail}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Workflow */}
        <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            Issue → Fingerprint → Share → Verify
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <WorkflowStep
              n={1}
              title="Issue"
              detail="The institution issues a certificate with normalized, validated metadata through the admin portal."
            />
            <WorkflowStep
              n={2}
              title="Fingerprint"
              detail="A SHA-256 fingerprint is computed from a canonical serialization of the certificate’s metadata and stored with the record."
            />
            <WorkflowStep
              n={3}
              title="Share"
              detail="The holder shares a QR code or verification link that opens the credential’s verification page."
            />
            <WorkflowStep
              n={4}
              title="Verify"
              detail="Anyone re-checks the data. Matching metadata reproduces the fingerprint; any edit breaks the match instantly."
            />
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            Built for demonstrable trust
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              {
                icon: <Fingerprint className="h-5 w-5 text-brand-soft" />,
                title: "SHA-256 fingerprints",
                detail:
                  "Deterministic canonical JSON → SHA-256 via the browser’s Web Crypto API. The same fields always reproduce the same fingerprint.",
              },
              {
                icon: <XCircle className="h-5 w-5 text-bad" />,
                title: "Tampering detection",
                detail:
                  "Even one altered character (a changed grade, a different date) produces a hash mismatch with a plain-language explanation.",
              },
              {
                icon: <ScanLine className="h-5 w-5 text-aqua" />,
                title: "QR sharing",
                detail:
                  "Every certificate carries a QR code that opens its verification page. Links and manual IDs work too.",
              },
              {
                icon: <MousePointerClick className="h-5 w-5 text-warn" />,
                title: "Revocation",
                detail:
                  "Admins can revoke a credential; every subsequent check reports REVOKED — a revoked certificate is never shown as valid, even when the hash matches.",
              },
            ].map((f) => (
              <Card key={f.title}>
                <div className="flex items-center gap-3">
                  {f.icon}
                  <h3 className="text-sm font-semibold text-ink">{f.title}</h3>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted">{f.detail}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Roles */}
        <section id="roles" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">Who it’s for</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: <Landmark className="h-5 w-5 text-brand-soft" />,
                role: "Institutions",
                href: "/login?role=admin",
                cta: "Try the admin portal",
                points: [
                  "Issue certificates with validated metadata in seconds",
                  "Manage records, fingerprints, and revocations",
                  "Registry-wide activity metrics from real local data",
                ],
              },
              {
                icon: <UserRound className="h-5 w-5 text-good" />,
                role: "Students & holders",
                href: "/login?role=student",
                cta: "Open the credential wallet",
                points: [
                  "A tidy wallet of your certificates",
                  "QR codes, verification links, and share actions",
                  "Proof you can show employers on the spot",
                ],
              },
              {
                icon: <Share2 className="h-5 w-5 text-aqua" />,
                role: "Employers & verifiers",
                href: "/verify",
                cta: "Verify a certificate now",
                points: [
                  "Check any ID or verification link — no login needed",
                  "Clear VERIFIED / TAMPERED / REVOKED results",
                  "A searchable log of every check",
                ],
              },
            ].map((r) => (
              <Card key={r.role}>
                <div className="flex items-center gap-3">
                  {r.icon}
                  <h3 className="text-sm font-semibold text-ink">{r.role}</h3>
                </div>
                <ul className="mt-3 space-y-1.5 text-xs text-muted">
                  {r.points.map((p) => (
                    <li key={p} className="flex gap-2">
                      <span aria-hidden="true" className="text-brand-soft">▸</span>
                      {p}
                    </li>
                  ))}
                </ul>
                <Link
                  href={r.href}
                  className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-brand-soft hover:underline"
                >
                  {r.cta} <ArrowRight className="h-3 w-3" />
                </Link>
              </Card>
            ))}
          </div>
        </section>

        {/* Security & privacy */}
        <section id="security" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <Card className="border-brand/30 bg-gradient-to-br from-surface to-night-2">
            <h2 className="text-2xl font-semibold tracking-tight text-ink">Security &amp; privacy</h2>
            <ul className="mt-4 grid gap-4 text-sm text-muted sm:grid-cols-2">
              <li>
                <p className="font-medium text-ink">Local-first data.</p>
                <p className="mt-1 text-xs leading-relaxed">
                  Certificates, logs, and preferences live in your browser’s
                  LocalStorage under the versioned <code className="font-mono text-brand-soft">certichain:v1:*</code>{" "}
                  keys. Nothing is uploaded; nothing syncs between devices.
                </p>
              </li>
              <li>
                <p className="font-medium text-ink">No fake guarantees.</p>
                <p className="mt-1 text-xs leading-relaxed">
                  The fingerprint proves certificate <em>data</em> is unchanged
                  since issuance in this registry. It cannot prove that a
                  real-world qualification was genuinely awarded, and it is not
                  Ethereum consensus.
                </p>
              </li>
              <li>
                <p className="font-medium text-ink">Demo roles are not auth.</p>
                <p className="mt-1 text-xs leading-relaxed">
                  Role selection simulates product experiences, not security.
                  A technically capable user can change browser-local data.
                </p>
              </li>
              <li>
                <p className="font-medium text-ink">Files never leave the browser.</p>
                <p className="mt-1 text-xs leading-relaxed">
                  Any uploaded certificate document is hashed client-side with
                  Web Crypto. No file ever reaches a server.
                </p>
              </li>
            </ul>
          </Card>
        </section>

        {/* Tech stack */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">Technology</h2>
          <div className="mt-6 flex flex-wrap gap-2 text-xs">
            {[
              "Next.js 16 (App Router)",
              "React 19",
              "TypeScript (strict)",
              "Tailwind CSS v4",
              "Web Crypto API — SHA-256",
              "qrcode (local QR generation)",
              "Lucide icons",
              "LocalStorage persistence",
              "Print-to-PDF certificate sheet",
              "Vitest domain tests",
            ].map((t) => (
              <Badge key={t} tone="neutral">{t}</Badge>
            ))}
          </div>
        </section>

        {/* Limitations */}
        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <Card className="border-warn/30">
            <h2 className="text-sm font-semibold text-warn">Honest MVP scope</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              This is a hackathon MVP demonstrating client-side credential
              workflows and cryptographic fingerprinting. It has no backend, no
              globally shared registry, no production authentication, and no
              actual Ethereum contract: revocation and role checks are
              browser-local demo state. A production system would anchor
              fingerprints on-chain or on an issuer-operated registry with
              server-enforced access control — see the roadmap in the README.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Because the registry lives in one browser, records issued here
              verify here — open this site on another device and it starts with
              its own demo registry. That is an honest limitation of the
              frontend-only design.
            </p>
          </Card>
        </section>

        {/* Final CTA */}
        <section className="border-t border-line-soft">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-16 text-center sm:px-6">
            <h2 className="text-2xl font-semibold text-ink">
              See every result in one minute
            </h2>
            <p className="max-w-xl text-sm text-muted">
              Run a VERIFIED check, tamper a grade into TAMPERED, open the
              revoked sample, and issue a certificate of your own.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg border border-brand/70 bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-soft hover:text-night"
            >
              Start the demo <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-line-soft print-hide">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-faint">
            <div>
              <p className="font-medium text-muted">CertiChain · Team Cyber Core</p>
              <p className="mt-1">
                Abhay Saini · Sarthak Srivastava · Shweta · Aman Yadav
              </p>
              <p className="mt-1">
                Dr. Virendra Swarup Institute of Computer Studies, Kanpur
              </p>
            </div>
            <p>HackIndia AI &amp; CyberTech Hackathon 2026</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
