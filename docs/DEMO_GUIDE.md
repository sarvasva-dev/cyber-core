# CertiChain — Demo Guide for Team Cyber Core

Everything scripts assume the app is running (`npm run dev` or a deployed URL) and the demo registry is intact (Settings → **Restore demo data** if unsure).

---

## 1. One-minute pitch

> Employers trust resumes they cannot verify and verify certificates with phone calls that take weeks. CertiChain flips this: every certificate is issued with a SHA-256 cryptographic fingerprint computed in the browser, carries a QR verification code, and can be checked by anyone in seconds. Change even one character of the data — a grade, a date — and the fingerprint breaks instantly: TAMPERED. Revoke a credential, and every future check reports REVOKED even when the hash still matches. The whole MVP runs in the browser with no backend: issuance, verification, tampering detection, revocation, and audit history — all client-side, all honest about what is real and what is demo.

## 2. Three-minute demo script

| Time | Action | What to say |
| --- | --- | --- |
| 0:00–0:30 | Open `/`. Run **Check authentic data** on the landing demo card. | "This is a real check against a live local registry — VERIFIED means the SHA-256 fingerprint of the re-entered data matches what was stored at issuance." |
| 0:30–1:00 | Click **Tamper with the grade**, run the check again. | "One word changed — the hash no longer matches. `TAMPERED`, and the UI shows exactly which field differed. That's the fraud-detection core." |
| 1:00–1:30 | Type `CRT-2024-R9VC5D` in `/verify` and check it. | "This record was revoked by the registrar. Even though the hash logic still matches the stored fingerprint, the engine returns REVOKED — revocation always wins. A revoked certificate can never be shown as valid." |
| 1:30–2:15 | `/login` → Admin → `/admin/issue`. Fill student + course, click **Fingerprint & issue**. | "The issuance form validates every field. On submit, metadata is normalized, canonicalized with sorted keys, hashed with Web Crypto, and stored locally — note the 64-character fingerprint, QR code, and shareable link generated instantly." |
| 2:15–2:40 | Open `/admin/certificates`, revoke a certificate (confirm dialog). | "Revocation is recorded with the actor and a timestamp; the original fingerprint is preserved." |
| 2:40–3:00 | `/login` → Student → `/student/certificates`; show QR, Share, Print. `/history`. | "The student wallet derives from the same single registry. Every verification attempt is logged — searchable and exportable." |

## 3. Five-minute demo script

Same as the 3-minute script, plus:

- **Landing page story** (before the live demo): problem → Issue / Fingerprint / Share / Verify workflow → the three personas.
- **File-integrity separation**: open `/verify/CRT-2025-M88X2Q` and explain the two hash domains — metadata fingerprint vs. original-document raw-byte fingerprint; they are never compared to each other. If a document fingerprint exists (admin uploaded a file at issuance), upload it (or a modified file) on the verification page to show the raw-byte check.
- **QR camera scan**: on `/verify`, click **Start camera** (Chromium), scan a certificate's QR from the print sheet on a phone. Fall back to pasting the verification URL or typing the ID (works in every browser).
- **Settings transparency**: show **Storage keys**, **Restore demo data**, **Erase all** — emphasize the app only ever touches its own `certichain:v1:*` keys.
- **Print flow**: `/certificates/CRT-2025-M88X2Q/print` → "Save as PDF" produces a certificate with the embedded QR code.

## 4. Judge walkthrough (self-guided)

1. `/` — landing; live demo card at the top-right; "Start the demo" CTA.
2. `/login` — pick **Verifier**; land in the verification overview.
3. `/verify` — check `CRT-2025-M88X2Q` by ID **Check** → RECORD FOUND; click **Open verification page** → Recompute (unedited → VERIFIED) → Simulate tampering (→ TAMPERED: "grade").
4. `/verify/CRT-2024-R9VC5D` — the revoked sample; notice the warning banner explaining revocation beats hash matching.
5. `/login` → **Admin** → `/admin/issue` — invalid submit shows inline errors; a valid one issues immediately with fingerprint + QR + link + print.
6. `/admin/certificates` — search, sort, revoke `CRT-2025-V7HQ8B`, then re-verify it anywhere → REVOKED. Un-revoke is available on its detail page (demo undo).
7. `/history` — every check; filter by TAMPERED.
8. `/settings` — switch roles manually, restore demo data, see the exact storage keys.
9. Unknown URL — custom not-found page with a path back to verification.

