"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin",            label: "Rentas",     exact: true },
  { href: "/admin/clientes",   label: "Clientes" },
  { href: "/admin/inventario", label: "Inventario" },
  { href: "/admin/precios",    label: "Precios" },
  { href: "/admin/vault",      label: "🔐 Vault" },
];

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 border-b border-[#E5E5E5] px-6 bg-white">
      {TABS.map(tab => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-3 text-sm font-600 border-b-2 transition-colors ${
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
  );
}
