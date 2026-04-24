import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/kyc/sdk/tenant-user-auth";
import { LoginForm } from "./LoginForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TenantLoginPage() {
  const existing = await getTenantSession();
  if (existing) {
    redirect("/tenant");
  }

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-white/60 text-xs tracking-[0.3em] uppercase mb-3">
            Flux KYC
          </div>
          <h1 className="text-2xl font-semibold text-white">
            Dashboard del cliente
          </h1>
          <p className="text-white/50 text-sm mt-2">
            Accedé a tus verificaciones, analytics y configuración.
          </p>
        </div>
        <LoginForm />
        <p className="text-white/40 text-xs text-center mt-6">
          ¿Necesitás una cuenta? Contactá a tu AE de Flux.
        </p>
      </div>
    </main>
  );
}
