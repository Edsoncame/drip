import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

interface ContractData {
  contractNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCompany: string;
  customerRuc: string | null;
  productName: string;
  months: number;
  monthlyPrice: number;
  appleCare: boolean;
  deliveryMethod: string;
  startDate: Date;
  endDate: Date;
}

const BLUE = rgb(0.106, 0.31, 1); // #1B4FFF
const BLACK = rgb(0.094, 0.098, 0.122);
const GRAY = rgb(0.4, 0.4, 0.4);

const RESIDUAL: Record<number, number> = { 8: 77.5, 16: 55, 24: 32.5 };

export async function generateContractPdf(data: ContractData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  const pageW = 595; // A4
  const pageH = 842;
  const contentW = pageW - margin * 2;

  let page = doc.addPage([pageW, pageH]);
  let y = pageH - margin;

  function addPage() {
    page = doc.addPage([pageW, pageH]);
    y = pageH - margin;
  }

  function text(t: string, opts: { size?: number; bold?: boolean; color?: typeof BLACK; indent?: number; maxWidth?: number } = {}) {
    const { size = 10, bold = false, color = BLACK, indent = 0, maxWidth = contentW - indent } = opts;
    const f = bold ? fontBold : font;

    // Word wrap
    const words = t.split(" ");
    let line = "";
    const lines: string[] = [];

    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (f.widthOfTextAtSize(test, size) > maxWidth) {
        if (line) lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);

    for (const l of lines) {
      if (y < margin + 30) addPage();
      page.drawText(l, { x: margin + indent, y, size, font: f, color });
      y -= size + 4;
    }
    y -= 2;
  }

  function spacer(h = 10) { y -= h; }

  function line() {
    page.drawLine({ start: { x: margin, y }, end: { x: pageW - margin, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
    y -= 10;
  }

  function row(label: string, value: string) {
    if (y < margin + 30) addPage();
    page.drawText(label, { x: margin, y, size: 9, font, color: GRAY });
    page.drawText(value, { x: margin + 180, y, size: 9, font: fontBold, color: BLACK });
    y -= 16;
  }

  // ── Header ──
  text("FLUX", { size: 24, bold: true, color: BLUE });
  text("CONTRATO DE ARRENDAMIENTO OPERATIVO DE EQUIPO APPLE", { size: 11, bold: true });
  spacer(5);
  text(`Contrato N.° ${data.contractNumber}`, { size: 9, color: GRAY });
  text(`Fecha de emisión: ${data.startDate.toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" })}`, { size: 9, color: GRAY });
  spacer(10);
  line();

  // ── Partes ──
  text("1. PARTES", { size: 11, bold: true, color: BLUE });
  spacer(5);
  text("ARRENDADOR:", { size: 9, bold: true });
  row("Razón social", "Tika Services S.A.C.");
  row("RUC", "20605702512");
  row("Nombre comercial", "FLUX");
  spacer(5);
  text("ARRENDATARIO:", { size: 9, bold: true });
  row("Nombre / Razón social", data.customerName);
  row("Empresa", data.customerCompany);
  if (data.customerRuc) row("RUC", data.customerRuc);
  row("Correo electrónico", data.customerEmail);
  row("Teléfono", data.customerPhone);
  spacer(5);
  line();

  // ── Equipo ──
  text("2. EQUIPO ARRENDADO", { size: 11, bold: true, color: BLUE });
  spacer(5);
  row("Modelo", data.productName);
  row("AppleCare+", data.appleCare ? "Sí — incluido" : "No");
  row("Método de entrega", data.deliveryMethod === "pickup" ? "Recojo en oficina" : "Envío a domicilio (Lima)");
  spacer(5);
  line();

  // ── Condiciones ──
  text("3. CONDICIONES ECONÓMICAS", { size: 11, bold: true, color: BLUE });
  spacer(5);
  row("Plazo del contrato", `${data.months} meses`);
  row("Renta mensual", `USD $${data.monthlyPrice.toFixed(2)}`);
  row("Total del contrato", `USD $${(data.monthlyPrice * data.months).toFixed(2)}`);
  row("Fecha de inicio", data.startDate.toLocaleDateString("es-PE"));
  row("Fecha de vencimiento", data.endDate.toLocaleDateString("es-PE"));
  row("Valor residual al vencimiento", `${RESIDUAL[data.months] ?? 32.5}% del valor original`);
  row("Depósito de garantía", "No se requiere");
  spacer(5);
  line();

  // ── Cláusulas resumidas ──
  text("4. TÉRMINOS PRINCIPALES", { size: 11, bold: true, color: BLUE });
  spacer(5);

  const clauses = [
    "4.1. El equipo es propiedad exclusiva de Tika Services S.A.C. durante la vigencia del contrato.",
    "4.2. El cobro se realiza automáticamente cada mes mediante el método de pago registrado.",
    "4.3. El arrendatario se compromete a usar el equipo de forma responsable y no cederlo a terceros.",
    "4.4. En caso de daño, pérdida o robo, el arrendatario asume el costo de reparación o el valor residual.",
    `4.5. Al finalizar el plazo, el arrendatario puede: (a) devolver el equipo sin costo; (b) comprar el equipo al ${RESIDUAL[data.months] ?? 32.5}% del valor original.`,
    "4.6. La cancelación anticipada requiere 30 días de aviso y una penalidad de 2 meses de renta.",
    "4.7. Los términos completos están disponibles en fluxperu.com/terminos y fueron aceptados digitalmente por el arrendatario al completar el proceso de contratación.",
  ];

  for (const c of clauses) {
    text(c, { size: 9, indent: 10 });
    spacer(3);
  }

  line();

  // ── Ley aplicable ──
  text("5. LEGISLACIÓN APLICABLE", { size: 11, bold: true, color: BLUE });
  spacer(5);
  text("Este contrato se rige por las leyes de la República del Perú, en particular el Código Civil (Libro VII, Título VI — Arrendamiento) y la Ley N.° 29571 (Código de Protección y Defensa del Consumidor). Las controversias se someten a los juzgados del distrito judicial de Lima.", { size: 9 });
  spacer(10);
  line();

  // ── Aceptación digital ──
  text("6. ACEPTACIÓN DIGITAL", { size: 11, bold: true, color: BLUE });
  spacer(5);
  text(`El arrendatario ${data.customerName} aceptó estos términos digitalmente al completar el pago el ${data.startDate.toLocaleDateString("es-PE")} a las ${data.startDate.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}, conforme a la Ley N.° 27291 y el D.L. N.° 1412.`, { size: 9 });
  spacer(10);

  text(`Correo registrado: ${data.customerEmail}`, { size: 9, color: GRAY });
  spacer(20);

  // ── Footer ──
  text("FLUX — Tika Services S.A.C. | RUC 20605702512 | fluxperu.com | hola@fluxperu.com", { size: 7, color: GRAY });

  return doc.save();
}
