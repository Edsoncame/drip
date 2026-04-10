"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  return (
    <button onClick={handleLogout}
      className="text-sm font-600 text-red-500 hover:underline cursor-pointer">
      Cerrar sesión
    </button>
  );
}
