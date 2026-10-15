"use client";

/**
 * Public verification portal — no demo role required. Four honest input
 * methods: certificate ID, pasted verification link, camera scan (native
 * detection where available), and raw file byte-comparison when the record
 * has a stored document fingerprint.
 */

import Link from "next/link";
import { useState } from "react";
import { FileCheck2, Link2, ScanLine, Search } from "lucide-react";
import { QRScanner } from "@/components/qr-scanner";
import { VerificationResultCard } from "@/components/verification-result";
import { MetadataCheckForm } from "@/components/metadata-check-form";
import { useStore, useToast } from "@/components/providers";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  LoadingBlock,
  SectionTitle,
  StatusBadge,
} from "@/components/ui";
import { findCertificate } from "@/lib/certificates";
import { sha256FileBytes } from "@/lib/hash";
import { verificationUrl } from "@/lib/format";
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

export default function VerifyPortalPage() {
  const { ready, certificates, runVerification } = useStore();
  const toast = useToast();

  const [idInput, setIdInput] = useState("");
  const [linkInput, setLinkInput] = useState("");
  const [outcome, setOutcome] = useState<VerificationOutcome | null>(null);
  const [metadataForm, setMetadataForm] = useState<{ id: string; initial: IssueFormInput } | null>(null);
  const [fileId, setFileId] = useState("");
  const [fileBusy, setFileBusy] = useState(false);

  if (!ready) return <LoadingBlock label="Opening local registry…" />;

  function applyOutcome(o: VerificationOutcome) {
    setOutcome(o);
  }

  async function submitId(value: string) {
    const outcome = await runVerification({ id: value, method: "manual_id" });
    const cert = findCertificate(certificates, value);
    if (outcome.result === "registry_lookup" && cert) {
      setMetadataForm({ id: cert.id, initial: recordToFormInput(cert.id, cert) });
    } else {
      setMetadataForm(null);
    }
    applyOutcome(outcome);
  }

  async function submitLink() {
    const raw = linkInput.trim();
    if (!raw) {
      toast({ title: "Paste a verification link first", variant: "error" });
      return;
    }
    try {
      const parsed = new URL(raw);
      const match = parsed.pathname.match(/\/verify\/([^/]+)/);
      const id = match ? decodeURIComponent(match[1]) : "";
      await submitId(id);
    } catch {
      toast({
        title: "That link could not be parsed",
        description: "Expected format: <origin>/verify/CERTIFICATE-ID",
        variant: "error",
      });
    }
  }

  async function onScanned(raw: string) {
    try {
      const url = new URL(raw);
      const match = url.pathname.match(/\/verify\/([^/]+)/);
      const id = match ? decodeURIComponent(match[1]) : "";
      if (!id) throw new Error("no id");
      toast({ title: "QR decoded", description: `Certificate ${id}`, variant: "success" });
      await submitId(id);
    } catch {
      toast({
        title: "Invalid QR contents",
        description: `Scanned: ${raw.slice(0, 80)}`,
        variant: "error",
      });
    }
  }

  async function onFileCheck(file: File) {
    if (!fileId.trim()) {
      toast({ title: "Enter the certificate ID alongside the file", description: "File comparison needs both the record ID and the document." });
      return;
    }
    setFileBusy(true);
    try {
      const sha = await sha256FileBytes(await file.arrayBuffer());
      const outcome = await runVerification({
        id: fileId.trim(),
        method: "file_upload",
        uploadedFileSha256: sha,
      });
      applyOutcome(outcome);
    } catch {
      toast({ title: "Could not read the file", variant: "error" });
    } finally {
      setFileBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <SectionTitle
        title="Verification portal"
        description="Check any certificate against this browser’s local registry. No account or demo role required."
        actions={
          <Link href="/history">
            <Button variant="secondary" size="sm">View check history</Button>
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {/* 1. ID */}
          <Card>
            <div className="mb-3 flex items-center gap-2">
              <Search className="h-4 w-4 text-brand-soft" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-ink">1 · Certificate ID</h2>
            </div>
            <div className="flex gap-2">
              <Input
                aria-label="Certificate ID"
                placeholder="e.g. CRT-2025-M88X2Q"
                value={idInput}
                onChange={(e) => setIdInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && idInput.trim()) void submitId(idInput);
                }}
                className="font-mono uppercase"
              />
              <Button onClick={() => void submitId(idInput)} disabled={!idInput.trim()}>
                Check
              </Button>
            </div>
            <p className="mt-2 text-xs text-faint">
              A match checks existence + status. To complete cryptographic
              verification, edit the prefilled fields on the result page (or
              open a certificate directly).
            </p>
          </Card>

          {/* 2. Link */}
          <Card>
            <div className="mb-3 flex items-center gap-2">
              <Link2 className="h-4 w-4 text-brand-soft" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-ink">2 · Paste a verification link</h2>
            </div>
            <div className="flex gap-2">
              <Input
                aria-label="Verification link"
                placeholder="https://…/verify/CRT-…"
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submitLink();
                }}
              />
              <Button variant="secondary" onClick={() => void submitLink()}>
                Extract &amp; check
              </Button>
            </div>
          </Card>

          {/* 3. File */}
          <Card>
            <div className="mb-3 flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-brand-soft" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-ink">3 · File integrity check (raw bytes)</h2>
            </div>
            <Field
              label="Certificate ID the file belongs to"
              htmlFor="file-cert-id"
              hint="Only certificates issued with an original-document fingerprint accept file checks. The file is hashed in-memory — nothing is uploaded."
            >
              <Input
                id="file-cert-id"
                value={fileId}
                onChange={(e) => setFileId(e.target.value)}
                className="font-mono uppercase"
                placeholder="CRT-…"
              />
            </Field>
            <label className="mt-3 block">
              <span className="mb-1.5 block text-xs font-medium text-muted">Document file (PDF/image)</span>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onFileCheck(file);
                }}
                className="w-full rounded-lg border border-line bg-night-2 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-xs file:text-ink"
              />
            </label>
            {fileBusy ? <p className="mt-2 text-xs text-muted">Hashing file bytes…</p> : null}
            <p className="mt-3 text-[11px] leading-relaxed text-faint">
              ⚠️ This compares raw byte hashes — a different domain from the
              metadata fingerprint. It is honest about what it can prove: the file
              matches the bytes captured at issuance, or it doesn’t.
            </p>
          </Card>
        </div>

        <div className="space-y-6">
          {/* 4. QR scan */}
          <QRScanner onScanned={(raw) => void onScanned(raw)} />

          {/* Result / metadata steps */}
          {outcome ? (
            <VerificationResultCard outcome={outcome} onRepeat={() => void submitId(outcome.certificateId ?? idInput)} />
          ) : null}

          {metadataForm ? (
            <MetadataCheckForm
              initial={metadataForm.initial}
              onOutcome={(o) => o && applyOutcome(o)}
            />
          ) : null}

          {!outcome && !metadataForm ? (
            <Card>
              <div className="mb-3 flex items-center gap-2">
                <ScanLine className="h-4 w-4 text-brand-soft" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-ink">Result appears here</h2>
              </div>
              <p className="text-xs leading-relaxed text-muted">
                Possible results:{" "}
                <Badge tone="good">VERIFIED</Badge>{" "}
                <Badge tone="bad">TAMPERED</Badge>{" "}
                <Badge tone="warn">REVOKED</Badge>{" "}
                <Badge tone="neutral">NOT FOUND</Badge>{" "}
                <Badge tone="brand">RECORD FOUND</Badge>
              </p>
              <div className="mt-4 space-y-2 text-xs text-muted">
                <p><strong>Tampering challenge:</strong> check <code className="font-mono text-brand-soft">CRT-2025-M88X2Q</code>, then open its verification page and edit one field.</p>
                <p><strong>Revocation demo:</strong> check <code className="font-mono text-brand-soft">CRT-2024-R9VC5D</code> — it returns REVOKED.</p>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
