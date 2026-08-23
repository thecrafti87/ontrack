"use client";

import { useActionState, useRef } from "react";
import { changeOwnPasswordAction, type ActionState } from "./actions";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    changeOwnPasswordAction,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={formAction}
      key={state?.success ?? "form"}
      className="flex flex-col gap-4"
    >
      <div>
        <label className="label" htmlFor="pw-current">
          Aktuelles Passwort
        </label>
        <input
          id="pw-current"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          className="input"
          required
        />
      </div>

      <div>
        <label className="label" htmlFor="pw-new">
          Neues Passwort
        </label>
        <input
          id="pw-new"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          className="input"
          placeholder="mind. 8 Zeichen"
          required
        />
      </div>

      <div>
        <label className="label" htmlFor="pw-repeat">
          Neues Passwort wiederholen
        </label>
        <input
          id="pw-repeat"
          name="newPasswordRepeat"
          type="password"
          autoComplete="new-password"
          minLength={8}
          className="input"
          required
        />
      </div>

      {state?.error && (
        <p className="text-sm text-red-400" role="alert">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="text-sm text-emerald-400" role="status">
          {state.success}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-primary md:self-start">
        {pending ? "Wird geändert…" : "Passwort ändern"}
      </button>
    </form>
  );
}
