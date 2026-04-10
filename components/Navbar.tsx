"use client";
import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const nav = [
  { label: "MacBook Air", href: "/laptops?filter=air" },
  { label: "MacBook Pro", href: "/laptops?filter=pro" },
  { label: "Empresas", href: "/empresas" },
  { label: "¿Cómo funciona?", href: "/como-funciona" },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      {/* Top promo bar */}
      <div style={{ background: "var(--primary)" }} className="text-white text-sm font-semibold text-center py-2.5 px-4">
        🖥️ Nuevo en DRIP: MacBook Pro M5 ya disponible — desde $115/mes
      </div>

      {/* Main navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100" style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-6 h-16">

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 flex-shrink-0">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--primary)" }}>
                <span className="text-white font-black text-sm">D</span>
              </div>
              <span className="font-black text-xl tracking-tight" style={{ color: "var(--dark-text)" }}>drip</span>
            </Link>

            {/* Search */}
            <div className="hidden md:flex flex-1 max-w-md">
              <div className="w-full flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2.5 text-sm text-gray-400">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <span>Busca tu Mac...</span>
              </div>
            </div>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-1">
              {nav.map(item => (
                <Link key={item.href} href={item.href}
                  className="px-3 py-2 text-sm font-semibold rounded-full transition-colors hover:bg-gray-100"
                  style={{ color: "var(--dark-text)" }}>
                  {item.label}
                </Link>
              ))}
            </div>

            {/* Right icons */}
            <div className="flex items-center gap-2 ml-auto md:ml-0">
              <Link href="/login" className="hidden md:flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-full border-2 transition-all hover:bg-gray-50"
                style={{ borderColor: "var(--border)", color: "var(--dark-text)" }}>
                Ingresar
              </Link>
              <Link href="/registro" className="hidden md:flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white rounded-full transition-all"
                style={{ background: "var(--primary)" }}>
                Registrarse
              </Link>

              {/* Cart */}
              <button className="relative p-2 rounded-full hover:bg-gray-100 transition-colors">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <path d="M16 10a4 4 0 0 1-8 0"/>
                </svg>
              </button>

              {/* Mobile menu */}
              <button className="md:hidden p-2 rounded-full hover:bg-gray-100" onClick={() => setMenuOpen(!menuOpen)}>
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
              {["Todas", "MacBook Air", "MacBook Pro", "Chip M4", "Chip M5", "16 GB", "Novedades"].map(cat => (
                <button key={cat}
                  className="flex-shrink-0 px-3 py-1.5 text-sm font-semibold rounded-full whitespace-nowrap transition-colors hover:bg-gray-100"
                  style={{ color: "var(--medium-text)" }}>
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="fixed inset-x-0 top-0 z-40 bg-white pt-20 pb-6 px-4 shadow-xl md:hidden">
            <div className="flex flex-col gap-2">
              {nav.map(item => (
                <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}
                  className="px-4 py-3 text-base font-semibold rounded-xl hover:bg-gray-50"
                  style={{ color: "var(--dark-text)" }}>
                  {item.label}
                </Link>
              ))}
              <div className="border-t border-gray-100 mt-2 pt-4 flex flex-col gap-2">
                <Link href="/login" className="text-center px-4 py-3 font-bold rounded-full border-2" style={{ borderColor: "var(--border)" }}>Ingresar</Link>
                <Link href="/registro" className="text-center px-4 py-3 font-bold text-white rounded-full" style={{ background: "var(--primary)" }}>Registrarse</Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
