import Link from "next/link";

const productos = [
  { label: "MacBook Air 13\" M4", href: "/laptops/macbook-air-13-m4" },
  { label: "MacBook Pro 14\" M4", href: "/laptops/macbook-pro-14-m4" },
  { label: "MacBook Pro 14\" M5", href: "/laptops/macbook-pro-14-m5" },
  { label: "Ver todos", href: "/laptops" },
];

const empresa = [
  { label: "¿Cómo funciona?", href: "/como-funciona" },
  { label: "Para empresas", href: "/empresas" },
  { label: "Preguntas frecuentes", href: "/como-funciona#faq" },
  { label: "Contacto", href: "/contacto" },
];

const legal = [
  { label: "Términos y condiciones", href: "/terminos" },
  { label: "Política de privacidad", href: "/privacidad" },
];

export default function Footer() {
  return (
    <footer style={{ background: "var(--dark)", color: "rgba(255,255,255,0.6)" }} className="pt-12 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">

          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--primary)" }}>
                <span className="text-white font-black text-sm">D</span>
              </div>
              <span className="text-white font-black text-xl tracking-tight">drip</span>
            </Link>
            <p className="text-sm leading-relaxed mb-4">
              Accede a las mejores Macs sin comprarlas. Planes mensuales para empresas en Lima.
            </p>
            <div className="flex gap-3">
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer"
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-colors hover:bg-white/10"
                style={{ border: "1px solid rgba(255,255,255,0.2)" }} aria-label="Instagram">
                IG
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer"
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-colors hover:bg-white/10"
                style={{ border: "1px solid rgba(255,255,255,0.2)" }} aria-label="LinkedIn">
                LI
              </a>
              <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer"
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-colors hover:bg-white/10"
                style={{ border: "1px solid rgba(255,255,255,0.2)" }} aria-label="TikTok">
                TK
              </a>
            </div>
          </div>

          {/* Productos */}
          <div>
            <h4 className="text-white font-bold mb-4 text-sm">Productos</h4>
            <ul className="space-y-2 text-sm">
              {productos.map(l => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-white transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Empresa */}
          <div>
            <h4 className="text-white font-bold mb-4 text-sm">Empresa</h4>
            <ul className="space-y-2 text-sm">
              {empresa.map(l => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-white transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal + Cuenta */}
          <div>
            <h4 className="text-white font-bold mb-4 text-sm">Legal</h4>
            <ul className="space-y-2 text-sm">
              {legal.map(l => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-white transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
            <h4 className="text-white font-bold mt-6 mb-4 text-sm">Mi cuenta</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/auth/login" className="hover:text-white transition-colors">Iniciar sesión</Link></li>
              <li><Link href="/auth/registro" className="hover:text-white transition-colors">Registrarse</Link></li>
              <li><Link href="/cuenta/rentas" className="hover:text-white transition-colors">Mis rentas</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row items-center justify-between gap-2 text-xs">
          <span>© 2026 DRIP — Tika Services S.A.C. · Lima, Perú · RUC 20608888888</span>
          <span>Hecho con 💙 para equipos que merecen Mac</span>
        </div>
      </div>
    </footer>
  );
}
