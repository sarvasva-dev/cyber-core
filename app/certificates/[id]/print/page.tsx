"use client";

/**
 * Certificate print route. Opens the printable sheet outside the dashboard
 * shell so browser print output is clean. Also accessible from student and
 * verifier flows via links.
 */

import Link from "next/link";
import { Suspense, use as reactUse } from "react";
import { CertificateSheet, PrintToolbar } from "@/components/certificate-sheet";
import { useStore } from "@/components/providers";
import { Button, LoadingBlock, SectionTitle } from "@/components/ui";

export default function CertificatePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl px-4 py-8"><LoadingBlock label="Preparing document…" /></div>
      }
    >
      <PrintContent params={params} />
    </Suspense>
  );
}

function PrintContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = reactUse(params);
  const { ready, certificates } = useStore();

  if (!ready) return <LoadingBlock label="Preparing document…" />;

  const cert = certificates.find(
    (c) => c.id.toUpperCase() === decodeURIComponent(id).toUpperCase()
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="print-hide">
        <SectionTitle
          title="Certificate preview & print"
          description="A print-optimised sheet carrying the certificate’s QR verification code."
          actions={
            <Link href={`/verify/${id}`}>
              <Button variant="ghost" size="sm">← Back</Button>
            </Link>
          }
        />
      </div>
      {cert ? (
        <>
          <PrintToolbar />
          <CertificateSheet cert={cert} />
          <p className="print-hide mt-6 text-center text-xs text-faint">
            If the QR area shows “Generating…”, wait a moment before printing so the code renders.
          </p>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-line bg-surface/50 px-6 py-12 text-center print-hide">
          <p className="text-sm text-ink">Certificate “{decodeURIComponent(id)}” is not in this browser’s registry.</p>
          <p className="mt-1 text-xs text-muted">
            Print/download requires the record to exist locally. Restore demo data from Settings, or issue it first.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Link href="/admin/issue"><Button size="sm">Issue a certificate</Button></Link>
            <Link href="/settings"><Button size="sm" variant="secondary">Settings</Button></Link>
          </div>
        </div>
      )}
    </div>
  );
}
