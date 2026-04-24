"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/tenant/logout", { method: "POST" });
    router.push("/tenant/login");
    router.refresh();
  }
  return (
    <button
      onClick={logout}
      className="text-white/60 hover:text-white text-sm border border-white/10 rounded-lg px-3 py-1.5"
    >
      Salir
    </button>
  );
}
