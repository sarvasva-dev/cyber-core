"use client";

/**
 * QR code rendering + download, built on the lightweight `qrcode` package
 * (pure JS, no network). The component recomputes the PNG data URL whenever
 * the target URL changes; `downloadQr` saves it as a .png file locally.
 */

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { cn } from "@/lib/format";
import { LoadingSpinner } from "./ui";

export function QRCodeImage({
  value,
  size = 168,
  className,
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // (No synchronous reset here — the previous QR stays visible while the
    // new one resolves, avoiding cascading renders.)
    QRCode.toDataURL(value, {
      width: size * 2, // render at 2x for crisp scaling
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0b1428", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (failed) {
    return (
      <div
        style={{ width: size, height: size }}
        className={cn("flex items-center justify-center rounded-lg border border-dashed border-line bg-surface p-2 text-center text-xs text-muted", className)}
      >
        QR unavailable
      </div>
    );
  }

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className={cn("flex items-center justify-center rounded-lg border border-line bg-white/5", className)}
        aria-label="Generating QR code"
      >
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt={`QR code linking to ${value}`}
      width={size}
      height={size}
      className={cn("rounded-lg border border-line bg-white", className)}
    />
  );
}

/** Generate + download the QR as a PNG file (browser-local). */
export async function downloadQrPng(value: string, fileName: string): Promise<void> {
  const url = await QRCode.toDataURL(value, {
    width: 512,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#0b1428", light: "#ffffff" },
  });
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName.endsWith(".png") ? fileName : `${fileName}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
