"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { createFeedbackAction } from "@/app/(app)/feedback/actions";

const MAX_MESSAGE_LENGTH = 2000;

/**
 * Schwebender Feedback-Button (alle eingeloggten Rollen, auch HELFER).
 * Auf Mobil oberhalb der Bottom-Nav positioniert, auf Desktop unten rechts.
 */
export function FeedbackButton() {
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
      <button
        type="button"
        aria-label="Feedback zu dieser Seite geben"
        onClick={() => setOpen(true)}
        className="fixed z-40 right-4 bottom-24 md:right-6 md:bottom-6 flex items-center justify-center size-14 rounded-full bg-accent text-accent-fg shadow-lg shadow-black/40 text-2xl"
      >
        💬
      </button>

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
