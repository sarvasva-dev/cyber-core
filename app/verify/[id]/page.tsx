"use client";

/**
 * /verify/[id] — deep verification page reachable from QR codes and links.
 * Flow: immediate existence/status lookup, then the full metadata check
 * (pre-filled, editable → tamper demo) and, when available, the raw-file
 * fingerprint check. Every step logs to the local verification history.
 */

import Link from "next/link";
import { Suspense, use as reactUse, useMemo, useState } from "react";
import { ArrowLeft, FileWarning } from "lucide-react";
import { QRCodeImage } from "@/components/qr";
import { VerificationResultCard } from "@/components/verification-result";
import { MetadataCheckForm } from "@/components/metadata-check-form";
import { useStore, useToast } from "@/components/providers";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingBlock,
  SectionTitle,
  StatusBadge,
  CopyButton,
} from "@/components/ui";
import { findCertificate } from "@/lib/certificates";
import { sha256FileBytes } from "@/lib/hash";
import { formatDateTime, verificationUrl } from "@/lib/format";
import type { IssueFormInput } from "@/lib/validation";
import type { VerificationOutcome } from "@/lib/verification";

function recordToFormInput(id: string, cert: NonNullable<ReturnType<typeof findCertificate>>): IssueFormInput {
  return {
    id,
    studentName: cert.studentName,
    studentEmail: cert.studentEmail ?? "",
    course: cert.course,
    institution: cert.institution,
    department: cert.department ?? "",
    registrationNumber: cert.registrationNumber ?? "",
    grade: cert.grade ?? "",
    issueDate: cert.issueDate,
    expiryDate: cert.expiryDate ?? "",
    issuerName: cert.issuerName,
    notes: cert.notes ?? "",
  };
}

export default function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // The Suspense boundary lets the page prerender while the dynamic id streams in.
  return (
    <Suspense fallback={<LoadingBlock label="Opening verification…" />}>
      <VerifyContent params={params} />
    </Suspense>
  );
}

