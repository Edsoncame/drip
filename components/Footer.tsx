import Link from "next/link";

export default function Footer() {
  return (
    <footer style={{ background: "var(--dark)", color: "rgba(255,255,255,0.6)" }} className="pt-12 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">

          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--primary)" }}>
                <span className="text-white font-black text-sm">D</span>
              </div>
              <span className="text-white font-black text-xl tracking-tight">drip</span>
            </div>
            <p className="text-sm leading-relaxed mb-4">
              Accede a las mejores Macs sin comprarlas. Planes mensuales para empresas y equipos en Perú.
            </p>
            <div className="flex gap-3">
              {["instagram", "linkedin", "tiktok"].map(s => (
                <a key={s} href="#" className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-colors hover:bg-white/10"
                  style={{ border: "1px solid rgba(255,255,255,0.2)" }}>
                  {s[0].toUpperCase()}
                </a>
              ))}
            </div>
          </div>

          {/* Productos */}
          <div>
            <h4 className="text-white font-bold mb-4 text-sm">Productos</h4>
            <ul className="space-y-2 text-sm">
              {["MacBook Air 13\" M4", "MacBook Pro 14\" M4", "MacBook Pro 14\" M5", "Ver todos"].map(l => (
                <li key={l}><Link href="/laptops" className="hover:text-white transition-colors">{l}</Link></li>
              ))}
            </ul>
          </div>

          {/* Empresa */}
          <div>
            <h4 className="text-white font-bold mb-4 text-sm">Empresa</h4>
            <ul className="space-y-2 text-sm">
              {["¿Cómo funciona?", "Para empresas", "Preguntas frecuentes", "Contacto"].map(l => (
                <li key={l}><Link href="/como-funciona" className="hover:text-white transition-colors">{l}</Link></li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-white font-bold mb-4 text-sm">Legal</h4>
            <ul className="space-y-2 text-sm">
              {["Términos y condiciones", "Política de privacidad", "Política de cookies"].map(l => (
                <li key={l}><a href="#" className="hover:text-white transition-colors">{l}</a></li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row items-center justify-between gap-2 text-xs">
          <span>© 2026 DRIP — Tika Services S.A.C. · Lima, Perú · RUC 20XXXXXXXXX</span>
          <span>Hecho con 💙 para equipos que merecen Mac</span>
        </div>
      </div>
    </footer>
  );
}
