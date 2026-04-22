"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/dashboard", label: "📊 Dashboard" },
  { href: "/admin",            label: "Rentas",     exact: true },
  { href: "/admin/clientes",   label: "Clientes" },
  { href: "/admin/expansion",  label: "🎯 Expansión" },
  { href: "/admin/pagos",      label: "Pagos" },
  { href: "/admin/inventario", label: "Inventario" },
  { href: "/admin/finanzas",   label: "Finanzas" },
  { href: "/admin/productos",  label: "Productos" },
  { href: "/admin/precios",    label: "Precios" },
  { href: "/admin/usuarios",   label: "Usuarios" },
  { href: "/admin/vault",      label: "🔐 Vault" },
  { href: "/admin/agentes",    label: "🤖 Agentes" },
  { href: "/admin/estrategia", label: "📋 Estrategia" },
  { href: "/admin/kyc",        label: "🛡️ KYC" },
  { href: "/admin/reclamaciones", label: "📒 Reclamaciones" },
  { href: "/admin/api-keys",   label: "🔑 API Keys" },
];

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <div className="border-b border-[#E5E5E5] bg-white overflow-x-auto no-scrollbar">
      <div className="flex gap-1 px-4 sm:px-6 min-w-max">
        {TABS.map(tab => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-3 sm:px-4 py-3 text-sm font-600 border-b-2 transition-colors whitespace-nowrap ${
                active
                  ? "border-[#1B4FFF] text-[#1B4FFF]"
                  : "border-transparent text-[#666666] hover:text-[#333333]"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
