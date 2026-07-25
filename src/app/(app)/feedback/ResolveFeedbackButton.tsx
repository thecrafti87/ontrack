"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolveFeedbackAction } from "./actions";

export function ResolveFeedbackButton({ feedbackId, resolved }: { feedbackId: string; resolved: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      await resolveFeedbackAction(feedbackId, !resolved);
      router.refresh();
    });
  }

  return (
    <button type="button" disabled={pending} onClick={run} className="btn-secondary self-start">
      {pending ? "…" : resolved ? "Wieder öffnen" : "Erledigt"}
    </button>
  );
}
