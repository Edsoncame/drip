import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import type { Metadata } from "next";
import AdminNav from "../AdminNav";
import ApiKeysManager from "./ApiKeysManager";

export const metadata: Metadata = { title: "API Keys | Admin FLUX", robots: { index: false, follow: false } };

export interface ApiKeyItem {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  key_prefix: string;
  name: string;
  scopes: string[];
  rate_limit: number;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  usage_count: string;
}

export interface UserLite {
  id: string;
  name: string;
  email: string;
  company: string | null;
}

export default async function AdminApiKeysPage() {
  const session = await requireAdmin();
  if (!session) redirect("/");

  const [keysRes, usersRes] = await Promise.all([
    query<ApiKeyItem>(
      `SELECT k.id, k.user_id, u.name AS user_name, u.email AS user_email,
              k.key_prefix, k.name, k.scopes, k.rate_limit,
              k.last_used_at, k.expires_at, k.revoked_at, k.created_at,
              COALESCE((SELECT COUNT(*) FROM api_key_usage WHERE api_key_id = k.id), 0) AS usage_count
       FROM api_keys k
       JOIN users u ON u.id = k.user_id
       ORDER BY k.created_at DESC`,
    ),
    query<UserLite>(
      `SELECT id, name, email, company FROM users
       WHERE COALESCE(is_admin, false) = false
       ORDER BY name`,
    ),
  ]);

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      <div className="bg-white border-b border-[#E5E5E5] px-4 sm:px-6 py-4 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logoflux.svg" alt="FLUX" className="h-7" />
          <span className="text-xs font-600 px-2 py-0.5 bg-[#1B4FFF] text-white rounded-full">Admin</span>
        </div>
        <a href="/" className="text-sm text-[#666] hover:text-[#1B4FFF]">← Sitio</a>
      </div>

      <AdminNav />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-800 text-[#18191F]">API Keys</h1>
          <p className="text-sm text-[#999] mt-0.5">
            Tokens para acceso B2B a <code className="bg-[#F0F0F0] px-1.5 rounded text-xs">/api/v1/b2b/*</code> —
            clientes corporativos pueden consultar sus rentas, pagos y facturas vía REST.
          </p>
        </div>

        <ApiKeysManager keys={keysRes.rows} users={usersRes.rows} />
      </div>
    </div>
  );
}
