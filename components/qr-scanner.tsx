"use client";

/**
 * Camera-based scanning using the native BarcodeDetector API (available in
 * Chromium browsers, our primary target). Everything degrades gracefully:
 * no camera, no permission, or unsupported browser yields a clear message
 * and the manual entry fallback. Streams are always stopped on unmount.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff } from "lucide-react";
import { Button, Card } from "./ui";

type ScanState =
  | { kind: "idle" }
  | { kind: "unsupported" }
  | { kind: "starting" }
  | { kind: "scanning" }
  | { kind: "denied" }
  | { kind: "error"; message: string };

export function QRScanner({
  onScanned,
}: {
  onScanned: (rawValue: string) => void;
}) {
  const [state, setState] = useState<ScanState>({ kind: "idle" });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Always release the camera when the scanner unmounts.
  useEffect(() => stopCamera, [stopCamera]);

  async function startScanning() {
    setState({ kind: "starting" });
    const supported =
      typeof window !== "undefined" && "BarcodeDetector" in window;
    if (!supported) {
      setState({ kind: "unsupported" });
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setState({ kind: "unsupported" });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detector = new (window as any).BarcodeDetector({
        formats: ["qr_code"],
      });
      setState({ kind: "scanning" });

      // Poll a few times per second; stop on first successful read.
      const tick = async () => {
        if (!streamRef.current) return;
        try {
          const codes = await detector.detect(video);
          if (codes && codes.length > 0) {
            const raw = String(codes[0].rawValue ?? "");
            stopCamera();
            setState({ kind: "idle" });
            if (raw) onScanned(raw);
            return;
          }
        } catch {
          /* transient decode errors are expected frames */
        }
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = window.setTimeout(tick, 150);
        });
      };
      tick();
    } catch (error) {
      const name = (error as { name?: string }).name;
      if (name === "NotAllowedError") {
        setState({ kind: "denied" });
      } else {
        setState({
          kind: "error",
          message: name === "NotFoundError" ? "No camera was found on this device." : "The camera could not be started.",
        });
      }
    }
  }

  function stop() {
    stopCamera();
    setState({ kind: "idle" });
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Scan a QR code</h2>
        {state.kind === "scanning" ? (
          <Button size="sm" variant="danger" onClick={stop}>
            <CameraOff className="h-4 w-4" /> Stop camera
          </Button>
        ) : null}
      </div>

      {state.kind === "scanning" ? (
        <video
          ref={videoRef}
          muted
          playsInline
          aria-label="Camera view — point at a certificate QR code"
          className="aspect-video w-full rounded-lg border border-line object-cover"
        />
      ) : (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-line bg-night-2 px-4 py-8 text-center">
          <Camera className="mb-2 h-6 w-6 text-faint" aria-hidden="true" />
          <p className="text-xs text-muted">
            {state.kind === "idle" || state.kind === "starting"
              ? "Camera scanning uses your browser’s built-in detection, in-page only."
              : state.kind === "unsupported"
                ? "This browser has no on-page QR detector available (native detection needs Chromium). Manual entry below works everywhere."
                : state.kind === "denied"
                  ? "Camera access was denied. You can still enter the certificate ID or paste the verification link manually."
                  : (state.kind === "error" ? state.message : "")}
          </p>
          {state.kind === "idle" || state.kind === "starting" ? (
            <Button size="sm" className="mt-3" onClick={startScanning} loading={state.kind === "starting"}>
              <Camera className="h-4 w-4" /> Start camera
            </Button>
          ) : null}
        </div>
      )}
      <p className="mt-3 text-[11px] text-faint">
        Manual entry remains available below at all times — scanning is
        intentionally optional in this MVP.
      </p>
    </Card>
  );
}
