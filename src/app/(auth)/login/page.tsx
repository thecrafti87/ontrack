"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction } from "../actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <div className="card">
      <h2 className="text-xl font-semibold mb-4">Anmelden</h2>
      <form action={formAction} className="flex flex-col gap-4">
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
            autoComplete="current-password"
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

        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? "Anmelden…" : "Anmelden"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Noch kein Konto?{" "}
        <Link href="/register" className="text-accent font-medium">
          Registrieren
        </Link>
      </p>
    </div>
  );
}
