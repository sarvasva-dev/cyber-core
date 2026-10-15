"use client";

/**
 * Admin certificate detail view. All data comes from the local registry;
 * unknown IDs show a not-found state with safe actions.
 */

import Link from "next/link";
import { use as reactUse, useMemo, useState } from "react";
import {
  ArrowLeft,
  Download,
  FileWarning,
  Printer,
  QrCode,
  RotateCcw,
  ShieldOff,
  ShieldCheck,
} from "lucide-react";
import { QRCodeImage, downloadQrPng } from "@/components/qr";
import { useStore, useToast } from "@/components/providers";
import {
  Badge,
  Button,
  Card,
  CopyButton,
  EmptyState,
  FingerprintText,
  LoadingBlock,
  Modal,
  SectionTitle,
  StatusBadge,
} from "@/components/ui";
import { verificationUrl, formatDate, formatDateTime } from "@/lib/format";

export default function AdminCertificateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = reactUse(params);
  const { ready, certificates, logs, profile, revoke, unRevoke } = useStore();
  const toast = useToast();
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);

  const cert = useMemo(
    () => certificates.find((c) => c.id.toUpperCase() === id.toUpperCase()),
    [certificates, id]
  );
  const certLogs = useMemo(
    () => logs.filter((l) => l.certificateId?.toUpperCase() === id.toUpperCase()),
    [logs, id]
  );

  if (!ready) return <LoadingBlock label="Loading certificate…" />;

  if (!cert) {
    return (
      <div className="space-y-6">
        <SectionTitle title="Certificate not found" />
        <EmptyState
          icon={<FileWarning className="h-8 w-8" />}
          title={`No record for ${id}`}
          description="The ID may contain a typo, or this certificate was issued in another browser. This registry lives in LocalStorage of one browser only."
          actions={
            <>
              <Link href="/admin/certificates"><Button size="sm">Back to registry</Button></Link>
              <Link href="/verify"><Button size="sm" variant="secondary">Verify instead</Button></Link>
            </>
          }
        />
      </div>
    );
  }

  const url = verificationUrl(cert.id);
  const actor = profile ? `${profile.name} (demo)` : "Registrar (demo)";

  async function exportOne() {
    try {
      const data = JSON.stringify(cert, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${cert?.id}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      toast({ title: "Export failed", variant: "error" });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/certificates" className="inline-flex items-center gap-1 text-xs text-faint hover:text-muted">
          <ArrowLeft className="h-3.5 w-3.5" /> Registry
        </Link>
      </div>
      <SectionTitle
        title={`${cert.id}`}
        description={cert.course}
        actions={
          <>
            <StatusBadge status={cert.status} />
            <CopyButton value={cert.id} label="Copy ID" />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 text-sm font-semibold text-ink">Credential details</h2>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              {[
                ["Student", cert.studentName],
                ["Student email", cert.studentEmail ?? "—"],
                ["Course / degree", cert.course],
                ["Institution", cert.institution],
                ["Department", cert.department ?? "—"],
                ["Registration no.", cert.registrationNumber ?? "—"],
                ["Grade", cert.grade ?? "—"],
                ["Issue date", formatDate(cert.issueDate)],
                ["Expiry date", cert.expiryDate ? formatDate(cert.expiryDate) : "Lifetime"],
                ["Issuer", cert.issuerName],
              ].map(([term, value]) => (
                <div key={term as string}>
                  <dt className="text-xs text-faint">{term}</dt>
                  <dd className="mt-0.5 text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            {cert.notes ? (
              <p className="mt-4 rounded-lg border border-line-soft bg-night-2 p-3 text-xs text-muted">
                {cert.notes}
              </p>
            ) : null}
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-ink">Cryptographic fingerprint</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              SHA-256 over the canonical JSON of the metadata above (Web Crypto).
              Lifecycle fields — issued/release time, status, revocation — are
              excluded from the hash by design.
            </p>
            <div className="mt-3"><FingerprintText value={cert.fingerprint} /></div>
            {cert.documentSha256 ? (
              <div className="mt-4 border-t border-line-soft pt-4">
                <p className="text-xs font-medium text-muted">
                  Original document fingerprint <span className="text-faint">(raw bytes of {cert.documentName ?? "the file"}, separate hash domain)</span>
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <code className="break-all rounded-md border border-line-soft bg-night-2 px-2 py-1 font-mono text-xs text-aqua">
                    {cert.documentSha256}
                  </code>
                  <CopyButton value={cert.documentSha256} label="Copy file fingerprint" />
                </div>
              </div>
            ) : null}
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-ink">Lifecycle</h2>
            <ol className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-good" aria-hidden="true" />
                <div>
                  <p className="text-ink">Issued {formatDateTime(cert.issuedAt)}</p>
                  <p className="text-xs text-faint">by {cert.issuedBy ?? "registry"}</p>
                </div>
              </li>
              {cert.status === "revoked" ? (
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-bad" aria-hidden="true" />
                  <div>
                    <p className="text-ink">Revoked {cert.revokedAt ? formatDateTime(cert.revokedAt) : ""}</p>
                    <p className="text-xs text-faint">by {cert.revokedBy ?? "—"}</p>
                  </div>
                </li>
              ) : null}
              {certLogs.slice(0, 4).map((log) => (
                <li key={log.id} className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-faint" aria-hidden="true" />
                  <div>
                    <p className="text-ink">
                      {log.method} check · {formatDateTime(log.timestamp)}
                    </p>
                    <p className="text-xs text-faint">{log.result}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="flex flex-col items-center text-center">
            <QRCodeImage value={url} size={150} />
            <p className="mt-3 break-all text-[11px] text-faint">{url}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              <CopyButton value={url} label="Copy link" />
              <Button size="sm" variant="secondary" onClick={() => cert && downloadQrPng(url, `${cert.id}-qr`)}>
                <QrCode className="h-3.5 w-3.5" /> PNG
              </Button>
            </div>
          </Card>

          <Card className="space-y-2">
            <Link href={`/verify/${cert.id}`} className="block">
              <Button className="w-full" size="md"><ShieldCheck className="h-4 w-4" /> Open verification</Button>
            </Link>
            <Link href={`/certificates/${cert.id}/print`} className="block">
              <Button className="w-full" variant="secondary" size="md">
                <Printer className="h-4 w-4" /> Print / certificate
              </Button>
            </Link>
            <Button className="w-full" variant="secondary" size="md" onClick={exportOne}>
              <Download className="h-4 w-4" /> Export record JSON
            </Button>
            {cert.status === "active" ? (
              <Button className="w-full" variant="danger" size="md" onClick={() => setConfirmRevoke(true)}>
                <ShieldOff className="h-4 w-4" /> Revoke
              </Button>
            ) : (
              <Button className="w-full" variant="secondary" size="md" onClick={() => setConfirmRestore(true)}>
                <RotateCcw className="h-4 w-4" /> Un-revoke (demo undo)
              </Button>
            )}
          </Card>
        </div>
      </div>

      <Modal
        open={confirmRevoke}
        onClose={() => setConfirmRevoke(false)}
        title={`Revoke ${cert.id}?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmRevoke(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                const result = revoke(cert.id, actor);
                setConfirmRevoke(false);
                if (result.ok) toast({ title: "Certificate revoked", description: `${cert.id} must no longer be treated as valid.`, variant: "success" });
                else toast({ title: "Revocation failed", description: result.error, variant: "error" });
              }}
            >
              <ShieldOff className="h-4 w-4" /> Revoke certificate
            </Button>
          </>
        }
      >
        <p>
          Later verifications will return <strong>REVOKED</strong> — even if a
          supplied fingerprint still matches. The fingerprint and metadata are
          preserved.
        </p>
        <p className="mt-2 text-xs text-faint">Local demo action · performed by {actor}.</p>
      </Modal>

      <Modal
        open={confirmRestore}
        onClose={() => setConfirmRestore(false)}
        title="Un-revoke this certificate?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmRestore(false)}>Cancel</Button>
            <Button
              onClick={() => {
                const result = unRevoke(cert.id);
                setConfirmRestore(false);
                if (result.ok) toast({ title: "Certificate re-activated", variant: "success" });
                else toast({ title: "Undo failed", description: result.error, variant: "error" });
              }}
            >
              <RotateCcw className="h-4 w-4" /> Re-activate
            </Button>
          </>
        }
      >
        <p>
          Re-activates the local demo record (useful when repeating the
          walkthrough). The revocation history in the verification log remains.
        </p>
      </Modal>
    </div>
  );
}
