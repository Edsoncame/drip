import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import type { Metadata } from "next";
import AdminNav from "../AdminNav";

export const metadata: Metadata = {
  title: "Usuarios | Admin FLUX",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

interface AdminUser {
  id: string | null;
  name: string | null;
  email: string;
  created_at: string | null;
  avatar_url: string | null;
  last_login: string | null;
  inDb: boolean;
}

export default async function UsuariosPage() {
  const session = await getSession();
  if (!session || !ADMIN_EMAILS.includes(session.email.toLowerCase())) redirect("/");

  // Fetch info for each admin email
  const result = await query<{
    id: string; name: string; email: string; created_at: string; avatar_url: string | null;
  }>(
    `SELECT id, name, email, created_at, avatar_url FROM users WHERE LOWER(email) = ANY($1)`,
    [ADMIN_EMAILS]
  );

  const dbMap = new Map(result.rows.map(r => [r.email.toLowerCase(), r]));
  const users: AdminUser[] = ADMIN_EMAILS.map(email => {
    const row = dbMap.get(email);
    return {
      id: row?.id ?? null,
      name: row?.name ?? null,
      email,
      created_at: row?.created_at ?? null,
      avatar_url: row?.avatar_url ?? null,
      last_login: null,
      inDb: !!row,
    };
  });

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      <div className="bg-white border-b border-[#E5E5E5] px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/isotipoflux.svg" alt="Flux" className="h-7 w-auto" />
          <div className="flex items-center gap-2">
            <span className="font-800 text-[#18191F]">flux</span>
            <span className="text-xs font-600 px-2 py-0.5 bg-[#1B4FFF] text-white rounded-full">Admin</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-[#999999] hidden sm:block">{session.email}</span>
          <a href="/" className="text-sm text-[#666666] hover:text-[#1B4FFF] transition-colors">← Sitio</a>
        </div>
      </div>

      <AdminNav />

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-800 text-[#18191F]">Usuarios del equipo</h1>
            <p className="text-sm text-[#999999] mt-0.5">Administradores con acceso al panel de FLUX</p>
          </div>
          <span className="px-3 py-1.5 rounded-full text-xs font-700 bg-purple-100 text-purple-700">
            👑 Super admin: {session.email}
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F7F7F7]">
                <tr>
                  {["Usuario", "Email", "Estado", "Registrado"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-700 text-[#666666] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F0F0]">
                {users.map(u => (
                  <tr key={u.email} className="hover:bg-[#FAFAFA]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#1B4FFF] flex items-center justify-center text-white text-xs font-700 flex-shrink-0">
                          {(u.name ?? u.email).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-600 text-[#18191F]">{u.name ?? <span className="text-[#999] italic">Sin nombre</span>}</p>
                          {u.email === session.email.toLowerCase() && (
                            <p className="text-[10px] font-700 text-purple-700">Tú</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#333333]">{u.email}</td>
                    <td className="px-4 py-3">
                      {u.inDb ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-700 bg-green-100 text-green-700">
                          ✓ Activo
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-700 bg-orange-100 text-orange-700" title="Está en ADMIN_EMAILS pero no existe en DB">
                          ⚠ Sin cuenta en DB
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#666666]">
                      {u.created_at
                        ? new Date(u.created_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "2-digit" })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-2xl p-5">
          <p className="text-sm font-700 text-blue-900 mb-2">💡 Cómo agregar o quitar administradores</p>
          <p className="text-xs text-blue-800 leading-relaxed">
            El acceso admin se controla con la variable de entorno <code className="px-1.5 py-0.5 bg-white rounded text-[11px] font-mono">ADMIN_EMAILS</code> (lista separada por comas).
            Para dar acceso a alguien: edita esa variable en Vercel → Settings → Environment Variables, agrega el email,
            y asegúrate de que la persona tenga cuenta creada con ese mismo email. Después redeployea.
          </p>
        </div>
      </div>
    </div>
  );
}
