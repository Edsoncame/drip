import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import Link from "next/link";
import LogoutButton from "./LogoutButton";

export default async function CuentaPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login?redirect=/cuenta");

  const result = await query<{
    id: string; name: string; email: string;
    company: string; phone: string; ruc: string; created_at: string;
  }>(
    "SELECT id, name, email, company, phone, ruc, created_at FROM users WHERE id = $1",
    [session.userId]
  );
  const user = result.rows[0];
  if (!user) redirect("/auth/login");

  const memberSince = new Date(user.created_at).toLocaleDateString("es-PE", {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <p className="text-sm text-[#999999] mb-1">Mi cuenta</p>
        <h1 className="text-3xl font-800 text-[#18191F]">Hola, {user.name.split(" ")[0]} 👋</h1>
        <p className="text-[#666666] text-sm mt-1">Miembro desde {memberSince}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Quick links */}
        {[
          { href: "/cuenta/rentas", icon: "💻", label: "Mis rentas", desc: "Ver equipos activos" },
          { href: "/laptops", icon: "🛍️", label: "Rentar otro equipo", desc: "Ver catálogo" },
          { href: "/como-funciona", icon: "❓", label: "¿Cómo funciona?", desc: "Guía completa" },
        ].map(item => (
          <Link key={item.href} href={item.href}
            className="bg-white border border-[#E5E5E5] rounded-2xl p-5 hover:border-[#1B4FFF] hover:shadow-sm transition-all group">
            <div className="text-2xl mb-3">{item.icon}</div>
            <p className="font-700 text-[#18191F] group-hover:text-[#1B4FFF] transition-colors">{item.label}</p>
            <p className="text-sm text-[#999999] mt-0.5">{item.desc}</p>
          </Link>
        ))}
      </div>

      {/* Profile card */}
      <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 mb-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-700 text-[#18191F]">Datos personales</h2>
          <span className="text-xs text-[#999999]">Para editar escríbenos a hola@drip.pe</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: "Nombre completo", value: user.name },
            { label: "Correo electrónico", value: user.email },
            { label: "Teléfono", value: user.phone || "—" },
            { label: "Empresa", value: user.company || "—" },
            { label: "RUC", value: user.ruc || "—" },
          ].map(f => (
            <div key={f.label} className="bg-[#F7F7F7] rounded-xl p-4">
              <p className="text-xs text-[#999999] mb-1">{f.label}</p>
              <p className="font-600 text-[#18191F] text-sm">{f.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Security */}
      <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6">
        <h2 className="font-700 text-[#18191F] mb-4">Seguridad</h2>
        <div className="flex items-center justify-between py-3 border-b border-[#F0F0F0]">
          <div>
            <p className="text-sm font-600 text-[#333333]">Contraseña</p>
            <p className="text-xs text-[#999999]">Última actualización: al crear cuenta</p>
          </div>
          <Link href="/auth/cambiar-password"
            className="text-sm font-600 text-[#1B4FFF] hover:underline">
            Cambiar
          </Link>
        </div>
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-600 text-[#333333]">Cerrar sesión</p>
            <p className="text-xs text-[#999999]">Salir de tu cuenta en este dispositivo</p>
          </div>
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}

