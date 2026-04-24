import { query } from "@/lib/db";
import { getTenantSession } from "@/lib/kyc/sdk/tenant-user-auth";
import { getTenantBranding } from "@/lib/kyc/sdk/branding";
import { SettingsForm } from "./SettingsForm";
import { BrandingForm } from "./BrandingForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TenantRow {
  id: string;
  name: string;
  default_webhook_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export default async function SettingsPage() {
  const session = (await getTenantSession())!;
  const [res, branding] = await Promise.all([
    query<TenantRow>(
      `SELECT id, name, default_webhook_url, created_at, updated_at
       FROM kyc_tenants WHERE id = $1 LIMIT 1`,
      [session.user.tenant_id],
    ),
    getTenantBranding(session.user.tenant_id),
  ]);
  const tenant = res.rows[0];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">Configuración</h1>
        <p className="text-white/50 text-sm mt-1">
          Webhook de notificaciones y rotación de tu API key.
        </p>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-lg p-5 space-y-2">
        <h3 className="text-xs text-white/50 uppercase tracking-wider">Tenant</h3>
        <div className="flex justify-between text-sm">
          <span className="text-white/50">ID</span>
          <code className="text-white/80">{tenant.id}</code>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-white/50">Nombre</span>
          <span className="text-white/80">{tenant.name}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-white/50">Creado</span>
          <span className="text-white/80">
            {new Date(tenant.created_at).toLocaleString("es-PE")}
          </span>
        </div>
      </div>

      <SettingsForm
        tenantId={tenant.id}
        initialWebhook={tenant.default_webhook_url ?? ""}
      />

      <BrandingForm initial={branding} />
    </div>
  );
}
