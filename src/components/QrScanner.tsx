"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";

const DEBOUNCE_MS = 3000;
// Wenn nach dieser Zeit kein Videobild ankommt, stimmt etwas — sichtbar machen
const WATCHDOG_MS = 5000;

type QrScannerProps = {
  /** Wird pro erkanntem Code aufgerufen (entprellt: derselbe Text max. 1x pro 3s). */
  onCode: (text: string) => void;
  className?: string;
};

type CameraState =
  | { phase: "starting" }
  | { phase: "running" }
  | { phase: "black"; detail: string } // Stream läuft, aber es kommt kein Bild an
  | { phase: "hang" } // Kamera-Anfrage wird von iOS weder beantwortet noch abgelehnt
  | { phase: "insecure"; host: string } // ohne HTTPS gibt kein Browser die Kamera frei
  | { phase: "error"; detail: string };

/**
 * Wiederverwendbare Kamera-Scan-Komponente (ZXing Multi-Format-Reader: QR +
 * 1D-Barcodes, Rückkamera-Präferenz, Entprellung). Zeigt ihren Zustand
 * direkt auf der Videofläche an (Start/Fehler/kein Bild) und bietet einen
 * Neustart-Knopf — wichtig für die Fern-Diagnose auf fremden Geräten.
 */
