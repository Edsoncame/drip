/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Manual de Marca | FLUX",
  description: "Identidad visual de FLUX y FLUX Certified: logotipo, color, tipografía y sistema gráfico.",
  robots: { index: false, follow: false },
};

const css = `
.bm{--blue:#1B4FFF;--blueD:#102F99;--ink:#18191F;--g:#08D464;--gM:#2CD277;--gL:#C9F8C6;
  font-family:Inter,system-ui,sans-serif;color:#333;line-height:1.6;background:#fff;}
.bm h1,.bm h2,.bm h3,.bm h4{font-family:stratos,Inter,sans-serif;color:var(--ink);letter-spacing:-.01em;line-height:1.08;}
.bm .wrap{max-width:1040px;margin:0 auto;padding:0 24px;}
.bm section{padding:64px 0;border-bottom:1px solid #F0F0F0;}
.bm .kick{font-family:stratos;font-weight:700;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--blue);margin-bottom:10px;}
.bm h2.sec{font-size:38px;font-weight:900;margin-bottom:10px;}
.bm .lead{color:#666;font-size:16px;max-width:680px;margin-bottom:28px;}
.bm h3{font-size:17px;font-weight:700;margin:0 0 8px;}
.bm p{margin:0 0 12px;}
.bm .muted{color:#999;font-size:13px;}
.bm .mono{font-family:ui-monospace,'SF Mono',monospace;font-size:13px;}
.bm .grid2{display:grid;grid-template-columns:1fr 1fr;gap:18px;}
.bm .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}
.bm .card{border:1px solid #E5E5E5;border-radius:18px;padding:22px;}
.bm .box{background:#F7F7F7;border-radius:16px;padding:28px;display:flex;align-items:center;justify-content:center;min-height:120px;}
.bm .box.dark{background:var(--ink);}
.bm .box.blue{background:var(--blue);}
.bm .box.grad{background:linear-gradient(135deg,var(--blue),var(--blueD));}
.bm .box.gradG{background:linear-gradient(135deg,var(--g),#06A94F);}
.bm table{width:100%;border-collapse:collapse;margin-top:8px;}
.bm th{font-family:stratos;font-weight:700;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#999;padding:10px 10px;border-bottom:2px solid #E5E5E5;}
.bm td{padding:12px 10px;border-bottom:1px solid #F2F2F2;vertical-align:middle;font-size:14px;}
.bm .sw{width:40px;height:40px;border-radius:10px;}
.bm .tag{display:inline-block;font-family:stratos;font-weight:700;font-size:11px;padding:4px 11px;border-radius:999px;margin-right:8px;}
.bm .ok{background:#E5F3DF;color:#2D7D46;}
.bm .no{background:#FDE8E8;color:#C0392B;}
.bm ul{margin:0 0 12px 18px;}.bm li{margin-bottom:6px;}
.bm .nav{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.92);backdrop-filter:blur(8px);border-bottom:1px solid #E5E5E5;}
.bm .nav .wrap{display:flex;gap:18px;align-items:center;height:56px;overflow-x:auto;}
.bm .nav a{font-size:13px;font-weight:600;color:#666;text-decoration:none;white-space:nowrap;}
.bm .nav a:hover{color:var(--blue);}
.bm .pill{display:inline-block;padding:5px 12px;border-radius:999px;font-family:stratos;font-weight:700;font-size:12px;}
@media(max-width:760px){.bm .grid2,.bm .grid3{grid-template-columns:1fr;}.bm h2.sec{font-size:28px;}}
`;

