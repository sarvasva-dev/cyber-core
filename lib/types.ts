/**
 * CertiChain domain types.
 *
 * Everything in the app is derived from two primary collections persisted in
 * browser LocalStorage: the certificate registry and the verification log.
 */

/** Certificate lifecycle status within the local demo registry. */
export type CertificateStatus = "active" | "revoked";

/**
 * The metadata fields that participate in the certificate fingerprint.
 * Extending this list changes how hashes are computed — fingerprint values
 * only remain comparable for data saved with the same field set.
 */
export interface CertificateMetadata {
  /** Public certificate identifier, e.g. CRT-2026-A1B2C3. */
  id: string;
  studentName: string;
  studentEmail?: string;
  course: string;
  institution: string;
  department?: string;
  registrationNumber?: string;
  grade?: string;
  /** ISO date (YYYY-MM-DD). */
  issueDate: string;
  /** ISO date (YYYY-MM-DD), optional. */
  expiryDate?: string;
  issuerName: string;
  notes?: string;
}

/** A stored certificate record. The fingerprint is the record's integrity anchor. */
export interface Certificate extends CertificateMetadata {
  /** SHA-256 fingerprint of the canonical metadata payload (64 hex chars). */
  fingerprint: string;
  /** ISO timestamp of when this record was created locally. */
  issuedAt: string;
  /** Demo actor that issued the certificate (informational only). */
  issuedBy?: string;
  status: CertificateStatus;
  /** ISO timestamp when revoked (populated only for revoked certs). */
  revokedAt?: string;
  /** Demo actor who revoked it. */
  revokedBy?: string;
  /**
   * Optional SHA-256 fingerprint of the ORIGINAL document file (raw bytes),
   * captured at issuance time. Uploaded-file verification compares a fresh
   * file hash against this value. This is separate from `fingerprint`,
   * which hashes normalized metadata.
   */
  documentSha256?: string;
  documentName?: string;
}

export type VerificationResult =
  | "verified"
  | "tampered"
  | "revoked"
  | "not_found"
  | "invalid_input";

/**
 * History rows can additionally record "registry_lookup": an ID/QR check
 * that found the record and its status but did not compare a fingerprint.
 * It is deliberately never reported to the user as VERIFIED.
 */
export type LoggableResult = VerificationResult | "registry_lookup";

export type VerificationMethod =
  | "manual_id"
  | "metadata"
  | "file_upload"
  | "qr_link";

/** One verification attempt, persisted to LocalStorage. */
export interface VerificationLog {
  id: string;
  certificateId?: string;
  timestamp: string;
  method: VerificationMethod;
  result: LoggableResult;
  message: string;
  /** Fingerprint computed from the supplied data, when we have one. */
  suppliedFingerprint?: string;
}

/** Demo session — role selection for exploring the product, NOT real auth. */
export type DemoRole = "admin" | "student" | "verifier";

export interface DemoProfile {
  id: string;
  role: DemoRole;
  name: string;
  email: string;
  affiliation: string;
}

export interface DemoSession {
  profileId: string;
  startedAt: string;
}

export interface AppPreferences {
  /** Extra demo behaviour flags can live here later; kept simple for MVP. */
  seededAt?: string;
  /** Whether the guided demo walkthrough has been seen. */
  walkthroughSeen?: boolean;
}

/** Non-sensitive input supplied to the verification engine. */
export interface SuppliedCertificateInput extends Partial<CertificateMetadata> {
  id: string;
}
