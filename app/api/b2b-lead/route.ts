import { NextRequest, NextResponse } from "next/server";
import { sendB2BLeadEmail } from "@/lib/email";

const tag = "[b2b-lead]";

export async function POST(req: NextRequest) {
  try {
    const { name, email, company, phone, quantity, message } = await req.json();

    if (!name?.trim() || !company?.trim()) {
      return NextResponse.json({ error: "Nombre y empresa son requeridos." }, { status: 400 });
    }
    if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email inválido." }, { status: 400 });
    }

    await sendB2BLeadEmail({
      nombre: name.trim(),
      empresa: company.trim(),
      email: email.trim().toLowerCase(),
      telefono: phone?.trim() ?? "",
      cantidad: quantity ?? "1-5",
      modelo: "Por definir",
      mensaje: message?.trim() ?? "",
    });

    console.log(`${tag} lead from ${email} — ${company} (${quantity ?? "1-5"} units)`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`${tag} error`, err);
    return NextResponse.json({ error: "No se pudo enviar la solicitud." }, { status: 500 });
  }
}
