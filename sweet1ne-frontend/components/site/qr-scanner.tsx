"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, X } from "lucide-react";

type ScannerState =
  | "idle"
  | "requesting"   // waiting on the permission prompt
  | "scanning"
  | "denied"       // they said no
  | "unsupported"; // BarcodeDetector missing — iOS Safari, mostly

/**
 * Reads a table's QR code using the browser's own barcode detector.
 *
 * BarcodeDetector is native in Chrome and Android but absent in Safari, so
 * the component reports "unsupported" rather than failing — the page then
 * shows the manual instruction instead, which works everywhere.
 */
export function QrScanner({
  onDetected,
  onClose,
}: {
  onDetected: (value: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);

  const [state, setState] = useState<ScannerState>("idle");
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    // Releasing every track is what actually turns the camera light off.
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (!("BarcodeDetector" in window)) {
      setState("unsupported");
      return;
    }

    setState("requesting");
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // The rear camera — someone scanning a table is pointing away from
        // themselves.
        video: { facingMode: "environment" },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setState("scanning");

      const detector = new (window as any).BarcodeDetector({
        formats: ["qr_code"],
      });

      // Poll each frame rather than on a timer — it stays in step with the
      // video and pauses automatically when the tab is hidden.
      const scan = async () => {
        if (!videoRef.current || videoRef.current.readyState !== 4) {
          frameRef.current = requestAnimationFrame(scan);
          return;
        }

        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0 && codes[0].rawValue) {
            stop();
            onDetected(codes[0].rawValue);
            return;
          }
        } catch {
          // A single failed frame isn't worth stopping for.
        }

        frameRef.current = requestAnimationFrame(scan);
      };

      frameRef.current = requestAnimationFrame(scan);
    } catch (err) {
      stop();

      const denied =
        err instanceof DOMException &&
        (err.name === "NotAllowedError" || err.name === "PermissionDeniedError");

      if (denied) {
        setState("denied");
      } else {
        setState("idle");
        setError("We couldn't open the camera. Try scanning with your camera app instead.");
      }
    }
  }, [onDetected, stop]);

  // Start on mount, and always release the camera on the way out.
  useEffect(() => {
    start();
    return stop;
  }, [start, stop]);

  return (
    <div className="fixed inset-0 z-[95] bg-black">
      <button
        onClick={() => {
          stop();
          onClose();
        }}
        aria-label="Close scanner"
        className="absolute right-4 top-4 z-10 flex h-12 w-12 items-center justify-center bg-black/50 text-white backdrop-blur"
        style={{ borderRadius: "4px" }}
      >
        <X size={22} strokeWidth={1} />
      </button>

      {state === "scanning" || state === "requesting" ? (
        <>
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full object-cover"
          />

          {/* Framing guide — four corners rather than a full box, so the
              code stays visible while they line it up. */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-64 w-64">
              {[
                "left-0 top-0 border-l-2 border-t-2",
                "right-0 top-0 border-r-2 border-t-2",
                "left-0 bottom-0 border-l-2 border-b-2",
                "right-0 bottom-0 border-r-2 border-b-2",
              ].map((position) => (
                <span
                  key={position}
                  className={`absolute h-10 w-10 border-[var(--gold)] ${position}`}
                />
              ))}
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black to-transparent p-8 pb-16 text-center">
            <p className="label-caps text-[var(--gold)]">
              {state === "requesting" ? "Opening camera" : "Scanning"}
            </p>
            <p className="mt-3 text-lg text-white">
              Point at the code on your table
            </p>
          </div>
        </>
      ) : (
        <div className="flex h-full items-center justify-center p-8">
          <div className="max-w-sm text-center">
            {state === "denied" ? (
              <>
                <CameraOff
                  size={32}
                  strokeWidth={1}
                  className="mx-auto text-[var(--gold)]"
                />
                <h3 className="mt-6 font-display text-2xl text-white">
                  Camera's blocked
                </h3>
                <p className="mt-3 leading-relaxed text-[var(--ivory-dim)]">
                  No problem — open your phone's camera app and point it at the
                  code on your table instead. It'll do the same thing.
                </p>
              </>
            ) : (
              <>
                <Camera size={32} strokeWidth={1} className="mx-auto text-[var(--gold)]" />
                <h3 className="mt-6 font-display text-2xl text-white">
                  {error ? "Something went wrong" : "Starting camera"}
                </h3>
                {error && (
                  <p className="mt-3 leading-relaxed text-[var(--ivory-dim)]">{error}</p>
                )}
              </>
            )}

            <button
              onClick={() => {
                stop();
                onClose();
              }}
              className="mt-8 border border-white/30 px-6 py-3 text-sm text-white"
              style={{ borderRadius: "4px" }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Whether the in-page scanner will work at all — used to decide between
 *  offering it and showing the manual instruction. */
export function scannerSupported() {
  return (
    typeof window !== "undefined" &&
    "BarcodeDetector" in window &&
    "mediaDevices" in navigator
  );
}