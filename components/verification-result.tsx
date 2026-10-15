"use client";

/**
 * Presentation of a VerificationOutcome. Deliberately explicit: existence,
 * fingerprint match and revocation state are shown as separate facts, and
 * every result explains its reasoning.
 */

import Link from "next/link";
import {
  AlertTriangle,
  CircleCheck,
  FileSearch,
  FileWarning,
  RefreshCw,
  Share2,
} from "lucide-react";
import { Badge, Button, Card, CopyButton } from "./ui";
import { fieldLabel } from "@/lib/verification";
import { formatDateTime, verificationUrl } from "@/lib/format";
import type { VerificationOutcome } from "@/lib/verification";

const CONFIG: Record<string, { tone: "good" | "bad" | "warn" | "brand" | "neutral"; chip: string; icon: React.ReactNode; title: string }> = {
  verified: {
    tone: "good",
    chip: "border-good/50 bg-good/10",
    icon: <CircleCheck className="h-10 w-10 text-good" aria-hidden="true" />,
    title: "VERIFIED",
  },
  tampered: {
    tone: "bad",
    chip: "border-bad/50 bg-bad/10",
    icon: <AlertTriangle className="h-10 w-10 text-bad" aria-hidden="true" />,
    title: "TAMPERED — HASH MISMATCH",
  },
  revoked: {
    tone: "warn",
    chip: "border-warn/50 bg-warn/10",
    icon: <AlertTriangle className="h-10 w-10 text-warn" aria-hidden="true" />,
    title: "REVOKED",
  },
  not_found: {
    tone: "neutral",
    chip: "border-line bg-surface-2",
    icon: <FileSearch className="h-10 w-10 text-muted" aria-hidden="true" />,
    title: "NOT FOUND",
  },
  invalid_input: {
    tone: "neutral",
    chip: "border-line bg-surface-2",
    icon: <FileWarning className="h-10 w-10 text-muted" aria-hidden="true" />,
    title: "INVALID INPUT",
  },
  registry_lookup: {
    tone: "brand",
    chip: "border-brand/50 bg-brand/10",
    icon: <CircleCheck className="h-10 w-10 text-brand-soft" aria-hidden="true" />,
    title: "RECORD FOUND (existence + status check)",
  },
};

export function VerificationResultCard({
  outcome,
  onRepeat,
}: {
  outcome: VerificationOutcome;
  onRepeat?: () => void;
}) {
  const cfg = CONFIG[outcome.result] ?? CONFIG.invalid_input;
  const cert = outcome.certificate;
  const trustNote =
    outcome.result === "verified"
      ? "This fingerprint match proves the re-entered data equals the data stored at issuance in this browser’s registry. It does not independently prove the qualification was genuinely awarded in the real world."
      : outcome.result === "revoked"
        ? "A revoked credential must be treated as invalid for hiring or admissions decisions, regardless of any fingerprint match."
        : null;

  return (
    <Card className={`${cfg.chip} !bg-opacity-20`} role="status" aria-live="polite">
      <div className="flex flex-wrap items-start gap-4">
        {cfg.icon}
        <div className="min-w-0 flex-1">
          <p className="font-mono text-lg font-semibold tracking-wide text-ink">{cfg.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">{outcome.message}</p>
          {outcome.differingFields.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {outcome.differingFields.map((field) => (
                <Badge key={field} tone="bad" className="text-[10px]">
                  differs: {fieldLabel(field)}
                </Badge>
              ))}
            </div>
          ) : null}
          <p className="mt-2 text-xs text-faint">
            Checked {formatDateTime(outcome.checkedAt)}
          </p>
        </div>
      </div>

      {cert ? (
        <dl className="mt-4 grid gap-x-6 gap-y-2 border-t border-line-soft pt-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-faint">Certificate ID</dt>
            <dd className="mt-0.5 font-mono text-xs text-ink">{cert.id}</dd>
          </div>
          <div>
            <dt className="text-xs text-faint">Status</dt>
            <dd className="mt-0.5 text-xs text-ink">{cert.status}</dd>
          </div>
          <div>
            <dt className="text-xs text-faint">Student</dt>
            <dd className="mt-0.5 text-xs text-ink">{cert.studentName}</dd>
          </div>
          <div>
            <dt className="text-xs text-faint">Institution</dt>
            <dd className="mt-0.5 text-xs text-ink">{cert.institution}</dd>
          </div>
          <div>
            <dt className="text-xs text-faint">Issuer</dt>
            <dd className="mt-0.5 text-xs text-ink">{cert.issuerName}</dd>
          </div>
          {cert.grade ? (
            <div>
              <dt className="text-xs text-faint">Grade</dt>
              <dd className="mt-0.5 text-xs text-ink">{cert.grade}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {outcome.expectedFingerprint ? (
        <div className="mt-3 space-y-1.5 border-t border-line-soft pt-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-faint">Stored fingerprint:</span>
            <code className="break-all font-mono text-brand-soft">{outcome.expectedFingerprint}</code>
          </div>
          {outcome.suppliedFingerprint ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-faint">Recomputed fingerprint:</span>
              <code className={`break-all font-mono ${outcome.suppliedFingerprint === outcome.expectedFingerprint ? "text-good" : "text-bad"}`}>
                {outcome.suppliedFingerprint}
              </code>
            </div>
          ) : null}
        </div>
      ) : null}

      {trustNote ? (
        <p className="mt-3 rounded-lg border border-line-soft bg-night-2 p-3 text-xs leading-relaxed text-muted">
          {trustNote}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {onRepeat ? (
          <Button size="sm" variant="secondary" onClick={onRepeat}>
            <RefreshCw className="h-3.5 w-3.5" /> Run again
          </Button>
        ) : null}
        {cert ? (
          <>
            <Link href={`/verify/${cert.id}`}>
              <Button size="sm" variant="ghost">Open verification page</Button>
            </Link>
            <CopyButton value={verificationUrl(cert.id)} label="Copy verification link" />
            <ShareSupport certificateId={cert.id} studentName={cert.studentName} />
          </>
        ) : null}
      </div>
    </Card>
  );
}

/** Web Share API when available, clipboard fallback otherwise. */
function ShareSupport({ certificateId, studentName }: { certificateId: string; studentName: string }) {
  async function share() {
    const url = verificationUrl(certificateId);
    const data = {
      title: `CertiChain verification — ${studentName}`,
      text: `Verify certificate ${certificateId}`,
      url,
    };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(data);
        return;
      } catch {
        /* user cancelled — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* ignore */
    }
  }
  return (
    <Button size="sm" variant="ghost" onClick={share}>
      <Share2 className="h-3.5 w-3.5" /> Share link
    </Button>
  );
}
