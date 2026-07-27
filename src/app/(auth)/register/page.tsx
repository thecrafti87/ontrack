"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction } from "../actions";

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(registerAction, undefined);

  return (
    <main className="card">
      <h2 className="text-xl font-semibold mb-4">Konto erstellen</h2>
      <form action={formAction} className="flex flex-col gap-4">
        <div>
          <label htmlFor="name" className="label">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            className="input"
            placeholder="Max Mustermann"
          />
        </div>
        <div>
          <label htmlFor="email" className="label">
            E-Mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="input"
            placeholder="name@firma.de"
          />
        </div>
        <div>
          <label htmlFor="password" className="label">
            Passwort
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            className="input"
            placeholder="mind. 8 Zeichen"
          />
        </div>
        <div>
          <label htmlFor="passwordRepeat" className="label">
            Passwort wiederholen
          </label>
          <input
            id="passwordRepeat"
            name="passwordRepeat"
            type="password"
            autoComplete="new-password"
            required
            className="input"
            placeholder="••••••••"
          />
        </div>

        {state?.error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
            {state.error}
          </p>
        )}

        <p className="text-sm text-muted">
          Nach der Registrierung muss dein Konto vom Admin freigeschaltet werden.
        </p>

        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? "Wird erstellt…" : "Konto erstellen"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Schon ein Konto?{" "}
        <Link href="/login" className="text-accent font-medium">
          Anmelden
        </Link>
      </p>
    </main>
  );
}
