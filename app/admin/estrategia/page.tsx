import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import AdminNav from "../AdminNav";
import StrategyClient from "./StrategyClient";

export const metadata: Metadata = {
  title: "Estrategia | Admin FLUX",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function EstrategiaPage() {
  const session = await requireAdmin();
  if (!session) redirect("/");

  return (
    <div className="min-h-screen bg-[#0A0A14]">
      <div className="bg-white">
        <AdminNav />
      </div>
      <StrategyClient />
    </div>
  );
}
