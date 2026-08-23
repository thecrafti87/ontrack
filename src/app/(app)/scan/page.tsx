import type { Metadata } from "next";
import { ScanClient } from "./ScanClient";

export const metadata: Metadata = { title: "Scannen" };

export default function Page() {
  return <ScanClient />;
}
