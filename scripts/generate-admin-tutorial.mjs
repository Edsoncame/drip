// Generates a simple PDF tutorial for the Flux admin panel.
// Run: node scripts/generate-admin-tutorial.mjs
// Output: /Users/securex07/Downloads/flux-tutorial-admin.pdf

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "node:fs";
import path from "node:path";

const FLUX_BLUE = rgb(0.106, 0.310, 1);      // #1B4FFF
const DARK     = rgb(0.094, 0.098, 0.122);   // #18191F
const GRAY     = rgb(0.4, 0.4, 0.4);
const LIGHT    = rgb(0.6, 0.6, 0.6);
const BG_CARD  = rgb(0.963, 0.969, 1);       // #F5F8FF
const BG_WARN  = rgb(1, 0.973, 0.922);       // #FFFBEB

const PAGE_W = 595.28;  // A4
const PAGE_H = 841.89;
const MARGIN = 56;

async function main() {
  const doc = await PDFDocument.create();
  doc.setTitle("Tutorial Admin FLUX");
  doc.setAuthor("FLUX");
  doc.setCreator("FLUX Admin Panel");

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold    = await doc.embedFont(StandardFonts.HelveticaBold);

  // ========================================================================
  // Helpers
  // ========================================================================
  const ctx = { page: null, y: 0 };

  function newPage() {
    ctx.page = doc.addPage([PAGE_W, PAGE_H]);
    ctx.y = PAGE_H - MARGIN;
    return ctx.page;
  }

  function ensureSpace(h) {
    if (ctx.y - h < MARGIN) newPage();
  }

  function drawText(text, opts = {}) {
    const {
      size = 11,
      font = regular,
      color = DARK,
      x = MARGIN,
      maxWidth = PAGE_W - MARGIN * 2,
      lineGap = 4,
    } = opts;
    const lines = wrapText(text, font, size, maxWidth);
    for (const line of lines) {
      ensureSpace(size + lineGap);
      ctx.page.drawText(line, { x, y: ctx.y - size, size, font, color });
      ctx.y -= size + lineGap;
    }
  }

  function wrapText(text, font, size, maxWidth) {
    const words = text.split(" ");
    const lines = [];
    let current = "";
    for (const w of words) {
      const test = current ? current + " " + w : w;
      if (font.widthOfTextAtSize(test, size) > maxWidth) {
        if (current) lines.push(current);
        current = w;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  function space(n = 10) {
    ctx.y -= n;
  }

  function h1(text) {
    ensureSpace(32);
    ctx.page.drawText(text, { x: MARGIN, y: ctx.y - 26, size: 26, font: bold, color: FLUX_BLUE });
    ctx.y -= 32;
  }

  function h2(text, icon = "") {
    space(8);
    ensureSpace(22);
    ctx.page.drawText(`${icon}${icon ? " " : ""}${text}`, {
      x: MARGIN, y: ctx.y - 18, size: 18, font: bold, color: DARK,
    });
    ctx.y -= 22;
    // underline
    ctx.page.drawRectangle({
      x: MARGIN, y: ctx.y, width: 40, height: 2, color: FLUX_BLUE,
    });
    ctx.y -= 10;
  }

  function h3(text) {
    space(4);
    ensureSpace(16);
    ctx.page.drawText(text, {
      x: MARGIN, y: ctx.y - 13, size: 13, font: bold, color: FLUX_BLUE,
    });
    ctx.y -= 18;
  }

  function paragraph(text) {
    drawText(text, { size: 11, color: DARK, lineGap: 5 });
    space(6);
  }

  function bullet(text) {
    const bulletX = MARGIN + 4;
    const textX = MARGIN + 18;
    ensureSpace(14);
    ctx.page.drawCircle({ x: bulletX + 2, y: ctx.y - 6, size: 2, color: FLUX_BLUE });
    drawText(text, { size: 11, x: textX, maxWidth: PAGE_W - textX - MARGIN, lineGap: 4 });
    space(2);
  }

  function step(number, text) {
    const circleX = MARGIN + 10;
    const textX = MARGIN + 30;
    ensureSpace(20);
    ctx.page.drawCircle({ x: circleX, y: ctx.y - 8, size: 9, color: FLUX_BLUE });
    ctx.page.drawText(String(number), {
      x: circleX - (number >= 10 ? 5 : 2.5),
      y: ctx.y - 11,
      size: 10,
      font: bold,
      color: rgb(1, 1, 1),
    });
    drawText(text, { size: 11, x: textX, maxWidth: PAGE_W - textX - MARGIN, lineGap: 4 });
    space(3);
  }

  function note(text) {
    space(4);
    const lines = wrapText(text, regular, 10, PAGE_W - MARGIN * 2 - 24);
    const boxH = lines.length * 14 + 16;
    ensureSpace(boxH + 10);
    ctx.page.drawRectangle({
      x: MARGIN, y: ctx.y - boxH, width: PAGE_W - MARGIN * 2, height: boxH,
      color: BG_WARN,
    });
    let cy = ctx.y - 16;
    for (const line of lines) {
      ctx.page.drawText(line, { x: MARGIN + 12, y: cy, size: 10, font: regular, color: DARK });
      cy -= 14;
    }
    ctx.y -= boxH + 8;
  }

  function card(title, lines) {
    const pad = 14;
    const titleSize = 12;
    const lineSize = 10;
    const lineH = 14;
    const contentH = titleSize + 8 + lines.length * lineH;
    const boxH = contentH + pad * 2;
    ensureSpace(boxH + 10);
    ctx.page.drawRectangle({
      x: MARGIN, y: ctx.y - boxH, width: PAGE_W - MARGIN * 2, height: boxH,
      color: BG_CARD,
    });
    let cy = ctx.y - pad - titleSize;
    ctx.page.drawText(title, { x: MARGIN + pad, y: cy, size: titleSize, font: bold, color: FLUX_BLUE });
    cy -= 10;
    for (const line of lines) {
      cy -= lineH;
      ctx.page.drawText(line, { x: MARGIN + pad, y: cy, size: lineSize, font: regular, color: DARK });
    }
    ctx.y -= boxH + 8;
  }

  // ========================================================================
  // COVER PAGE
  // ========================================================================
  newPage();
  // Big blue header block
  ctx.page.drawRectangle({
    x: 0, y: PAGE_H - 280, width: PAGE_W, height: 280, color: FLUX_BLUE,
  });

  ctx.page.drawText("flux", {
    x: MARGIN, y: PAGE_H - 110, size: 48, font: bold, color: rgb(1, 1, 1),
  });

  ctx.page.drawText("Tutorial del Panel Admin", {
    x: MARGIN, y: PAGE_H - 170, size: 28, font: bold, color: rgb(1, 1, 1),
  });

  ctx.page.drawText("Guía paso a paso para el equipo FLUX", {
    x: MARGIN, y: PAGE_H - 200, size: 14, font: regular, color: rgb(0.85, 0.9, 1),
  });

  ctx.y = PAGE_H - 340;
  drawText("Bienvenido a FLUX", { size: 20, font: bold, color: DARK });
  space(12);
  drawText(
    "Este tutorial te va a enseñar paso a paso cómo usar el panel de administración " +
    "de FLUX. Vas a aprender a revisar rentas, validar pagos, subir facturas, ver el " +
    "inventario de equipos y controlar los pagos a bancos.",
    { size: 12, color: GRAY, lineGap: 6 }
  );
  space(16);

  card("¿Para quién es esta guía?", [
    "Luis Roque Ricse  —  Contador",
    "",
    "Rol: Administrador",
    "Email: lroquericse@fluxperu.com",
    "Panel: fluxperu.com/admin",
  ]);

  space(20);
  h3("Contenido del tutorial");
  bullet("Cómo entrar al panel admin");
  bullet("Entender el dashboard de rentas");
  bullet("Ver y buscar clientes");
  bullet("Validar pagos y subir comprobantes");
  bullet("Subir facturas SUNAT");
  bullet("Revisar inventario de equipos");
  bullet("Finanzas: pagos a bancos (para contador)");
  bullet("Tips útiles y contacto");

  // ========================================================================
  // PAGE 2 — Cómo entrar
  // ========================================================================
  newPage();
  h1("1. Cómo entrar al panel");

  paragraph("Para acceder al panel de administración de FLUX necesitas tu email y contraseña. Sigue estos pasos:");

  step(1, "Abre tu navegador (Chrome, Safari, etc.) y ve a: www.fluxperu.com");
  step(2, "Arriba a la derecha haz clic en 'Iniciar sesión'.");
  step(3, "Escribe tu email: lroquericse@fluxperu.com");
  step(4, "Escribe tu contraseña (la que te dieron al crear tu cuenta).");
  step(5, "Haz clic en 'Iniciar sesión'.");
  step(6, "Una vez adentro, en la barra de la dirección escribe: www.fluxperu.com/admin y presiona Enter.");

  note("Si no recuerdas tu contraseña, usa el link 'Olvidaste tu contraseña' en la pantalla de login. Te llegará un correo para cambiarla.");

  h3("La barra de menú del admin");
  paragraph("Arriba vas a ver estas secciones. Cada una hace algo diferente:");
  bullet("Rentas — ver todas las rentas activas");
  bullet("Clientes — base de datos de clientes");
  bullet("Pagos — validar pagos y subir facturas");
  bullet("Inventario — ver todos los equipos");
  bullet("Finanzas — cuotas que tenemos que pagar a bancos");
  bullet("Precios — calculadora de precios de alquiler");
  bullet("Usuarios — administradores del panel");

  // ========================================================================
  // PAGE — Dashboard
  // ========================================================================
  newPage();
  h1("2. Dashboard de Rentas");

  paragraph("Cuando entras al admin, lo primero que ves es el dashboard con todas las rentas. Arriba aparecen tarjetas con números:");

  bullet("Rentas activas — cuántas Macs están alquiladas ahora");
  bullet("MRR — ingreso mensual recurrente");
  bullet("Total usuarios — cuántos clientes tenemos");
  bullet("Por entregar — equipos listos para despachar");

  h3("Tabla de rentas");
  paragraph("Abajo aparece una lista de todas las rentas. Cada fila muestra:");
  bullet("Nombre del cliente");
  bullet("Producto (MacBook Air, MacBook Pro, etc.)");
  bullet("Plan en meses y precio mensual");
  bullet("Estado (Activo, Entregado, Pausado, etc.)");
  bullet("Botones de acción");

  h3("Filtros arriba de la tabla");
  paragraph("Puedes filtrar por estado haciendo clic en las pastillas: Todos, Activos, Despachados, Entregados, Pausados, Cancelados, Completados.");

  note("No cancelamos una renta sin antes hablar con el cliente. El botón 'Cancelar' solo se usa con autorización.");

  // ========================================================================
  // PAGE — Clientes
  // ========================================================================
  newPage();
  h1("3. Clientes");

  paragraph("En la sección Clientes ves a todos los usuarios registrados en FLUX. Puedes buscar, filtrar y ver el detalle de cada uno.");

  h3("Cómo buscar un cliente");
  step(1, "Haz clic en 'Clientes' en la barra del admin.");
  step(2, "En el buscador escribe el nombre, email, empresa o RUC.");
  step(3, "Los resultados se filtran automáticamente mientras escribes.");
  step(4, "Haz clic en la fila del cliente para abrir su detalle completo.");

  h3("Qué ves al abrir un cliente");
  bullet("Datos de contacto: nombre, email, teléfono, empresa, RUC");
  bullet("Dirección de entrega y distrito");
  bullet("Todas sus suscripciones con fechas y estados");
  bullet("Todos sus pagos con estado (pagado, pendiente, vencido)");
  bullet("Botones rápidos: WhatsApp, Email, Verificar ID");

  h3("Exportar a CSV");
  paragraph("Arriba a la derecha hay un botón negro 'CSV'. Al hacer clic, descarga un archivo Excel con todos los clientes. Útil para análisis o reportes.");

  // ========================================================================
  // PAGE — Pagos (IMPORTANT)
  // ========================================================================
  newPage();
  h1("4. Pagos (importante para ti)");

  paragraph("Esta es la sección más importante para ti como contador. Aquí validas los pagos que hacen los clientes y subes las facturas SUNAT.");

  h3("Qué ves en Pagos");
  paragraph("Una lista de todos los pagos organizada por estado: Pendiente, Por revisar, Validado, Vencido.");

  h3("Cuando un cliente sube un comprobante de transferencia");
  step(1, "El pago aparece en estado 'Por revisar' con fondo azul.");
  step(2, "Haz clic en la fila para expandirla.");
  step(3, "Verás la imagen del comprobante. Ábrela y revisa que el monto coincida.");
  step(4, "Si todo está bien, haz clic en el botón verde 'Validar pago'.");
  step(5, "Si hay algo mal, haz clic en 'Rechazar comprobante' y ponle una nota.");

  note("Antes de validar SIEMPRE revisa el monto, la fecha y que el banco destino sea BCP Flux o Scotia Flux. Si no coincide, rechaza.");

  h3("Cuando el cliente NO sube comprobante");
  paragraph("A veces el cliente paga pero no sube comprobante. Tú puedes:");
  bullet("Subir el comprobante manualmente (botón 'Subir comprobante').");
  bullet("Marcar el pago como pagado directamente (botón 'Marcar como pagado').");
  bullet("Enviar recordatorio por WhatsApp (botón verde de WhatsApp).");

  // ========================================================================
  // PAGE — Facturas SUNAT
  // ========================================================================
  newPage();
  h1("5. Subir facturas SUNAT");

  paragraph("Una vez que validas un pago, tienes que emitir la factura electrónica en SUNAT y subirla al sistema.");

  h3("Paso a paso para subir una factura");
  step(1, "Entra a SUNAT SOL (www.sunat.gob.pe) con las credenciales de FLUX.");
  step(2, "Emite la factura con el monto del pago y descarga el PDF.");
  step(3, "Vuelve al panel admin de FLUX -> Pagos.");
  step(4, "Busca el pago y expande la fila.");
  step(5, "Al final verás la sección 'Facturas SUNAT'.");
  step(6, "Escribe el número de la factura (ejemplo: F001-00123).");
  step(7, "Haz clic en 'Subir PDF' y selecciona el PDF descargado de SUNAT.");
  step(8, "Haz clic en 'Guardar'.");

  note("Un pago puede tener varias facturas si es necesario. Por ejemplo, si un cliente pide que dividas el monto en 2 facturas distintas, puedes subir las dos. La suma debe dar el monto total del pago.");

  h3("¿Cómo sabe el cliente que ya emitimos su factura?");
  paragraph("Automáticamente le llega un correo con el link para descargar la factura. Además, desde su panel 'Mis pagos' puede ver todas sus facturas.");

  // ========================================================================
  // PAGE — Inventario
  // ========================================================================
  newPage();
  h1("6. Inventario");

  paragraph("Aquí están todos los equipos (MacBooks) que FLUX tiene, con todos sus datos: código, número de serie, cliente actual, costo de compra, etc.");

  h3("Qué muestra la tabla");
  bullet("Código interno (ejemplo: TKA-MACAIR-M4-001)");
  bullet("Modelo (MacBook Air 13 M4, etc.)");
  bullet("Estado: Disponible, Arrendada, Mantenimiento");
  bullet("Cliente actual");
  bullet("Tarifa mensual y OPEX");
  bullet("Costo de compra");
  bullet("Financiamiento (banco/tarjeta + tasa)");
  bullet("Mantenimiento próximo");
  bullet("ROI (rentabilidad)");

  h3("Cómo editar un equipo");
  step(1, "Haz clic en el botón 'Editar' al final de la fila.");
  step(2, "Se abre un modal con todos los campos del equipo.");
  step(3, "Modifica los campos que necesites.");
  step(4, "Para la factura del equipo o la foto del vault, haz clic en 'Subir archivo' y selecciona el PDF o imagen desde tu computadora.");
  step(5, "Haz clic en 'Guardar cambios'.");

  note("Los archivos que subes (facturas del proveedor, foto del vault) se guardan de forma segura y solo los ve el equipo admin.");

  // ========================================================================
  // PAGE — Finanzas
  // ========================================================================
  newPage();
  h1("7. Finanzas (para el contador)");

  paragraph("Esta sección es especialmente para ti. Te muestra todas las cuotas que FLUX tiene que pagar a bancos y tarjetas por los equipos que compramos a crédito.");

  h3("Las 4 tarjetas de arriba");
  bullet("A pagar este mes — total de cuotas activas este mes");
  bullet("Ya pagado a la fecha — cuánto hemos pagado hasta hoy");
  bullet("Deuda pendiente — lo que todavía debemos");
  bullet("Equipos con financiamiento activo — cuántos siguen pagándose");

  h3("Tablas por banco/tarjeta");
  paragraph("Abajo encuentras las cuotas agrupadas por dónde las pagamos:");
  bullet("Tarjeta BCP (Enrique)");
  bullet("Tarjeta Scotia (Edson)");
  bullet("Préstamo Edson");

  paragraph("En cada grupo ves: cuota mensual del grupo, ya pagado, pendiente. Y dentro, la lista de equipos con: código, modelo, cuota, plazo, pagado (X de Y), restante, próximo pago y link a la factura.");

  note("Cada mes revisa esta sección al inicio del mes. Te dice exactamente cuánto tenemos que pagar a cada banco/tarjeta. Así planificas los pagos sin olvidarte de ninguno.");

  h3("Fechas de vencimiento");
  paragraph("La primera cuota de un equipo se paga el mes siguiente a la fecha de compra. Por ejemplo, si compramos un equipo el 23 de octubre, la primera cuota vence el 23 de noviembre. Y así sucesivamente hasta completar el plazo.");

  // ========================================================================
  // PAGE — Tips + contacto
  // ========================================================================
  newPage();
  h1("8. Tips útiles");

  h3("Cada día");
  bullet("Revisa Pagos para ver si hay comprobantes nuevos por validar.");
  bullet("Si un pago está 'Vencido' (rojo), manda recordatorio por WhatsApp.");

  h3("Cada semana");
  bullet("Revisa Clientes nuevos y valida su identidad (si subieron DNI).");
  bullet("Revisa que todas las facturas SUNAT del mes estén subidas.");

  h3("Cada mes");
  bullet("Entra a Finanzas el día 1 y revisa las cuotas a pagar.");
  bullet("Exporta el CSV de Clientes para tener backup.");
  bullet("Revisa el dashboard de Rentas para ver el MRR actualizado.");

  h3("Cosas que NUNCA debes hacer");
  bullet("No borres clientes ni rentas sin hablar antes con Edson.");
  bullet("No validates un pago sin revisar el comprobante.");
  bullet("No compartas tu contraseña con nadie.");
  bullet("No uses el mismo panel desde computadoras públicas.");

  space(16);
  h2("¿Necesitas ayuda?");
  paragraph("Si tienes dudas o algo no funciona, contáctame:");

  card("Contacto de soporte", [
    "Edson Campaña — Super Admin",
    "",
    "Email: edsoncame@fluxperu.com",
    "WhatsApp: (el número que ya tienes)",
    "",
    "Horario: Lunes a Viernes 9am - 6pm",
  ]);

  space(10);
  paragraph("¡Bienvenido al equipo FLUX! ");

  // ========================================================================
  // Add footers to all pages
  // ========================================================================
  const pages = doc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    if (i === 0) continue; // skip cover
    p.drawText(`FLUX — Tutorial Admin  ·  Página ${i + 1} de ${pages.length}`, {
      x: MARGIN, y: 28, size: 9, font: regular, color: LIGHT,
    });
  }

  // Save
  const pdfBytes = await doc.save();
  const outPath = path.join(process.env.HOME || ".", "Downloads", "flux-tutorial-admin.pdf");
  fs.writeFileSync(outPath, pdfBytes);
  console.log(`✓ PDF generated: ${outPath}`);
  console.log(`  Pages: ${pages.length}`);
  console.log(`  Size:  ${(pdfBytes.length / 1024).toFixed(1)} KB`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
