import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/constants";
import { ResolveFeedbackButton } from "./ResolveFeedbackButton";

export const metadata: Metadata = { title: "Feedback" };

function PageRef({ page }: { page: string }) {
  if (page.startsWith("/")) {
    return (
      <Link href={page} className="text-accent hover:underline">
        {page}
      </Link>
    );
  }
  return <span>{page}</span>;
}

export default async function FeedbackPage() {
  await requireRole("ADMIN");

  const [open, resolved] = await Promise.all([
    prisma.feedback.findMany({
      where: { status: "OFFEN" },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.feedback.findMany({
      where: { status: "ERLEDIGT" },
      include: { user: true },
      orderBy: { resolvedAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Feedback</h1>

      <div className="card flex flex-col gap-4">
        <h2 className="font-semibold">Offen ({open.length})</h2>
        {open.length === 0 ? (
          <p className="text-sm text-muted">Kein offenes Feedback.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {open.map((f) => (
              <li key={f.id} className="rounded-xl border border-line p-3 flex flex-col gap-2">
                <p className="whitespace-pre-wrap text-sm">{f.message}</p>
                <p className="text-xs text-muted">
                  {f.user?.name ?? "Unbekannt"} · <PageRef page={f.page} /> · {formatDateTime(f.createdAt)}
                </p>
                <ResolveFeedbackButton feedbackId={f.id} resolved={false} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <details className="card">
        <summary className="cursor-pointer select-none font-semibold">Erledigt ({resolved.length})</summary>
        {resolved.length === 0 ? (
          <p className="text-sm text-muted mt-3">Noch nichts erledigt.</p>
        ) : (
          <ul className="flex flex-col gap-3 mt-4">
            {resolved.map((f) => (
              <li key={f.id} className="rounded-xl border border-line p-3 flex flex-col gap-2">
                <p className="whitespace-pre-wrap text-sm text-muted">{f.message}</p>
                <p className="text-xs text-muted">
                  {f.user?.name ?? "Unbekannt"} · <PageRef page={f.page} /> · {formatDateTime(f.createdAt)}
                  {f.resolvedAt && <> · erledigt {formatDateTime(f.resolvedAt)}</>}
                </p>
                <ResolveFeedbackButton feedbackId={f.id} resolved={true} />
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}
