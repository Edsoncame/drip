import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import AdminNav from "../AdminNav";
import AgentsScene from "./AgentsScene";

export const metadata: Metadata = {
  title: "Agentes de Marketing | Admin FLUX",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AgentesPage() {
  const session = await requireAdmin();
  if (!session) redirect("/");

  return (
    <div className="min-h-screen bg-[#0A0A14]">
      <div className="bg-white">
        <AdminNav />
      </div>
      <AgentsScene />
    </div>
  );
}
