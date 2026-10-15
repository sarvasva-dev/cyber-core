"use client";

/**
 * Certificate issuance.
 *
 * Server responsibilities: none (frontend-only). The form validates input,
 * normalizes metadata, computes the SHA-256 fingerprint over the canonical
 * payload (Web Crypto), then persists the record. Success UI appears ONLY
 * after the record exists.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ChangeEvent } from "react";
import { FileCheck2, FileText, Fingerprint, Printer, QrCode, RotateCcw, ShieldCheck } from "lucide-react";
import { QRCodeImage, downloadQrPng } from "@/components/qr";
import { useStore, useToast } from "@/components/providers";
import {
  Badge,
  Button,
  Card,
  CopyButton,
  Field,
  FingerprintText,
  Input,
  SectionTitle,
  Textarea,
} from "@/components/ui";
import { proposeCertificateId } from "@/lib/certificates";
import { sha256FileBytes } from "@/lib/hash";
import { verificationUrl } from "@/lib/format";
import { hasErrors, sanitizeFileName, validateIssueForm, type IssueFormInput } from "@/lib/validation";
import type { Certificate } from "@/lib/types";

const BLANK: IssueFormInput = {
  id: "",
  studentName: "",
  studentEmail: "",
  course: "",
  institution: "Northbridge Technical University",
  department: "",
  registrationNumber: "",
  grade: "",
  issueDate: "",
  expiryDate: "",
  issuerName: "",
  notes: "",
};

export default function IssueCertificatePage() {
  const { ready, certificates, issue, profile } = useStore();
  const toast = useToast();
  const router = useRouter();

  const [form, setForm] = useState<IssueFormInput>(BLANK);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [issued, setIssued] = useState<Certificate | null>(null);

  // Optional original-document fingerprint (raw bytes of the uploaded file).
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentSha, setDocumentSha] = useState<string | null>(null);
  const [documentBusy, setDocumentBusy] = useState(false);

  // Derived defaults — Components render-loop friendly and hydration-safe:
  // values only become available after `ready` (client-only), so server and
  // first client render match (blank → loading defaults everywhere).
  const fallbackId = useMemo(
    () => (ready ? proposeCertificateId(certificates) : ""),
    [ready, certificates]
  );
  const fallbackDate = useMemo(
    () => (ready ? new Date().toISOString().slice(0, 10) : ""),
    [ready]
  );
  const displayForm = useMemo<IssueFormInput>(
    () => ({
      ...form,
      id: form.id || fallbackId,
      issueDate: form.issueDate || fallbackDate,
      issuerName: form.issuerName || (ready && profile?.role === "admin" ? profile.name : ""),
    }),
    [form, fallbackId, fallbackDate, ready, profile]
  );

  const idTaken = useMemo(
    () => certificates.some((c) => c.id.toUpperCase() === displayForm.id.trim().toUpperCase()),
    [certificates, displayForm.id]
  );

  function set<K extends keyof IssueFormInput>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function onDocumentSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setDocumentFile(file);
    setDocumentSha(null);
    if (!file) return;
    setDocumentBusy(true);
    try {
      const bytes = await file.arrayBuffer();
      const sha = await sha256FileBytes(bytes);
      setDocumentSha(sha);
    } catch {
      setDocumentSha(null);
    } finally {
      setDocumentBusy(false);
    }
  }

  async function regenerateId() {
    set("id", proposeCertificateId(certificates));
  }

  async function submit() {
    const found = validateIssueForm(displayForm);
    if (idTaken) found.id = `Certificate ID ${displayForm.id.trim().toUpperCase()} is already in use. Choose a different ID.`;
    if (hasErrors(found)) {
      setErrors(found);
      toast({ title: "Check the highlighted fields", variant: "error" });
      return;
    }
    setSubmitting(true);
    const result = await issue(displayForm, {
      issuedBy: profile?.name ?? "Admin (demo)",
      documentSha256: documentSha ?? undefined,
      documentName: documentFile ? sanitizeFileName(documentFile.name) : undefined,
    });
    setSubmitting(false);
    if (!result.ok || !result.certificate) {
      toast({ title: "Issuance failed", description: result.error, variant: "error" });
      if (result.errorKind === "duplicate_id") {
        setErrors((prev) => ({ ...prev, id: result.error ?? "This ID is already in use." }));
      }
      return;
    }
    setIssued(result.certificate);
    toast({ title: "Certificate issued", description: `${result.certificate.id} added to the registry.`, variant: "success" });
  }

  function reset() {
    setIssued(null);
    setDocumentFile(null);
    setDocumentSha(null);
    setForm({ ...BLANK, id: proposeCertificateId(certificates), issueDate: new Date().toISOString().slice(0, 10) });
  }

  if (issued) {
    const url = verificationUrl(issued.id);
    return (
      <div className="space-y-6">
        <SectionTitle
          title="Certificate issued"
          description="The record is in this browser’s registry with its SHA-256 fingerprint. Actions below work immediately."
          actions={
            <Button variant="secondary" onClick={reset}>
              <RotateCcw className="h-4 w-4" /> Issue another
            </Button>
          }
        />
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="good"><ShieldCheck className="h-3.5 w-3.5" /> Issued &amp; fingerprinted</Badge>
            <Badge tone="neutral">{issued.id}</Badge>
          </div>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-faint">Student</dt>
              <dd className="mt-0.5 text-ink">{issued.studentName}</dd>
            </div>
            <div>
              <dt className="text-xs text-faint">Course</dt>
              <dd className="mt-0.5 text-ink">{issued.course}</dd>
            </div>
            <div>
              <dt className="text-xs text-faint">Institution</dt>
              <dd className="mt-0.5 text-ink">{issued.institution}</dd>
            </div>
            <div>
              <dt className="text-xs text-faint">Issue date</dt>
              <dd className="mt-0.5 text-ink">{issued.issueDate}</dd>
            </div>
          </dl>
          <div className="mt-5">
            <p className="mb-1 text-xs font-medium text-muted">SHA-256 fingerprint (canonical metadata)</p>
            <FingerprintText value={issued.fingerprint} />
            {documentSha ? (
              <>
                <p className="mb-1 mt-3 text-xs font-medium text-muted">
                  Original document fingerprint — raw bytes of {documentFile?.name} (separate domain; never compared with the metadata hash)
                </p>
                <code className="break-all rounded-md border border-line-soft bg-night-2 px-2 py-1 font-mono text-xs text-aqua">
                  {documentSha}
                </code>
              </>
            ) : null}
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-[auto_1fr]">
            <div className="flex flex-col items-center gap-2">
              <QRCodeImage value={url} size={140} />
              <div className="flex gap-1">
                <CopyButton value={url} label="Copy link" />
                <Button size="sm" variant="ghost" onClick={() => downloadQrPng(url, `${issued.id}-qr`)}>
                  <QrCode className="h-3.5 w-3.5" /> QR
                </Button>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <p className="break-all text-xs text-muted">
                Verification URL: <code className="font-mono text-brand-soft">{url}</code>
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Link href={`/admin/certificates/${issued.id}`}>
                  <Button size="sm"><FileCheck2 className="h-4 w-4" /> Certificate details</Button>
                </Link>
                <Link href={`/verify/${issued.id}`}>
                  <Button size="sm" variant="secondary"><ShieldCheck className="h-4 w-4" /> Verify it</Button>
                </Link>
                <Link href={`/certificates/${issued.id}/print`}>
                  <Button size="sm" variant="secondary"><Printer className="h-4 w-4" /> Print / PDF</Button>
                </Link>
                <Button size="sm" variant="ghost" onClick={() => router.push("/admin/certificates")}>
                  <FileText className="h-4 w-4" /> Registry
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Issue a certificate"
        description="Validated metadata is normalized, hashed with SHA-256, and stored in the local registry. Fields marked optional are excluded from empty values before hashing."
      />
      <Card>
        {/* Certificate identity */}
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-faint">Certificate</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Certificate ID" htmlFor="id" error={errors.id} hint={idTaken ? undefined : "Auto-generated; editable. Duplicate IDs are rejected."}>
            <div className="flex gap-2">
              <Input id="id" value={displayForm.id} onChange={(e) => set("id", e.target.value)} invalid={!!errors.id || idTaken} className="font-mono uppercase" />
              <Button variant="secondary" size="md" type="button" onClick={regenerateId}>Regenerate</Button>
            </div>
            {idTaken ? (
              <p role="alert" className="mt-1 text-xs font-medium text-bad">This ID already exists in the registry.</p>
            ) : null}
          </Field>
          <Field label="Issue date" htmlFor="issueDate" error={errors.issueDate}>
            <Input id="issueDate" type="date" value={displayForm.issueDate} onChange={(e) => set("issueDate", e.target.value)} invalid={!!errors.issueDate} />
          </Field>
        </div>

        {/* Student */}
        <h2 className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wider text-faint">Student</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Student full name" htmlFor="studentName" error={errors.studentName}>
            <Input id="studentName" value={form.studentName} onChange={(e) => set("studentName", e.target.value)} invalid={!!errors.studentName} placeholder="e.g. Aarav Sharma" />
          </Field>
          <Field label="Student email (optional)" htmlFor="studentEmail" error={errors.studentEmail}>
            <Input id="studentEmail" type="email" value={form.studentEmail} onChange={(e) => set("studentEmail", e.target.value)} invalid={!!errors.studentEmail} />
          </Field>
          <Field label="Course / degree" htmlFor="course" error={errors.course}>
            <Input id="course" value={form.course} onChange={(e) => set("course", e.target.value)} placeholder="e.g. B.Tech Computer Science & Engineering" />
          </Field>
          <Field label="Department (optional)" htmlFor="department">
            <Input id="department" value={form.department} onChange={(e) => set("department", e.target.value)} />
          </Field>
          <Field label="Registration / roll number (optional)" htmlFor="registrationNumber">
            <Input id="registrationNumber" value={form.registrationNumber} onChange={(e) => set("registrationNumber", e.target.value)} className="font-mono" />
          </Field>
          <Field label="Grade / classification (optional)" htmlFor="grade">
            <Input id="grade" value={form.grade} onChange={(e) => set("grade", e.target.value)} placeholder="e.g. First Class with Distinction" />
          </Field>
        </div>

        {/* Institution & issuer */}
        <h2 className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wider text-faint">Institution &amp; issuer</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Institution" htmlFor="institution" error={errors.institution}>
            <Input id="institution" value={form.institution} onChange={(e) => set("institution", e.target.value)} />
          </Field>
          <Field label="Issuer name" htmlFor="issuerName" error={errors.issuerName}>
            <Input id="issuerName" value={displayForm.issuerName} onChange={(e) => set("issuerName", e.target.value)} />
          </Field>
          <Field label="Expiry date (optional)" htmlFor="expiryDate" hint="Leave blank for lifetime validity.">
            <Input id="expiryDate" type="date" value={form.expiryDate} onChange={(e) => set("expiryDate", e.target.value)} invalid={!!errors.expiryDate} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes (optional)" htmlFor="notes">
              <Textarea id="notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </Field>
          </div>
        </div>

        {/* Original document (optional) */}
        <h2 className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wider text-faint">Original document (optional)</h2>
        <Field
          label="Upload the issued document file (e.g. the PDF) to fingerprint its raw bytes"
          htmlFor="documentFile"
          hint={`Stored as a separate ${documentSha ? "fingerprint" : "fingerprint once hashed"} for later file-integrity checks. The file itself is never uploaded anywhere.`}
        >
          <Input
            id="documentFile"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            onChange={onDocumentSelect}
            className="file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-xs file:text-ink"
          />
        </Field>
        {documentBusy ? <p className="mt-2 text-xs text-muted">Hashing file…</p> : null}
        {documentSha ? (
          <p className="mt-2 flex items-center gap-2 text-xs text-good">
            <Fingerprint className="h-3.5 w-3.5" />
            <code className="break-all font-mono">{documentSha.slice(0, 32)}…</code> captured
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap justify-end gap-2 border-t border-line-soft pt-5">
          <Link href="/admin/certificates">
            <Button variant="ghost" size="md">Cancel</Button>
          </Link>
          <Button size="lg" onClick={submit} loading={submitting} disabled={submitting || documentBusy}>
            <Fingerprint className="h-4 w-4" /> Fingerprint &amp; issue
          </Button>
        </div>
      </Card>
    </div>
  );
}
