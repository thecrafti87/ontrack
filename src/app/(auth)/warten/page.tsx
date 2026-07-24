import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { logoutAction } from "../actions";

export default async function WartenPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.approved) redirect("/");

  return (
    <div className="card text-center">
      <h2 className="text-xl font-semibold mb-3">Fast geschafft</h2>
      <p className="text-muted mb-6">
        Dein Konto wartet auf Freischaltung durch den Admin.
      </p>
      <form action={logoutAction}>
        <button type="submit" className="btn-secondary w-full">
          Abmelden
        </button>
      </form>
    </div>
  );
}
