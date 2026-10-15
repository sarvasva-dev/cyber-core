"use client";

/**
 * The printable certificate sheet. Rendered on /certificates/[id]/print with
 * `window.print()`; browsers' "Save as PDF" produces the deliverable file.
 * The QR code embeds the exact verification URL for the certificate ID shown.
 */

import { QRCodeImage } from "./qr";
import { formatDate, verificationUrl } from "@/lib/format";
import type { Certificate } from "@/lib/types";
import { Button } from "./ui";

export function CertificateSheet({ cert }: { cert: Certificate }) {
  const url = verificationUrl(cert.id);
  return (
    <div className="print-sheet mx-auto w-full max-w-3xl bg-white p-8 text-slate-900 shadow-2xl sm:p-12"
      style={{ aspectRatio: "1 / 0.707", minHeight: "560px" }}
    >
      <div className="flex h-full flex-col">
        {/* Header band */}
        <div className="flex items-start justify-between border-b-4 border-[#0b1428] pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#2f6bff]">
              Certificate of Completion
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#0b1428] sm:text-4xl">
              {cert.institution}
            </h1>
            <p className="mt-1 text-sm text-slate-500">Demo institution · local registry record</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-slate-400">CertiChain</p>
            <p className="font-mono text-[11px] text-slate-600">{cert.id}</p>
          </div>
        </div>

        {/* Body */}
        <div className="mt-8 flex-1 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">This certifies that</p>
          <p className="mt-3 text-4xl font-semibold text-[#0b1428] sm:text-5xl">{cert.studentName}</p>
          {cert.registrationNumber ? (
            <p className="mt-1 font-mono text-xs text-slate-500">{cert.registrationNumber}</p>
          ) : null}
          <p className="mt-6 text-sm text-slate-600">has successfully completed</p>
          <p className="mt-2 text-xl font-medium text-[#0b1428]">{cert.course}</p>
          {cert.grade ? (
            <p className="mt-3 text-sm text-slate-600">
              with grade <span className="font-semibold">{cert.grade}</span>
            </p>
          ) : null}
          <p className="mt-8 text-xs text-slate-500">
            Issued on {formatDate(cert.issueDate)}
            {cert.expiryDate ? ` · valid until ${formatDate(cert.expiryDate)}` : " · no expiry"}
          </p>
        </div>

        {/* Footer: signatures + QR */}
        <div className="mt-8 flex items-end justify-between border-t border-slate-200 pt-5">
          <div className="text-left">
            <p className="border-t border-slate-400 pt-2 font-semibold text-[#0b1428]">{cert.issuerName}</p>
            <p className="mt-1 max-w-56 text-[10px] text-slate-500">
              {cert.department ? `${cert.department} · ` : ""}Authorised signatory
            </p>
          </div>
          <div className="text-center">
            <QRCodeImage value={url} size={92} />
            <p className="mt-1 max-w-52 break-all text-[8px] text-slate-500">{url}</p>
          </div>
          <div className="max-w-64 text-right">
            <p className="text-[10px] uppercase tracking-widest text-[#2f6bff]">Verification note</p>
            <p className="mt-1 text-[9px] leading-snug text-slate-500">
              Verify this credential at the URL printed above. Any change to the
              recorded contents breaks its SHA-256 fingerprint match. Verify
              before trusting this document.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PrintToolbar({ onPrint }: { onPrint?: () => void }) {
  return (
    <div className="print-hide mx-auto mb-6 flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
      <p className="text-xs text-muted">
        Use your browser’s print dialog and choose <strong>Save as PDF</strong>.
        The sheet is exactly what will be printed.
      </p>
      <Button onClick={onPrint ?? (() => window.print())}>
        <span aria-hidden="true">🖨</span> Print / Save as PDF
      </Button>
    </div>
  );
}
