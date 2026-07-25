"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";

const DEBOUNCE_MS = 3000;

type QrScannerProps = {
  /** Wird pro erkanntem Code aufgerufen (entprellt: derselbe Text max. 1x pro 3s). */
  onCode: (text: string) => void;
  className?: string;
};

/**
 * Wiederverwendbare Kamera-Scan-Komponente (ZXing Multi-Format-Reader: QR +
 * 1D-Barcodes wie EAN-8/13, Code 128, Code 39 …, Rückkamera-Präferenz,
 * Fehlerbehandlung, Entprellung). Kapselt alles Kamera-bezogene — Aufrufer
 * bekommt nur den rohen gescannten Text über onCode.
 */
export default function QrScanner({ onCode, className }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastCodeRef = useRef<{ text: string; at: number } | null>(null);
  const onCodeRef = useRef(onCode);
  const [cameraError, setCameraError] = useState(false);

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    let active = true;
    const codeReader = new BrowserMultiFormatReader();

    async function start() {
      if (!videoRef.current) return;
      try {
        const controls = await codeReader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          videoRef.current,
          (result) => {
            if (!active || !result) return;
            const text = result.getText();
            const now = Date.now();
            const last = lastCodeRef.current;
            if (last && last.text === text && now - last.at < DEBOUNCE_MS) return;
            lastCodeRef.current = { text, at: now };
            onCodeRef.current(text);
          }
        );

        if (!active) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
      } catch {
        if (active) setCameraError(true);
      }
    }

    start();

    return () => {
      active = false;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, []);

  return (
    <div className={className}>
      <div className="card overflow-hidden p-0 aspect-square relative bg-black">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
      </div>

      {cameraError && (
        <div className="card bg-red-500/10 border-red-500/30 mt-4">
          <p className="text-sm text-red-300">
            Kamera nicht verfügbar. Am Handy funktioniert die Kamera nur über HTTPS oder localhost —
            nutze die manuelle Eingabe.
          </p>
        </div>
      )}
    </div>
  );
}