function VerifyContent({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = reactUse(params);
  const id = decodeURIComponent(rawId);
  const { ready, certificates, runVerification } = useStore();
  const toast = useToast();
  const [outcome, setOutcome] = useState<VerificationOutcome | null>(null);
  const [fileBusy, setFileBusy] = useState(false);

  const cert = useMemo(
    () => (ready ? findCertificate(certificates, id) : undefined),
    [ready, certificates, id]
  );

  if (!ready) return <LoadingBlock label="Checking the local registry…" />;

  if (!cert) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="mb-4">
          <Link href="/verify" className="inline-flex items-center gap-1 text-xs text-faint hover:text-muted">
            <ArrowLeft className="h-3.5 w-3.5" /> Verification portal
          </Link>
        </div>
        <SectionTitle title="Verification result" description={`Certificate ${id}`} />
        <VerificationResultCard
          outcome={{
            result: "not_found",
            message: `No certificate with ID ${id} exists in this browser’s local registry. The registry is per-browser: records issued or previously verified on another device are not visible here.`,
            differingFields: [],
            checkedAt: new Date().toISOString(),
          }}
        />
        <Card className="mt-6">
          <p className="text-xs text-muted">
            If you issued this certificate elsewhere, that data stays in that
            browser’s LocalStorage — this MVP has no shared registry. You can{" "}
            <Link href="/settings" className="text-brand-soft hover:underline">restore demo data</Link>{" "}
            to explore with the bundled samples.
          </p>
        </Card>
      </div>
    );
  }

  const url = verificationUrl(cert.id);

  async function runFileCheck(file: File) {
    setFileBusy(true);
    try {
      const sha = await sha256FileBytes(await file.arrayBuffer());
      const result = await runVerification({
        id: cert!.id,
        method: "file_upload",
        uploadedFileSha256: sha,
      });
      setOutcome(result);
    } catch {
      toast({ title: "Could not read the file", variant: "error" });
    } finally {
      setFileBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-4">
        <Link href="/verify" className="inline-flex items-center gap-1 text-xs text-faint hover:text-muted">
          <ArrowLeft className="h-3.5 w-3.5" /> Verification portal
        </Link>
      </div>
      <SectionTitle
        title={`Verifying ${cert.id}`}
        description="Steps below are ordered the way a verifier should reason: existence → status → fingerprint match."
        actions={
          <>
            <StatusBadge status={cert.status} />
            <CopyButton value={cert.id} label="Copy ID" />
          </>
        }
      />

      {/* Registry existence + status */}
      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-ink">1 · Registry record</h2>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-faint">Student</dt>
            <dd className="mt-0.5 text-ink">{cert.studentName}</dd>
          </div>
          <div>
            <dt className="text-xs text-faint">Course</dt>
            <dd className="mt-0.5 text-ink">{cert.course}</dd>
          </div>
          <div>
            <dt className="text-xs text-faint">Institution</dt>
            <dd className="mt-0.5 text-ink">{cert.institution}</dd>
          </div>
          <div>
            <dt className="text-xs text-faint">Issued</dt>
            <dd className="mt-0.5 text-xs text-ink">{formatDateTime(cert.issuedAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-faint">Issuer</dt>
            <dd className="mt-0.5 text-xs text-ink">{cert.issuerName}</dd>
          </div>
          <div>
            <dt className="text-xs text-faint">Fingerprint (stored)</dt>
            <dd className="mt-0.5 break-all font-mono text-xs text-brand-soft">{cert.fingerprint.slice(0, 26)}…</dd>
          </div>
        </dl>
        {cert.status === "revoked" ? (
          <p className="mt-3 rounded-lg border border-warn/40 bg-warn/10 p-3 text-xs leading-relaxed text-warn">
            This record was revoked{cert.revokedAt ? ` on ${formatDateTime(cert.revokedAt)}` : ""}
            {cert.revokedBy ? ` by ${cert.revokedBy}` : ""}. Whatever the
            fingerprint checks below show, the credential is NOT currently
            valid in this registry.
          </p>
        ) : null}
      </Card>

      <div className="mb-6 grid gap-6 sm:grid-cols-[auto_1fr]">
        <Card className="flex flex-col items-center">
          <QRCodeImage value={url} size={130} />
          <p className="mt-2 break-all text-[10px] text-faint">{url}</p>
          <div className="mt-2 flex gap-1.5">
            <CopyButton value={url} label="Copy link" />
          </div>
        </Card>
        <div className="space-y-6">
          {outcome ? (
            <VerificationResultCard outcome={outcome} />
          ) : (
            <Card>
              <h2 className="text-sm font-semibold text-ink">2 · Cryptographic check</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Use the metadata form below — it is pre-filled with the record’s
                stored values. <strong>Running it unedited</strong> reproduces
                the stored SHA-256 (VERIFIED). <strong>Modify one field</strong>{" "}
                and the match breaks (TAMPERED).
              </p>
            </Card>
          )}
          {cert.documentSha256 ? (
            <Card>
              <h2 className="text-sm font-semibold text-ink">3 · Original-file check</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                This certificate has a stored raw-byte fingerprint
                (<code className="font-mono">{cert.documentName ?? "original document"}</code>).
                Select the same file to compare hashes — a different domain from
                the metadata fingerprint above.
              </p>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                aria-label="Original document for byte comparison"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void runFileCheck(file);
                }}
                className="mt-3 w-full rounded-lg border border-line bg-night-2 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-xs file:text-ink"
              />
              {fileBusy ? <p className="mt-2 text-xs text-muted">Hashing bytes…</p> : null}
            </Card>
          ) : null}
        </div>
      </div>

      <MetadataCheckForm
        initial={recordToFormInput(cert.id, cert)}
        onOutcome={(o) => {
          if (o) setOutcome(o);
        }}
      />

      <div className="mt-8">
        <EmptyState
          icon={<FileWarning className="h-6 w-6" />}
          title="About what this proves"
          description="A hash match proves the data equals what this registry stored at issuance. It is not Ethereum consensus, not a global registry, and not proof a real-world qualification was awarded. This page is the MVP’s honest scope."
        />
      </div>
    </div>
  );
}
