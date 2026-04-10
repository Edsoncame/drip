"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import type { Product } from "@/lib/products";

// ── Context ───────────────────────────────────────────────────────────────────
interface CompareCtx {
  selected: Product[];
  toggle: (p: Product) => void;
  has: (slug: string) => boolean;
  clear: () => void;
}

const CompareContext = createContext<CompareCtx>({
  selected: [],
  toggle: () => {},
  has: () => false,
  clear: () => {},
});

export function CompareProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<Product[]>([]);

  const toggle = useCallback((p: Product) => {
    setSelected(prev => {
      if (prev.find(x => x.slug === p.slug)) return prev.filter(x => x.slug !== p.slug);
      if (prev.length >= 3) return prev; // max 3
      return [...prev, p];
    });
  }, []);

  const has = useCallback((slug: string) => selected.some(x => x.slug === slug), [selected]);
  const clear = useCallback(() => setSelected([]), []);

  return (
    <CompareContext.Provider value={{ selected, toggle, has, clear }}>
      {children}
      <CompareBar />
    </CompareContext.Provider>
  );
}

export function useCompare() {
  return useContext(CompareContext);
}

// ── Floating bar ──────────────────────────────────────────────────────────────
function CompareBar() {
  const { selected, clear } = useCompare();

  return (
    <AnimatePresence>
      {selected.length >= 2 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40"
        >
          <div
            className="flex items-center gap-4 px-5 py-3.5 rounded-2xl shadow-2xl text-sm"
            style={{ background: "#18191F", color: "#fff", minWidth: 320 }}
          >
            <div className="flex items-center gap-2 flex-1">
              {selected.map(p => (
                <span key={p.slug} className="bg-white/10 px-2.5 py-1 rounded-full text-xs font-600 whitespace-nowrap">
                  {p.shortName}
                </span>
              ))}
              {selected.length < 3 && (
                <span className="text-white/40 text-xs">
                  + {3 - selected.length} más
                </span>
              )}
            </div>
            <Link
              href={`/laptops/comparar?slugs=${selected.map(p => p.slug).join(",")}`}
              className="flex-shrink-0 px-4 py-2 bg-[#1B4FFF] text-white font-700 rounded-full hover:bg-[#1340CC] transition-colors text-xs"
            >
              Comparar →
            </Link>
            <button
              onClick={clear}
              className="flex-shrink-0 text-white/50 hover:text-white transition-colors cursor-pointer p-1"
              aria-label="Limpiar comparación"
            >
              ✕
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
