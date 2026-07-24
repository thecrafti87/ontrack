import { redirect } from "next/navigation";
import { requireUser, canEdit } from "@/lib/auth";
import { ImportClient } from "./ImportClient";

export default async function ImportPage() {
  const user = await requireUser();
  if (!canEdit(user)) redirect("/");

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-bold">CSV-Import</h1>
      <p className="text-sm text-muted">
        Geräte aus CSV-Exporten anderer Software importieren (z. B. Vectorworks Spotlight,
        Eventworx, Excel).
      </p>
      <ImportClient />
    </div>
  );
}
