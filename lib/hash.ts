/**
 * Cryptographic fingerprinting helpers.
 *
 * All hashing uses the browser's Web Crypto API (also available in the test
 * runtime via Node's webcrypto global). Two distinct fingerprints exist in
 * the app and they are NEVER compared with each other:
 *
 *  1. `certificateFingerprint` — SHA-256 over a canonical JSON serialization
 *     of the normalized certificate metadata. This is the fingerprint stored
 *     on every certificate record and the one used for tamper detection when
 *     certificate data is re-entered.
 *  2. `sha256FileBytes` — SHA-256 over a document's raw bytes, used to prove
 *     a specific file (e.g. the original issued PDF) is unchanged.
 */

import type { CertificateMetadata } from "./types";

/** Convert raw bytes to a lowercase hex string. */
export function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

/** SHA-256 helper around crypto.subtle.digest. Returns lowercase 64-char hex. */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(digest));
}

/** SHA-256 over raw file/byte content (e.g. an uploaded PDF). */
export async function sha256FileBytes(
  bytes: ArrayBuffer | Uint8Array
): Promise<string> {
  const view =
    bytes instanceof Uint8Array
      ? new Uint8Array(bytes)
      : new Uint8Array(bytes);
  const digest = await crypto.subtle.digest("SHA-256", view);
  return bytesToHex(new Uint8Array(digest));
}

const HEX_64 = /^[a-f0-9]{64}$/;

/** True when a value is a well-formed 64-character lowercase hex fingerprint. */
export function isValidFingerprint(value: unknown): value is string {
  return typeof value === "string" && HEX_64.test(value);
}

/**
 * Deterministic serialization used for ALL canonical payloads.
 *
 * - Recursively sorts object keys alphabetically, so the result never depends
 *   on property insertion order.
 * - Omits `undefined`, `null` and empty strings.
 * - Arrays survive as arrays with inner objects canonicalized.
 *
 * Anything hashed for comparison must go through this function, otherwise a
 * hash computed at issue time cannot be reproduced later.
 */
export function stableStringify(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value !== "object") return JSON.stringify(value);

  if (Array.isArray(value)) {
    const items = value
      .map(stableStringify)
      .filter((item) => item !== "");
    return `[${items.join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);

  return entries.length > 0 ? `{${entries.join(",")}}` : "{}";
}

/**
 * The exact payload that is fingerprinted for a certificate: the certificate
 * metadata itself (all metadata fields). `issuedAt`, `status` and revocation
 * data are deliberately EXCLUDED — those are lifecycle attributes stored
 * next to the fingerprint, not part of the credential content.
 */
export function canonicalCertificatePayload(
  metadata: CertificateMetadata
): string {
  return stableStringify(metadata);
}

/**
 * Certificate fingerprint = SHA-256 of the canonical metadata payload.
 * The same normalized metadata always produces the same fingerprint.
 */
export async function certificateFingerprint(
  metadata: import("./types").CertificateMetadata
): Promise<string> {
  return sha256Hex(canonicalCertificatePayload(metadata));
}

/**
 * Given the fields listed in a canonical payload and supplied values, return
 * the potentially-differing fields so tamper results can explain themselves.
 */
export function detectMetadataDifferences(
  expected: Record<string, unknown>,
  supplied: Record<string, unknown>
): string[] {
  const keys = new Set([...Object.keys(expected), ...Object.keys(supplied)]);
  const differing: string[] = [];
  for (const key of keys) {
    const e = stableStringify(expected[key] ?? "");
    const s = stableStringify(supplied[key] ?? "");
    if (e !== s) differing.push(key);
  }
  return differing.sort();
}
