"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { createFeedbackAction } from "@/app/(app)/feedback/actions";

const MAX_MESSAGE_LENGTH = 2000;

/**
 * Feedback zur gerade geöffneten Seite (alle Rollen, auch Helfer).
 *
 * Vorher schwebte der Knopf auf jeder Seite über dem Inhalt, so auffällig
 * wie der Scan-Knopf, und verdeckte an mehreren Stellen Text. Jetzt ist er
 * ein unauffälliger Auslöser, den die Hülle dort platziert, wo er nicht
 * stört: am Desktop in der Kopfleiste, auf dem Handy unter „Mehr".
 *
 * `variant` bestimmt nur das Aussehen des Auslösers — der Dialog ist
 * derselbe, und er merkt sich weiterhin, von welcher Seite er geöffnet wurde.
 */
export function FeedbackButton({ variant = "icon" }: { variant?: "icon" | "row" }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setMessage("");
    setError(null);
    setSent(false);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createFeedbackAction(pathname, message);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setSent(true);
    });
  }

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          aria-label="Feedback zu dieser Seite geben"
          title="Feedback zu dieser Seite"
          onClick={() => setOpen(true)}
          className="flex items-center justify-center size-9 rounded-lg text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M17 12a2 2 0 0 1-2 2H7l-4 3V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="card flex items-center gap-4 min-h-16 hover:bg-surface-2 transition-colors w-full text-left"
        >
          <span className="text-muted">
            <svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M17 12a2 2 0 0 1-2 2H7l-4 3V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="font-medium text-lg">Feedback geben</span>
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={close}
        >
          <div className="card w-full max-w-md flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            {sent ? (
              <>
                <p className="text-emerald-400 font-semibold">Danke! Feedback gespeichert.</p>
                <button type="button" className="btn-secondary self-start" onClick={close}>
                  Schließen
                </button>
              </>
            ) : (
              <>
                <h2 className="font-semibold">Feedback zu dieser Seite</h2>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  rows={4}
                  maxLength={MAX_MESSAGE_LENGTH}
                  placeholder="Was sollen wir ändern?"
                  className="input min-h-28 py-3"
                  autoFocus
                />
                <p className="text-xs text-muted">Seite {pathname} wird mitgeschickt</p>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <div className="flex justify-end gap-2">
                  <button type="button" className="btn-secondary" onClick={close}>
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    disabled={pending || !message.trim()}
                    onClick={submit}
                    className="btn-primary"
                  >
                    {pending ? "Wird gesendet…" : "Senden"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
