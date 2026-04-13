"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

const nav = [
  { label: "MacBook Air", href: "/laptops?filter=air" },
  { label: "MacBook Pro", href: "/laptops?filter=pro" },
  { label: "Empresas", href: "/empresas" },
  { label: "¿Cómo funciona?", href: "/como-funciona" },
];

interface User {
  id: string;
  name: string;
  email: string;
  isAdmin?: boolean;
}

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.user) setUser(data.user); })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setUserMenuOpen(false);
    router.push("/");
    router.refresh();
  };

  return (
    <>
      {/* Top promo bar */}
      <div style={{ background: "var(--primary)" }} className="text-white text-sm font-semibold text-center py-2.5 px-4">
        🔥 Nuevo: MacBook Pro M5 ya en FLUX — desde $115/mes · Envío a Lima en 24h
      </div>

      {/* Main navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100" style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-6 h-16">

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/logoflux.svg" alt="FLUX" className="h-7 w-auto" />
            </Link>

            {/* Search */}
            <form
              className="hidden md:flex flex-1 max-w-md"
              onSubmit={(e) => {
                e.preventDefault();
                const q = (e.currentTarget.elements.namedItem("q") as HTMLInputElement).value.trim();
                router.push(q ? `/laptops?q=${encodeURIComponent(q)}` : "/laptops");
              }}
            >
              <div className="w-full flex items-center gap-2 bg-gray-100 hover:bg-gray-200 transition-colors rounded-full px-4 py-2 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#1B4FFF]/20 focus-within:border focus-within:border-[#1B4FFF]/30">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-gray-400">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  name="q"
                  type="text"
                  placeholder="Busca tu Mac..."
                  className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none"
                />
              </div>
            </form>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-1">
              {nav.map(item => (
                <Link key={item.href} href={item.href}
                  className="px-3 py-2 text-sm font-semibold rounded-full transition-colors hover:bg-gray-100"
                  style={{ color: "var(--dark-text)" }}>
                  {item.label}
                </Link>
              ))}
              {user?.isAdmin && (
                <a href="/admin"
                  className="ml-1 px-3 py-2 text-sm font-700 rounded-full bg-[#1B4FFF] text-white hover:bg-[#1340CC] transition-colors">
                  Admin
                </a>
              )}
            </div>

            {/* Right — auth area */}
            <div className="flex items-center gap-2 ml-auto md:ml-0">
              {user ? (
                /* Logged-in user menu */
                <div className="relative hidden md:block">
                  <button
                    onClick={() => setUserMenuOpen((v) => !v)}
                    className="flex items-center gap-2 px-3 py-2 rounded-full border border-[#E5E5E5] hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-full bg-[#1B4FFF] flex items-center justify-center text-white text-xs font-700">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-600 text-[#333333] max-w-[120px] truncate">
                      {user.name.split(" ")[0]}
                    </span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[#999999]">
                      <path d="M6 9l6 6 6-6"/>
                    </svg>
                  </button>

                  <AnimatePresence>
                    {userMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-lg border border-[#E5E5E5] py-2 z-50"
                      >
                        <div className="px-4 py-3 border-b border-[#F0F0F0]">
                          <p className="text-sm font-700 text-[#18191F] truncate">{user.name}</p>
                          <p className="text-xs text-[#999999] truncate">{user.email}</p>
                        </div>
                        <Link href="/cuenta" onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#333333] hover:bg-[#F7F7F7] transition-colors">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                          Mi cuenta
                        </Link>
                        <Link href="/cuenta/rentas" onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#333333] hover:bg-[#F7F7F7] transition-colors">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
                          Mis rentas
                        </Link>
                        <Link href="/cuenta/pagos" onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#333333] hover:bg-[#F7F7F7] transition-colors">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                          Mis pagos
                        </Link>
                        {user.isAdmin && (
                          <a href="/admin" onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#1B4FFF] hover:bg-[#EEF2FF] transition-colors font-600">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                            Panel admin
                          </a>
                        )}
                        <div className="border-t border-[#F0F0F0] mt-1 pt-1">
                          <button onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors cursor-pointer">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                            Cerrar sesión
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                /* Guest buttons */
                <>
                  <Link href="/auth/login" className="hidden md:flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-full border-2 transition-all hover:bg-gray-50"
                    style={{ borderColor: "var(--border)", color: "var(--dark-text)" }}>
                    Ingresar
                  </Link>
                  <Link href="/auth/registro" className="hidden md:flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white rounded-full transition-all hover:opacity-90"
                    style={{ background: "var(--primary)" }}>
                    Registrarse
                  </Link>
                </>
              )}

              {/* Cart */}
              <Link href="/laptops" className="relative p-2 rounded-full hover:bg-gray-100 transition-colors cursor-pointer">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <path d="M16 10a4 4 0 0 1-8 0"/>
                </svg>
              </Link>

              {/* Mobile menu */}
              <button className="md:hidden p-2 rounded-full hover:bg-gray-100 cursor-pointer" onClick={() => setMenuOpen(!menuOpen)}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {menuOpen ? <path d="M18 6 6 18M6 6l12 12"/> : <path d="M3 12h18M3 6h18M3 18h18"/>}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Category nav */}
        <div className="border-t border-gray-100 hidden md:block">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-center gap-1 py-1 overflow-x-auto no-scrollbar">
              {[
                { label: "Todas", href: "/laptops" },
                { label: "MacBook Air", href: "/laptops?filter=air" },
                { label: "MacBook Pro", href: "/laptops?filter=pro" },
                { label: "Chip M4", href: "/laptops?filter=m4" },
                { label: "Chip M5", href: "/laptops?filter=m5" },
                { label: "16 GB", href: "/laptops?filter=16gb" },
                { label: "Novedades", href: "/laptops?filter=new" },
              ].map(cat => (
                <Link key={cat.href} href={cat.href}
                  className="flex-shrink-0 px-3 py-1.5 text-sm font-semibold rounded-full whitespace-nowrap transition-colors hover:bg-gray-100 cursor-pointer"
                  style={{ color: "var(--medium-text)" }}>
                  {cat.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="fixed inset-0 z-[60] bg-white pt-6 pb-6 px-4 overflow-y-auto md:hidden">
            {/* Close + Logo */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/logoflux.svg" alt="FLUX" className="h-7 w-auto" />
              </div>
              <button onClick={() => setMenuOpen(false)} className="p-2 rounded-full hover:bg-gray-100 cursor-pointer" aria-label="Cerrar menú">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {nav.map(item => (
                <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}
                  className="px-4 py-3 text-base font-semibold rounded-xl hover:bg-gray-50"
                  style={{ color: "var(--dark-text)" }}>
                  {item.label}
                </Link>
              ))}
              <div className="border-t border-gray-100 mt-2 pt-4 flex flex-col gap-2">
                {user ? (
                  <>
                    <div className="px-4 py-2">
                      <p className="font-700 text-[#18191F]">{user.name}</p>
                      <p className="text-sm text-[#999999]">{user.email}</p>
                    </div>
                    <Link href="/cuenta" onClick={() => setMenuOpen(false)} className="px-4 py-3 font-600 rounded-xl hover:bg-gray-50 text-[#333333]">Mi cuenta</Link>
                    <Link href="/cuenta/rentas" onClick={() => setMenuOpen(false)} className="px-4 py-3 font-600 rounded-xl hover:bg-gray-50 text-[#333333]">Mis rentas</Link>
                    <Link href="/cuenta/pagos" onClick={() => setMenuOpen(false)} className="px-4 py-3 font-600 rounded-xl hover:bg-gray-50 text-[#333333]">Mis pagos</Link>
                    {user.isAdmin && (
                      <Link href="/admin" onClick={() => setMenuOpen(false)} className="px-4 py-3 font-600 rounded-xl hover:bg-[#EEF2FF] text-[#1B4FFF]">Panel admin</Link>
                    )}
                    <button onClick={() => { handleLogout(); setMenuOpen(false); }} className="text-left px-4 py-3 font-600 rounded-xl hover:bg-red-50 text-red-500 cursor-pointer">Cerrar sesión</button>
                  </>
                ) : (
                  <>
                    <Link href="/auth/login" onClick={() => setMenuOpen(false)} className="text-center px-4 py-3 font-bold rounded-full border-2" style={{ borderColor: "var(--border)" }}>Ingresar</Link>
                    <Link href="/auth/registro" onClick={() => setMenuOpen(false)} className="text-center px-4 py-3 font-bold text-white rounded-full" style={{ background: "var(--primary)" }}>Registrarse</Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