export default function MarcaPage() {
  return (
    <div className="bm">
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* NAV */}
      <div className="nav"><div className="wrap">
        <img src="/images/logoflux.svg" alt="FLUX" style={{ height: 22 }} />
        {[["esencia", "Esencia"], ["logo", "Logotipo"], ["variantes", "Variantes"], ["certified", "FLUX Certified"], ["color", "Color"], ["tipografia", "Tipografía"], ["graficos", "Elementos gráficos"], ["foto", "Fotografía"], ["reticula", "Retícula"]].map(([id, t]) => (
          <a key={id} href={`#${id}`}>{t}</a>
        ))}
      </div></div>

      {/* HERO */}
      <section style={{ background: "linear-gradient(135deg,#1B4FFF,#102F99)", color: "#fff", borderBottom: "none", padding: "84px 0" }}>
        <div className="wrap">
          <img src="/images/isotipoflux.svg" alt="" style={{ height: 64, marginBottom: 28, filter: "brightness(0) invert(1)" }} />
          <div style={{ fontFamily: "stratos", fontWeight: 700, fontSize: 13, letterSpacing: ".2em", textTransform: "uppercase", opacity: .85 }}>Identidad Visual</div>
          <h1 style={{ color: "#fff", fontSize: 68, fontWeight: 900, lineHeight: .98, margin: "10px 0 16px" }}>Manual de Marca</h1>
          <p style={{ color: "#fff", opacity: .9, fontSize: 18, maxWidth: 640 }}>Reglas de uso de la identidad visual de <b>FLUX</b> (alquiler) y <b>FLUX&nbsp;Certified</b> (venta reacondicionada): logotipo, color, tipografía y sistema gráfico.</p>
          <div style={{ marginTop: 22, display: "flex", gap: 10 }}>
            <span className="pill" style={{ background: "rgba(255,255,255,.15)", color: "#fff" }}>FLUX · Azul</span>
            <span className="pill" style={{ background: "#08D464", color: "#06351f" }}>FLUX Certified · Verde</span>
          </div>
        </div>
      </section>

      {/* ESENCIA */}
      <section id="esencia"><div className="wrap">
        <div className="kick">01 · Fundamento</div>
        <h2 className="sec">Una casa, dos marcas</h2>
        <p className="lead">FLUX hace simple tener la mejor tecnología. La marca madre es azul; FLUX Certified —la venta de equipos reacondicionados— es su sello verde de confianza.</p>
        <div className="grid2">
          <div className="card" style={{ borderColor: "#C7D2FE" }}>
            <span className="pill" style={{ background: "#EEF2FF", color: "#1B4FFF" }}>FLUX · Alquiler</span>
            <h3 style={{ marginTop: 12 }}>Renting de MacBooks</h3>
            <p className="muted">Equipa a tu equipo con Mac bajo alquiler mensual, sin comprar ni inmovilizar capital. Azul de marca, tono moderno y directo.</p>
          </div>
          <div className="card" style={{ borderColor: "#A7F3C4" }}>
            <span className="pill" style={{ background: "#C9F8C6", color: "#06351f" }}>FLUX Certified · Venta</span>
            <h3 style={{ marginTop: 12 }}>Reacondicionados con garantía</h3>
            <p className="muted">Macs que pasaron por alquiler, revisados y certificados para reventa. Verde = confianza, calidad verificada.</p>
          </div>
        </div>
        <div className="grid3" style={{ marginTop: 18 }}>
          <div className="box blue" style={{ color: "#fff", flexDirection: "column", alignItems: "flex-start" }}><div style={{ fontFamily: "stratos", fontWeight: 900, fontSize: 22 }}>Simple</div><div style={{ fontSize: 13, opacity: .85, marginTop: 4 }}>Sin fricción ni letra chica.</div></div>
          <div className="box" style={{ flexDirection: "column", alignItems: "flex-start" }}><div style={{ fontFamily: "stratos", fontWeight: 900, fontSize: 22, color: "#18191F" }}>Confiable</div><div className="muted" style={{ marginTop: 4 }}>Equipos y soporte que responden.</div></div>
          <div className="box" style={{ flexDirection: "column", alignItems: "flex-start" }}><div style={{ fontFamily: "stratos", fontWeight: 900, fontSize: 22, color: "#18191F" }}>Ágil</div><div className="muted" style={{ marginTop: 4 }}>Rápido de pedir y entregar.</div></div>
        </div>
      </div></section>

      {/* LOGOTIPO */}
      <section id="logo"><div className="wrap">
        <div className="kick">02 · Logotipo</div>
        <h2 className="sec">Logotipo principal</h2>
        <p className="lead">Isotipo (símbolo con degradado azul) + wordmark “FLUX”. Es la versión preferente; úsala siempre que el espacio lo permita. Usa siempre el vectorial original, nunca recreado.</p>
        <div className="box" style={{ minHeight: 200, marginBottom: 18 }}><img src="/images/logoflux.svg" alt="FLUX logotipo" style={{ width: 360, maxWidth: "80%" }} /></div>
        <div className="grid3">
          <div className="card" style={{ textAlign: "center" }}><div className="box"><img src="/images/isotipoflux.svg" alt="" style={{ height: 70 }} /></div><h3 style={{ marginTop: 12 }}>Isotipo</h3><p className="muted">App icon, avatar, sello.</p></div>
          <div className="card" style={{ textAlign: "center" }}><div className="box dark"><img src="/images/isotipoflux.svg" alt="" style={{ height: 50, filter: "brightness(0) invert(1)" }} /></div><h3 style={{ marginTop: 12 }}>Favicon</h3><p className="muted">16–64px, símbolo centrado.</p></div>
          <div className="card" style={{ textAlign: "center" }}><div className="box" style={{ overflow: "hidden" }}><img src="/images/isotipoflux.svg" alt="" style={{ height: 130, opacity: .07 }} /></div><h3 style={{ marginTop: 12 }}>Marca de agua</h3><p className="muted">Isotipo al 4–8% de opacidad.</p></div>
        </div>
      </div></section>

      {/* VARIANTES */}
      <section id="variantes"><div className="wrap">
        <div className="kick">03 · Variantes</div>
        <h2 className="sec">Variantes del logo</h2>
        <p className="lead">Elige la variante según el fondo y el formato. Mantén siempre contraste y legibilidad.</p>
        <div className="grid2">
          <div className="card"><h3>Horizontal · color (principal)</h3><div className="box"><img src="/images/logoflux.svg" alt="" style={{ width: 230 }} /></div></div>
          <div className="card"><h3>Negativo · sobre oscuro</h3><div className="box dark"><img src="/images/logoflux-white.svg" alt="" style={{ width: 230 }} /></div></div>
          <div className="card"><h3>Vertical · lockup</h3><div className="box" style={{ flexDirection: "column", gap: 12 }}><img src="/images/isotipoflux.svg" alt="" style={{ height: 56 }} /><div style={{ fontFamily: "stratos", fontWeight: 900, fontSize: 30, color: "#18191F", letterSpacing: ".03em" }}>FLUX</div></div></div>
          <div className="card"><h3>Monocromático · sobre azul</h3><div className="box blue"><img src="/images/logoflux-white.svg" alt="" style={{ width: 230, filter: "brightness(0) invert(1)" }} /></div></div>
        </div>
      </div></section>

      {/* PROTECCIÓN + USOS */}
      <section><div className="wrap">
        <div className="kick">04 · Construcción y uso</div>
        <h2 className="sec">Protección, tamaño y usos</h2>
        <div className="grid2" style={{ marginBottom: 20 }}>
          <div className="card"><h3>Área de protección</h3><div className="box" style={{ padding: 0 }}><div style={{ padding: 30, outline: "1px dashed #1B4FFF" }}><img src="/images/logoflux.svg" alt="" style={{ width: 150 }} /></div></div><p className="muted" style={{ marginTop: 10 }}>Margen libre mínimo = altura de la “F” del wordmark. Nada invade esa zona.</p></div>
          <div className="card"><h3>Tamaño mínimo</h3><div className="box" style={{ gap: 28 }}><div style={{ textAlign: "center" }}><img src="/images/logoflux.svg" alt="" style={{ width: 120 }} /><div className="muted" style={{ marginTop: 8 }}>120px / 24mm</div></div><div style={{ textAlign: "center" }}><img src="/images/isotipoflux.svg" alt="" style={{ height: 18 }} /><div className="muted" style={{ marginTop: 8 }}>Isotipo · 16px</div></div></div></div>
        </div>
        <h3>Usos correctos e incorrectos</h3>
        <table>
          <tbody>
            <tr><td style={{ width: "50%" }}><span className="tag ok">SÍ</span> Usar el vectorial original con su color y proporciones.</td><td><span className="tag no">NO</span> Redibujar, recrear o usar capturas.</td></tr>
            <tr><td><span className="tag ok">SÍ</span> Respetar protección y tamaño mínimo.</td><td><span className="tag no">NO</span> Deformar, rotar, estirar o inclinar.</td></tr>
            <tr><td><span className="tag ok">SÍ</span> Negativo sobre fondos oscuros o azul.</td><td><span className="tag no">NO</span> Cambiar colores del logo o del degradado.</td></tr>
            <tr><td><span className="tag ok">SÍ</span> Asegurar contraste con el fondo.</td><td><span className="tag no">NO</span> Sombras, contornos, brillos o efectos.</td></tr>
          </tbody>
        </table>
      </div></section>

      {/* FLUX CERTIFIED */}
      <section id="certified" style={{ background: "#F6FFF9" }}><div className="wrap">
        <div className="kick" style={{ color: "#06A94F" }}>05 · Sub-marca</div>
        <h2 className="sec">FLUX Certified</h2>
        <p className="lead">El sello verde de los MacBooks reacondicionados de FLUX. Comunica calidad verificada y garantía. Convive con la marca madre pero tiene su propio color: el verde.</p>
        <div className="box" style={{ background: "#fff", border: "1px solid #A7F3C4", minHeight: 180, marginBottom: 18 }}><img src="/images/fluxcertified.svg" alt="FLUX Certified" style={{ width: 420, maxWidth: "85%" }} /></div>
        <div className="grid2">
          <div className="card"><h3>Cuándo se usa</h3><ul>
            <li>Solo en equipos <b>reacondicionados certificados</b> (página /comprar, etiquetas, fichas de venta).</li>
            <li>Nunca en piezas de alquiler — ahí va la marca FLUX azul.</li>
            <li>El sello puede ir solo (badge de “certificado”) sobre la foto del producto.</li>
          </ul></div>
          <div className="card"><h3>Relación con FLUX</h3><ul>
            <li>FLUX Certified es <b>endoso</b> de FLUX, no una marca independiente.</li>
            <li>Misma tipografía (Stratos / Inter). Cambia el color a verde.</li>
            <li>No mezclar el azul y el verde en el mismo logo.</li>
          </ul></div>
        </div>
        <h3 style={{ marginTop: 20 }}>Paleta FLUX Certified</h3>
        <table>
          <thead><tr><th></th><th>Color</th><th>HEX</th><th>RGB</th><th>CMYK</th><th>Pantone</th></tr></thead>
          <tbody>
            <tr><td><div className="sw" style={{ background: "#08D464" }} /></td><td><b>Certified Green</b><div className="muted">Color del sello, acentos.</div></td><td className="mono">#08D464</td><td className="mono">8, 212, 100</td><td className="mono">96, 0, 53, 17</td><td className="mono">354 C (aprox.)</td></tr>
            <tr><td><div className="sw" style={{ background: "#2CD277" }} /></td><td><b>Certified Mid</b><div className="muted">Trazo del pill / borde.</div></td><td className="mono">#2CD277</td><td className="mono">44, 210, 119</td><td className="mono">79, 0, 43, 18</td><td className="mono">7480 C (aprox.)</td></tr>
            <tr><td><div className="sw" style={{ background: "#C9F8C6", boxShadow: "inset 0 0 0 1px #E5E5E5" }} /></td><td><b>Certified Light</b><div className="muted">Fondos suaves, chips.</div></td><td className="mono">#C9F8C6</td><td className="mono">201, 248, 198</td><td className="mono">19, 0, 20, 3</td><td className="mono">—</td></tr>
          </tbody>
        </table>
      </div></section>

      {/* COLOR */}
      <section id="color"><div className="wrap">
        <div className="kick">06 · Color</div>
        <h2 className="sec">Paleta de colores</h2>
        <p className="lead">El azul es el sello de FLUX; el verde, el de Certified. Los neutros dan la base limpia. Valores para pantalla (HEX/RGB) e impresión (CMYK/Pantone aprox.).</p>
        <h3>Primarios FLUX</h3>
        <table>
          <thead><tr><th></th><th>Color</th><th>HEX</th><th>RGB</th><th>CMYK</th><th>Pantone</th></tr></thead>
          <tbody>
            <tr><td><div className="sw" style={{ background: "#1B4FFF" }} /></td><td><b>FLUX Blue</b><div className="muted">Acentos, botones, links.</div></td><td className="mono">#1B4FFF</td><td className="mono">27, 79, 255</td><td className="mono">89, 69, 0, 0</td><td className="mono">2126 C</td></tr>
            <tr><td><div className="sw" style={{ background: "#102F99" }} /></td><td><b>Blue Deep</b><div className="muted">Cierre del degradado.</div></td><td className="mono">#102F99</td><td className="mono">16, 47, 153</td><td className="mono">90, 69, 0, 40</td><td className="mono">2746 C</td></tr>
            <tr><td><div className="sw" style={{ background: "#1340CC" }} /></td><td><b>Blue Dark</b><div className="muted">Hover / pressed.</div></td><td className="mono">#1340CC</td><td className="mono">19, 64, 204</td><td className="mono">91, 69, 0, 20</td><td className="mono">2126 C</td></tr>
            <tr><td><div className="sw" style={{ background: "#EEF2FF", boxShadow: "inset 0 0 0 1px #E5E5E5" }} /></td><td><b>Blue Light</b><div className="muted">Fondos suaves, chips.</div></td><td className="mono">#EEF2FF</td><td className="mono">238, 242, 255</td><td className="mono">7, 5, 0, 0</td><td className="mono">—</td></tr>
          </tbody>
        </table>
        <h3 style={{ marginTop: 18 }}>Degradado de marca</h3>
        <div className="box grad" style={{ justifyContent: "space-between", color: "#fff", minHeight: 64 }}><span className="mono" style={{ color: "#fff" }}>#1B4FFF</span><span style={{ fontFamily: "stratos", fontWeight: 700 }}>135° · isotipo FLUX</span><span className="mono" style={{ color: "#fff" }}>#102F99</span></div>
        <h3 style={{ marginTop: 18 }}>Neutros</h3>
        <table>
          <thead><tr><th></th><th>Color</th><th>HEX</th><th>RGB</th><th>CMYK</th></tr></thead>
          <tbody>
            <tr><td><div className="sw" style={{ background: "#18191F" }} /></td><td><b>Ink</b><div className="muted">Titulares.</div></td><td className="mono">#18191F</td><td className="mono">24, 25, 31</td><td className="mono">23, 19, 0, 88</td></tr>
            <tr><td><div className="sw" style={{ background: "#333333" }} /></td><td><b>Text Dark</b><div className="muted">Cuerpo.</div></td><td className="mono">#333333</td><td className="mono">51, 51, 51</td><td className="mono">0, 0, 0, 80</td></tr>
            <tr><td><div className="sw" style={{ background: "#666666" }} /></td><td><b>Text Medium</b></td><td className="mono">#666666</td><td className="mono">102, 102, 102</td><td className="mono">0, 0, 0, 60</td></tr>
            <tr><td><div className="sw" style={{ background: "#999999" }} /></td><td><b>Text Light</b></td><td className="mono">#999999</td><td className="mono">153, 153, 153</td><td className="mono">0, 0, 0, 40</td></tr>
            <tr><td><div className="sw" style={{ background: "#E5E5E5" }} /></td><td><b>Border</b></td><td className="mono">#E5E5E5</td><td className="mono">229, 229, 229</td><td className="mono">0, 0, 0, 10</td></tr>
            <tr><td><div className="sw" style={{ background: "#F7F7F7", boxShadow: "inset 0 0 0 1px #E5E5E5" }} /></td><td><b>Surface</b></td><td className="mono">#F7F7F7</td><td className="mono">247, 247, 247</td><td className="mono">0, 0, 0, 3</td></tr>
          </tbody>
        </table>
      </div></section>

      {/* TIPOGRAFÍA */}
      <section id="tipografia"><div className="wrap">
        <div className="kick">07 · Tipografía</div>
        <h2 className="sec">Tipografía</h2>
        <p className="lead">Stratos para titulares (carácter de marca) e Inter para cuerpo e interfaz (legibilidad).</p>
        <div className="grid2">
          <div className="card">
            <div className="kick">Principal · Titulares</div>
            <div style={{ fontFamily: "stratos", fontWeight: 900, fontSize: 64, lineHeight: .9, color: "#18191F" }}>Stratos</div>
            <p className="muted" style={{ marginTop: 8 }}>Production Type. Geométrica, con carácter. H1–H3, números y frases destacadas.</p>
            <div style={{ fontFamily: "stratos", marginTop: 10, lineHeight: 1.4 }}>
              <div style={{ fontWeight: 600 }}>SemiBold 600 · Aa Bb 123</div>
              <div style={{ fontWeight: 700 }}>Bold 700 · Aa Bb 123</div>
              <div style={{ fontWeight: 900 }}>Black 900 · Aa Bb 123</div>
            </div>
          </div>
          <div className="card">
            <div className="kick">Secundaria · Cuerpo / UI</div>
            <div style={{ fontFamily: "Inter", fontWeight: 800, fontSize: 64, lineHeight: .9, color: "#18191F" }}>Inter</div>
            <p className="muted" style={{ marginTop: 8 }}>Google Fonts. Neutra y muy legible. Párrafos, botones, formularios, tablas.</p>
            <div style={{ fontFamily: "Inter", marginTop: 10, lineHeight: 1.5 }}>
              <div style={{ fontWeight: 400 }}>Regular 400 · Aa Bb 123</div>
              <div style={{ fontWeight: 600 }}>SemiBold 600 · Aa Bb 123</div>
              <div style={{ fontWeight: 700 }}>Bold 700 · Aa Bb 123</div>
            </div>
          </div>
        </div>
        <h3 style={{ marginTop: 20 }}>Jerarquía</h3>
        <table>
          <thead><tr><th>Nivel</th><th>Familia / peso</th><th>Uso</th></tr></thead>
          <tbody>
            <tr><td style={{ fontFamily: "stratos", fontWeight: 900, fontSize: 22 }}>H1</td><td>Stratos Black 900</td><td>Título de página / hero</td></tr>
            <tr><td style={{ fontFamily: "stratos", fontWeight: 700, fontSize: 18 }}>H2</td><td>Stratos Bold 700</td><td>Secciones</td></tr>
            <tr><td style={{ fontFamily: "stratos", fontWeight: 600, fontSize: 15 }}>H3</td><td>Stratos SemiBold 600</td><td>Subsecciones</td></tr>
            <tr><td style={{ fontFamily: "Inter", fontSize: 14 }}>Body</td><td>Inter Regular 400</td><td>Párrafos</td></tr>
            <tr><td style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 14, color: "#1B4FFF" }}>UI</td><td>Inter SemiBold 600</td><td>Botones, etiquetas</td></tr>
          </tbody>
        </table>
        <div className="card" style={{ marginTop: 16 }}><h3>Licencias</h3><ul>
          <li><b>Stratos</b>: web vía Adobe Fonts (kit FLUX). Impresión/escritorio requiere licencia desktop de Production Type. No redistribuir los archivos.</li>
          <li><b>Inter</b>: SIL Open Font License (libre).</li>
          <li>Fallback: si Stratos no carga, los titulares caen a Inter.</li>
        </ul></div>
      </div></section>

      {/* ELEMENTOS GRÁFICOS */}
      <section id="graficos"><div className="wrap">
        <div className="kick">08 · Sistema gráfico</div>
        <h2 className="sec">Elementos gráficos de apoyo</h2>
        <p className="lead">El sistema visual que acompaña al logo: iconos, ilustración, patrones, formas distintivas y adornos. Regla de oro: limpio, con aire, una o dos tintas.</p>

        <h3>Iconos · set de iconografía</h3>
        <div className="grid2" style={{ alignItems: "start" }}>
          <div className="card"><ul>
            <li>Estilo <b>line / outline</b>, trazo uniforme de <b>2px</b> (a 24px), esquinas redondeadas.</li>
            <li>Grid base <b>24×24</b>, área de seguridad de 2px.</li>
            <li>Una sola tinta: <b>#18191F</b> o <b>#1B4FFF</b> (verde solo en contexto Certified).</li>
            <li>Set recomendado: <b>Lucide / Feather</b> (coherente con la UI actual).</li>
          </ul></div>
          <div className="box" style={{ gap: 22 }}>
            {[
              <><rect x="2" y="4" width="20" height="14" rx="2" /><path d="M2 20h20" /></>,
              <><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></>,
              <><path d="M20 6 9 17l-5-5" /></>,
              <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
              <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></>,
            ].map((p, i) => (
              <svg key={i} width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={i === 1 ? "#1B4FFF" : "#18191F"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{p}</svg>
            ))}
          </div>
        </div>

        <h3 style={{ marginTop: 22 }}>Ilustraciones propias</h3>
        <div className="grid3">
          <div className="card"><p className="muted">Geométricas y planas, con el azul de marca y neutros. El <b>producto real</b> (MacBook) manda sobre la ilustración decorativa.</p></div>
          <div className="box grad" style={{ minHeight: 110 }}><img src="/images/isotipoflux.svg" alt="" style={{ height: 64, filter: "brightness(0) invert(1)" }} /></div>
          <div className="card"><p className="muted">Prohibido: 3D recargado, degradados arcoíris, clip-art genérico o sombras duras.</p></div>
        </div>

        <h3 style={{ marginTop: 22 }}>Patrones, texturas y fondos</h3>
        <div className="grid3">
          <div><div className="box grad" style={{ minHeight: 100 }} /><p className="muted" style={{ marginTop: 8 }}>Degradado 135° (#1B4FFF→#102F99). Hero y portadas.</p></div>
          <div><div className="box" style={{ minHeight: 100, overflow: "hidden", justifyContent: "flex-end" }}><img src="/images/isotipoflux.svg" alt="" style={{ height: 150, opacity: .06, transform: "translateX(16px)" }} /></div><p className="muted" style={{ marginTop: 8 }}>Isotipo gigante recortado al borde, baja opacidad.</p></div>
          <div><div className="box" style={{ minHeight: 100, background: "#F7F7F7" }} /><p className="muted" style={{ marginTop: 8 }}>Superficies planas y limpias (#F7F7F7). Sin ruido ni grunge.</p></div>
        </div>

        <h3 style={{ marginTop: 22 }}>Grafismos y formas distintivas</h3>
        <div className="grid2">
          <div className="card"><h3>La “F” en flecha (isotipo)</h3><p className="muted">El símbolo de FLUX —una F que sugiere movimiento/flujo— es la forma estrella. Puede usarse como sello, viñeta o recorte de imagen.</p><div className="box" style={{ marginTop: 8 }}><img src="/images/isotipoflux.svg" alt="" style={{ height: 70 }} /></div></div>
          <div className="card"><h3>El sello Certified</h3><p className="muted">El badge dentado verde es la forma distintiva de FLUX Certified. Úsalo como sello de “equipo certificado” sobre fotos de producto.</p><div className="box" style={{ marginTop: 8, background: "#F6FFF9" }}><img src="/images/fluxcertified.svg" alt="" style={{ height: 60 }} /></div></div>
        </div>

        <h3 style={{ marginTop: 22 }}>Marcos, líneas, viñetas y adornos</h3>
        <div className="grid3">
          <div className="card"><div style={{ height: 56, borderRadius: 16, border: "1.5px solid #E5E5E5" }} /><p className="muted" style={{ marginTop: 8 }}><b>Marcos / cards</b>: radio 12–16px, borde #E5E5E5, fondo blanco o #F7F7F7.</p></div>
          <div className="card"><div style={{ height: 56, display: "flex", alignItems: "center" }}><div style={{ height: 3, width: "100%", background: "#1B4FFF", borderRadius: 3 }} /></div><p className="muted" style={{ marginTop: 8 }}><b>Líneas / divisores</b>: finos en neutros; acento azul de 2–3px para subrayados.</p></div>
          <div className="card"><div style={{ height: 56, display: "flex", alignItems: "center", gap: 8 }}><span className="pill" style={{ background: "#EEF2FF", color: "#1B4FFF" }}>Chip</span><span className="pill" style={{ background: "#C9F8C6", color: "#06351f" }}>Certified</span></div><p className="muted" style={{ marginTop: 8 }}><b>Viñetas / chips</b>: “pill” redondeado, Stratos 700, tinta de marca según contexto.</p></div>
        </div>
      </div></section>

      {/* FOTOGRAFÍA */}
      <section id="foto"><div className="wrap">
        <div className="kick">09 · Fotografía</div>
        <h2 className="sec">Estilo fotográfico</h2>
        <p className="lead">Producto limpio, luz suave y fondos neutros. Premium pero real, nunca stock genérico.</p>
        <div className="grid3">
          <div className="card"><h3>Producto</h3><p className="muted">MacBook sobre blanco o #F7F7F7, luz difusa, sombra suave. Catálogo: 3/4, abierto ~100°, encuadre 16:9.</p></div>
          <div className="card"><h3>Lifestyle</h3><p className="muted">Personas reales trabajando, ambientes ordenados y luminosos. Acento azul. Sin poses forzadas.</p></div>
          <div className="card"><h3>Tratamiento</h3><p className="muted">Color natural, contraste suave. Nada de filtros saturados, viñetas duras ni HDR. Consistencia entre piezas.</p></div>
        </div>
      </div></section>

      {/* RETÍCULA */}
      <section id="reticula"><div className="wrap">
        <div className="kick">10 · Layout</div>
        <h2 className="sec">Retícula y uso del espacio</h2>
        <p className="lead">Composición ordenada, alineada a grilla, con generoso espacio en blanco. La marca respira.</p>
        <div className="grid2">
          <div className="card"><h3>Grilla</h3><ul><li>Web: <b>12 columnas</b>, gutter 24px, contenedor máx. ~1280px.</li><li>Alinea todo: títulos, texto, imágenes, botones.</li></ul><div className="box" style={{ gap: 4, padding: 14 }}>{Array.from({ length: 12 }).map((_, i) => <div key={i} style={{ flex: 1, height: 60, background: "#EEF2FF", borderRadius: 3 }} />)}</div></div>
          <div className="card"><h3>Espaciado</h3><ul><li>Escala en múltiplos de <b>4px</b> (4·8·12·16·24·32·48).</li><li>Radios 12–16px en cards y botones “pill”.</li><li>Jerarquía por tamaño y espacio, no por saturación de color.</li></ul></div>
        </div>
      </div></section>

      {/* FOOTER */}
      <section style={{ background: "#18191F", color: "#fff", borderBottom: "none" }}><div className="wrap" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div><img src="/images/logoflux-white.svg" alt="FLUX" style={{ height: 28, filter: "brightness(0) invert(1)" }} /><p style={{ color: "#fff", opacity: .6, fontSize: 13, marginTop: 10, maxWidth: 480 }}>¿Dudas sobre un uso que no está aquí? Consulta antes de publicar. La coherencia es lo que hace fuerte a la marca.</p></div>
        <div style={{ color: "#fff", opacity: .6, fontSize: 13 }}>Manual de Marca v1.0 · fluxperu.com</div>
      </div></section>
    </div>
  );
}