export default function QrScanner({ onCode, className }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastCodeRef = useRef<{ text: string; at: number } | null>(null);
  const onCodeRef = useRef(onCode);
  const [state, setState] = useState<CameraState>({ phase: "starting" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    let active = true;
    const codeReader = new BrowserMultiFormatReader();
    let watchdog: ReturnType<typeof setInterval> | null = null;

    async function start() {
      const video = videoRef.current;
      if (!video) return;
      setState({ phase: "starting" });
      try {
        // Ohne sicheren Kontext (HTTPS oder localhost) gibt kein Browser die
        // Kamera frei — weder iOS noch Android. Das vorher zu erkennen ist
        // wichtig, weil die Ursache sonst als Berechtigungsproblem erscheint
        // und man am falschen Ende sucht.
        if (!window.isSecureContext) {
          setState({ phase: "insecure", host: window.location.host });
          return;
        }
        if (!navigator.mediaDevices?.getUserMedia) {
          setState({ phase: "error", detail: "getUserMedia steht nicht zur Verfügung." });
          return;
        }
        // Eine einzige Kamera-Anfrage mit Zeitschaltung: hängt iOS sie auf,
        // machen wir das sichtbar statt ewig zu warten
        const stream = await Promise.race([
          navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("__HANG__")), 8000)
          ),
        ]);
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const controls = await codeReader.decodeFromStream(
          stream,
          video,
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
        // iOS Safari: play() kann trotz Stream abgelehnt werden (z. B. Stromsparmodus)
        await video.play().catch(() => undefined);

        // Wachhund: erst wenn echte Bilddaten ankommen, gilt die Kamera als läuft
        const startedAt = Date.now();
        watchdog = setInterval(() => {
          if (!active) return;
          if (video.videoWidth > 0 && !video.paused) {
            setState({ phase: "running" });
            if (watchdog) clearInterval(watchdog);
          } else if (Date.now() - startedAt > WATCHDOG_MS) {
            // Track-Zustand offenlegen: muted=true heißt, iOS liefert keine
            // Bilder — typisch, wenn ein anderer Prozess die Kamera hält
            const t = stream.getVideoTracks()[0];
            const detail = t
              ? `Track: ${t.readyState}, muted=${t.muted}, enabled=${t.enabled}`
              : "Kein Video-Track";
            setState((prev) =>
              prev.phase === "running" ? prev : { phase: "black", detail }
            );
            // Weiter beobachten: kommen doch noch Bilder, schalten wir um
          }
        }, 300);
      } catch (err) {
        if (!active) return;
        if (err instanceof Error && err.message === "__HANG__") {
          setState({ phase: "hang" });
        } else {
          setState({
            phase: "error",
            detail: err instanceof Error ? `${err.name}: ${err.message}` : "Unbekannter Fehler",
          });
        }
      }
    }

    // Verzögerter Start: verhindert doppeltes Kamera-Öffnen durch Reacts
    // Strict-Mode-Doppelmount (iOS liefert sonst gern ein schwarzes Bild)
    const startTimer = setTimeout(start, 150);

    return () => {
      active = false;
      clearTimeout(startTimer);
      if (watchdog) clearInterval(watchdog);
      controlsRef.current?.stop();
      controlsRef.current = null;
      // Kamera-Stream sicher freigeben (iOS hält ihn sonst teils fest)
      const video = videoRef.current;
      const stream = video?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((t) => t.stop());
      if (video) video.srcObject = null;
    };
  }, [attempt]);

  const showOverlay = state.phase !== "running";
  // Endgültiger Fehler (kein Zugriff/kein HTTPS): kompakte Karte statt großer
  // schwarzer Videofläche — die Fläche bleibt aber (versteckt) im DOM, damit
  // "Kamera erneut starten" das Video-Element wiederfindet.
  const cameraFailed = state.phase === "error" || state.phase === "insecure";

  return (
    <div className={className}>
      <div
        className={
          cameraFailed ? "hidden" : "card overflow-hidden p-0 aspect-square relative bg-black"
        }
      >
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />

        {showOverlay && !cameraFailed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 p-6 text-center">
            {state.phase === "starting" && (
              <p className="text-sm text-muted">Kamera wird gestartet …</p>
            )}
            {state.phase === "black" && (
              <>
                <p className="text-sm text-foreground font-semibold">
                  Kamera läuft, liefert aber kein Bild.
                </p>
                <p className="text-xs text-muted">
                  Vermutlich hält ein anderer Tab oder eine andere App die Kamera fest.
                  Alle Safari-Tabs mit dieser Seite schließen, Safari beenden, neu öffnen —
                  notfalls iPhone neu starten.
                </p>
                <p className="text-xs text-red-300/80 font-mono break-all">{state.detail}</p>
              </>
            )}
            {state.phase === "hang" && (
              <>
                <p className="text-sm text-foreground font-semibold">
                  Die Kamera-Anfrage hängt — iOS antwortet nicht.
                </p>
                <p className="text-xs text-muted">
                  Safari komplett beenden (App-Umschalter → wegwischen) und neu öffnen.
                  Hilft das nicht: iPhone neu starten.
                </p>
              </>
            )}
            {state.phase !== "starting" && (
              <button
                type="button"
                className="btn-secondary mt-1"
                onClick={() => setAttempt((a) => a + 1)}
              >
                Kamera erneut starten
              </button>
            )}
          </div>
        )}
      </div>

      {state.phase === "insecure" && (
        <div className="card bg-amber-500/10 border-amber-500/30">
          <h2 className="font-semibold text-amber-300 mb-1">
            Kamera braucht eine gesicherte Verbindung
          </h2>
          <p className="text-sm text-amber-200/90">
            Diese Seite läuft über <span className="font-mono">http://{state.host}</span>.
            Browser geben die Kamera nur über <strong>HTTPS</strong> frei (oder direkt auf
            dem Gerät selbst) — das gilt für iPhone und Android gleichermaßen. Es liegt
            also nicht an einer fehlenden Berechtigung.
          </p>
          <p className="text-sm text-amber-200/90 mt-2">
            Für den Kamera-Scan am Handy braucht OnTrack einen Server mit HTTPS. Bis
            dahin: Nummer unten von Hand eintippen.
          </p>
        </div>
      )}

      {state.phase === "error" && (
        <div className="card bg-red-500/10 border-red-500/30">
          <h2 className="font-semibold text-red-300 mb-1">Kamera nicht verfügbar</h2>
          <p className="text-sm text-red-300">
            Kamera-Zugriff erlauben: iPhone-Einstellungen → Apps → Safari → Kamera → „Fragen“
            oder „Erlauben“. Android: Adressleiste → Schloss-Symbol → Berechtigungen.
            Oder nutze die manuelle Eingabe.
          </p>
          <p className="text-xs text-red-300/70 font-mono break-all mt-2">{state.detail}</p>
          <button
            type="button"
            className="btn-secondary mt-3"
            onClick={() => setAttempt((a) => a + 1)}
          >
            Kamera erneut starten
          </button>
        </div>
      )}
    </div>
  );
}
