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
  { label: "Blog", href: "/blog" },
  { label: "Centro de ayuda", href: "/ayuda" },
  { label: "Contacto", href: "/contacto" },
];

const legal = [
  { label: "Términos y condiciones", href: "/terminos" },
  { label: "Política de privacidad", href: "/privacidad" },
  { label: "Cancelaciones y devoluciones", href: "/cancelaciones" },
  { label: "Libro de Reclamaciones", href: "/libro-de-reclamaciones" },
];

export default function Footer() {
  return (
    <footer style={{ background: "var(--dark)", color: "rgba(255,255,255,0.6)" }} className="pt-12 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">

          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-flex items-center mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/logoflux-white.svg" alt="FLUX" className="h-8 w-auto" />
            </Link>
            <p className="text-sm leading-relaxed mb-4">
              Accede a las mejores Macs sin comprarlas. Planes mensuales para empresas en Lima.
            </p>
            <div className="flex gap-3">
              <a href="https://wa.me/51932648703" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-full text-xs font-bold transition-colors hover:bg-white/10"
                style={{ border: "1px solid rgba(255,255,255,0.2)" }} aria-label="WhatsApp">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.52 3.48A12 12 0 003.48 20.52L2 22l1.59-1.41A12 12 0 1020.52 3.48zm-8.52 17a8.5 8.5 0 01-4.33-1.18l-.31-.18-3.2.84.85-3.12-.2-.32A8.5 8.5 0 1120.5 12 8.5 8.5 0 0112 20.5zm4.67-6.38c-.26-.13-1.52-.75-1.75-.83s-.41-.13-.58.13-.67.83-.82 1-.3.2-.56.07a6.98 6.98 0 01-3.45-3.01c-.26-.45.26-.42.75-1.4.08-.17 0-.32-.03-.45s-.58-1.4-.8-1.92c-.21-.5-.42-.43-.58-.44h-.5a.96.96 0 00-.7.33 2.93 2.93 0 00-.92 2.19 5.09 5.09 0 001.06 2.67 11.66 11.66 0 004.47 3.92c.62.27 1.1.43 1.48.55a3.58 3.58 0 001.64.1 2.68 2.68 0 001.76-1.24 2.17 2.17 0 00.15-1.24c-.07-.1-.23-.17-.49-.3z"/></svg>
                WhatsApp
              </a>
              <a href="mailto:hola@fluxperu.com"
                className="flex items-center gap-2 px-3 py-2 rounded-full text-xs font-bold transition-colors hover:bg-white/10"
                style={{ border: "1px solid rgba(255,255,255,0.2)" }} aria-label="Email">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                Email
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

        <div className="border-t border-white/10 pt-6 space-y-3 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-white font-700 mb-1">Tika Services S.A.C.</p>
              <p>RUC: 20605702512</p>
              <p>Av. Primavera 543, Piso 4 — San Borja, Lima, Perú</p>
            </div>
            <div className="md:text-right">
              <p className="text-white font-700 mb-1">Contacto</p>
              <p>
                <a href="mailto:hola@fluxperu.com" className="hover:text-white transition-colors">hola@fluxperu.com</a>
              </p>
              <p>
                <a href="https://wa.me/51932648703" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">+51 932 648 703</a>
              </p>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-2 pt-3 border-t border-white/5">
            <span>© 2026 FLUX — Tika Services S.A.C. · Todos los derechos reservados</span>
            <span>Empresa inscrita en SUNAT y SUNARP · Lima, Perú</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
