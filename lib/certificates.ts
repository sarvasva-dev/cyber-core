/**
 * Certificate registry logic: normalization, issuance, revocation, lookup.
 *
 * The single registry array is persisted under one storage key so every
 * portal (admin / student / verifier) reads the same source of truth. All
 * views derive from it — there are no parallel student/verifier data arrays.
 */

import {
  certificateFingerprint,
  canonicalCertificatePayload,
  detectMetadataDifferences,
  isValidFingerprint,
} from "./hash";
import {
  STORAGE_KEYS,
  notifySelf,
  readCertificates,
  writeJson,
} from "./storage";
import {
  trimOrUndefined,
  validateCertificateId,
  type IssueFormInput,
} from "./validation";
import type {
  Certificate,
  CertificateMetadata,
  LoggableResult,
} from "./types";

export interface IssueResult {
  ok: boolean;
  certificate?: Certificate;
  error?: string;
  /** More specific failure kind, so the UI can tailor messaging. */
  errorKind?: "duplicate_id" | "validation" | "storage";
}

/** Alphabetically-sorted-public-id generator (readable, collision-checked). */
const ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I,O,0,1 (confusables)

export function randomToken(length = 6): string {
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  let token = "";
  for (const value of values) token += ID_ALPHABET[value % ID_ALPHABET.length];
  return token;
}

export function proposeCertificateId(existing: Certificate[] = []): string {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = `CRT-${year}-${randomToken()}`;
    if (!existing.some((cert) => cert.id.toUpperCase() === candidate)) {
      return candidate;
    }
  }
  // Practically unreachable; deterministic suffix fallback.
  return `CRT-${year}-${Date.now().toString(36).toUpperCase()}`;
}

/** Build the normalized metadata object whose fingerprint is stored/verified. */
export function normalizeMetadata(input: IssueFormInput): CertificateMetadata {
  return {
    id: input.id.trim().toUpperCase(),
    studentName: input.studentName.trim(),
    studentEmail: trimOrUndefined(input.studentEmail),
    course: input.course.trim(),
    institution: input.institution.trim(),
    department: trimOrUndefined(input.department),
    registrationNumber: trimOrUndefined(input.registrationNumber),
    grade: trimOrUndefined(input.grade),
    issueDate: input.issueDate.trim(),
    expiryDate: trimOrUndefined(input.expiryDate),
    issuerName: input.issuerName.trim(),
    notes: trimOrUndefined(input.notes),
  };
}

/**
 * Issue a certificate end-to-end:
 *  1. validate input,
 *  2. normalize metadata,
 *  3. compute SHA-256 fingerprint over the canonical payload,
 *  4. persist the record (never overwriting an existing ID).
 *
 * Web Crypto's digest is async, so this is the real entrypoint; a result
 * object is returned instead of throwing so the form can present inline,
 * accessible error messages.
 */
export interface IssueOptions {
  issuedBy?: string;
  documentSha256?: string;
  documentName?: string;
  registry?: Certificate[];
}

/**
 * Issue a certificate end-to-end. Returns a result object instead of
 * throwing so the form can render inline, accessible error messages.
 */
export async function issueCertificateAsync(
  input: IssueFormInput,
  opts: IssueOptions = {}
): Promise<IssueResult> {
  const registry = opts.registry ?? readCertificates();
  const id = input.id.trim().toUpperCase();

  const duplicate = registry.find((cert) => cert.id.toUpperCase() === id);
  if (duplicate) {
    return {
      ok: false,
      errorKind: "duplicate_id",
      error: `Certificate ID ${id} is already in use.`,
    };
  }

  const metadata = normalizeMetadata(input);
  const fingerprint = await certificateFingerprint(metadata);

  const record: Certificate = {
    ...metadata,
    fingerprint,
    status: "active",
    issuedAt: new Date().toISOString(),
    issuedBy: opts.issuedBy,
    documentSha256: isValidFingerprint(opts.documentSha256)
      ? opts.documentSha256
      : undefined,
    documentName: opts.documentName,
  };

  const next = [...registry, record];
  const saved = writeJson(STORAGE_KEYS.certificates, next);
  if (!saved) {
    return {
      ok: false,
      errorKind: "storage",
      error: "Could not save to browser storage (storage may be full or blocked).",
    };
  }
  notifySelf(STORAGE_KEYS.certificates);
  return { ok: true, certificate: record };
}

