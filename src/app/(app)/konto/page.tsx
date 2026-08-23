import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { ChangePasswordForm } from "./PasswordForm";

export const metadata: Metadata = { title: "Mein Konto" };

export default async function KontoPage() {
  const user = await requireUser();

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Mein Konto</h1>

      <div className="card">
        <h2 className="font-semibold mb-3">Angaben</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div className="flex justify-between sm:block">
            <dt className="text-muted">Name</dt>
            <dd>{user.name}</dd>
          </div>
          <div className="flex justify-between sm:block">
            <dt className="text-muted">E-Mail</dt>
            <dd className="break-all">{user.email}</dd>
          </div>
          <div className="flex justify-between sm:block">
            <dt className="text-muted">Rolle</dt>
            <dd>{ROLES[user.role].label}</dd>
          </div>
        </dl>
        <p className="text-xs text-muted mt-4">
          Name, E-Mail und Rolle ändert ein Admin unter „Benutzer“.
        </p>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-1">Passwort ändern</h2>
        <p className="text-sm text-muted mb-4">
          Nach der Änderung werden alle anderen Geräte abgemeldet. Dieses Gerät
          bleibt angemeldet.
        </p>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