## 5. SHA-256 technical brief (for technical questions)

```
fingerprint = SHA256( canonicalJSON( normalizedMetadata ) )

normalizedMetadata:
  - strim whitespace; empty strings treated as absent
  - dates in YYYY-MM-DD
canonicalJSON:
  - object keys sorted alphabetically, recursively
  - undefined / null / "" dropped
  - deterministic: never depends on property insertion order
digest: crypto.subtle.digest("SHA-256", TextEncoder(payload))  → 64 lowercase hex chars
```

- Hashed fields: id, studentName, studentEmail, course, institution, department, registrationNumber, grade, issueDate, expiryDate, issuerName, notes.
- **Not** hashed: `issuedAt`, `issuedBy`, `status`, `revokedAt`, `revokedBy` — lifecycle bookkeeping stored beside the fingerprint.
- Verification recomputes the same hash from re-entered data and compares against the stored fingerprint. Field-level differences (e.g. "Grade") are computed separately and reported.
- Revised raw-file flow: `documentSha256 = SHA256(fileBytes)` computed on the uploaded original at issuance; later uploads compare fresh bytes against this value. Raw bytes are never uploaded off-device.

## 6. Judge Q&A

**Q: Is this a real blockchain?**
A: No — and the product never claims otherwise. This MVP demonstrates *why fingerprints are useful* and *what the UX looks like*. Anchoring fingerprints on-chain is a clearly separated future roadmap item (see README §17). The registry is LocalStorage in a single browser.

**Q: Can I cheat the verification?**
A: LocalStorage is not immutable — a user with devtools can alter records or delete revocations. That is exactly why a production version anchors fingerprints on-chain or on an issuer-operated server. We also avoid anything server-shaped pretending to be secure: no fake auth, no fake transactions, no fake network confirmations.

**Q: How is verification "verified" then?**
A: The fingerprint check is real and done with Web Crypto SHA-256: tampered data genuinely fails and intact data genuinely passes. It proves *data integrity since issuance in this registry* — it does not prove the real-world qualification was awarded. Both facts are stated in the UI.

**Q: Why LocalStorage instead of a database?**
A: Hackathon constraint: fully frontend, zero setup, zero cost, instant demoing. It also keeps file processing on-device (privacy by architecture). Production would store only fingerprints, never documents.

**Q: What happens with two browser tabs?**
A: The `storage` event keeps tabs synchronized within the same browser.

**Q: How does the QR scan work?**
A: Native `BarcodeDetector` API exists on Chromium. We poll decoded frames and parse `/verify/<ID>` URLs. Anything else (Firefox/Safari, denied camera access) degrades to manual ID/link entry clearly explained in the UI — scanning is deliberately optional.

**Q: What is NOT implemented yet?**
A: Shared/global registry, server-enforced authorization, real Ethereum anchoring, bytes-stored PDF generation, cross-device sync, AI anomaly detection — all listed in README §17. We keep implemented vs. planned sharply separated.

**Q: What are the demonstrated results?**
A: VERIFIED, TAMPERED, REVOKED, NOT FOUND, INVALID INPUT, plus RECORD FOUND (bare-ID lookup that never overstates — it explicitly says no fingerprint was compared yet).

## 7. Implemented vs. future (one-liner)

- **Implemented:** issuance + validation, SHA-256 fingerprints, per-browser registry, QR generation + deep links, verification portal (ID/link/scan/file), tamper detection with field attribution, revocation + un-revoke, verification history + filters + export, role-aware dashboards from real data, print-to-PDF sheet, settings + data controls, 40 automated tests.
- **Future:** on-chain anchoring, issuer backend, shared registry, real accounts, PDF bytes storage, AI anomaly detection, DigiLocker/Academic-Bank integrations.
