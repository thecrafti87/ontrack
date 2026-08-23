import type { Metadata } from "next";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "Konto erstellen" };

export default function Page() {
  return <RegisterForm />;
}