/**
 * Revoke a certificate. The fingerprint and metadata are deliberately kept —
 * revocation changes the status, it does not erase credential history.
 * Accepts an explicit registry for pure/unit usage; otherwise persists to
 * LocalStorage.
 */
export function revokeCertificate(
  id: string,
  actor = "Registrar (demo)",
  opts: { registry?: Certificate[] } = {}
): IssueResult {
  const registry = opts.registry ?? readCertificates();
  const index = registry.findIndex((cert) => cert.id.toUpperCase() === id.trim().toUpperCase());
  if (index === -1) return { ok: false, error: "Certificate not found." };

  const record = registry[index];
  if (record.status === "revoked") {
    return { ok: false, error: "Certificate is already revoked." };
  }

  const updated: Certificate = {
    ...record,
    status: "revoked",
    revokedAt: new Date().toISOString(),
    revokedBy: actor,
  };
  const next = [...registry];
  next[index] = updated;
  if (!opts.registry && !writeJson(STORAGE_KEYS.certificates, next)) {
    return { ok: false, errorKind: "storage", error: "Could not save to browser storage." };
  }
  if (!opts.registry) {
    notifySelf(STORAGE_KEYS.certificates);
  }
  return { ok: true, certificate: updated };
}

/** Re-activate a revoked certificate (undoes a demo revocation). */
export function restoreCertificate(
  id: string,
  opts: { registry?: Certificate[] } = {}
): IssueResult {
  const registry = opts.registry ?? readCertificates();
  const index = registry.findIndex((cert) => cert.id.toUpperCase() === id.trim().toUpperCase());
  if (index === -1) return { ok: false, error: "Certificate not found." };
  const record = registry[index];
  if (record.status !== "revoked") {
    return { ok: false, error: "Certificate is not revoked." };
  }
  const updated: Certificate = { ...record, status: "active", revokedAt: undefined, revokedBy: undefined };
  const next = [...registry];
  next[index] = updated;
  if (!opts.registry && !writeJson(STORAGE_KEYS.certificates, next)) {
    return { ok: false, errorKind: "storage", error: "Could not save to browser storage." };
  }
  if (!opts.registry) {
    notifySelf(STORAGE_KEYS.certificates);
  }
  return { ok: true, certificate: updated };
}

/* ---------- lookups & derived helpers (pure) ---------- */

export function findCertificate(registry: Certificate[], id: string): Certificate | undefined {
  const needle = id.trim().toUpperCase();
  return registry.find((cert) => cert.id.toUpperCase() === needle);
}

/** Replace registry wholesale (used by demo-data restore). */
export function replaceRegistry(certificates: Certificate[]): boolean {
  const saved = writeJson(STORAGE_KEYS.certificates, certificates);
  if (saved) notifySelf(STORAGE_KEYS.certificates);
  return saved;
}



export function statusFilterMatches(
  cert: Certificate,
  status: "all" | "active" | "revoked"
): boolean {
  return status === "all" || cert.status === status;
}

export type CertificateSortKey = "recent" | "oldest" | "student" | "status";

export function sortCertificates(
  certs: Certificate[],
  key: CertificateSortKey = "recent"
): Certificate[] {
  const copy = [...certs];
  switch (key) {
    case "recent":
      return copy.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
    case "oldest":
      return copy.sort((a, b) => a.issuedAt.localeCompare(b.issuedAt));
    case "student":
      return copy.sort((a, b) => a.studentName.localeCompare(b.studentName));
    case "status":
      return copy.sort((a, b) => a.status.localeCompare(b.status));
  }
}

/** Certificates "belonging" to a demo student profile (name or email match). */
export function certificatesForStudent(
  registry: Certificate[],
  student: { name: string; email?: string }
): Certificate[] {
  const name = student.name.trim().toLowerCase();
  const email = student.email?.trim().toLowerCase();
  return registry.filter(
    (cert) =>
      cert.studentName.trim().toLowerCase() === name ||
      (!!email && !!cert.studentEmail && cert.studentEmail.trim().toLowerCase() === email)
  );
}

export const RESULT_LABELS: Record<LoggableResult, string> = {
  verified: "Verified",
  tampered: "Hash mismatch (tampered)",
  revoked: "Revoked",
  not_found: "Not found",
  invalid_input: "Invalid input",
  registry_lookup: "Registry lookup",
};
