import { NextRequest, NextResponse } from "next/server";
import { sendB2BLeadEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { name, email, company, phone, quantity, message } = await req.json();

    if (!name?.trim() || !email?.trim() || !company?.trim()) {
      return NextResponse.json({ error: "Nombre, email y empresa son requeridos." }, { status: 400 });
    }

    await sendB2BLeadEmail({
      nombre: name,
      empresa: company,
      email,
      telefono: phone ?? "",
      cantidad: quantity ?? "1-5",
      modelo: "Por definir",
      mensaje: message ?? "",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("b2b-lead error:", err);
    return NextResponse.json({ error: "No se pudo enviar la solicitud." }, { status: 500 });
  }
}
