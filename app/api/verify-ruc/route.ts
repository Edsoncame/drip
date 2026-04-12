import { NextRequest, NextResponse } from "next/server";

/**
 * Verifica RUC en SUNAT usando API pública apis.net.pe
 * Retorna: razón social, estado (ACTIVO/BAJA), condición (HABIDO/NO HABIDO)
 */
export async function GET(req: NextRequest) {
  const ruc = req.nextUrl.searchParams.get("ruc");

  if (!ruc || !/^\d{11}$/.test(ruc)) {
    return NextResponse.json({ error: "RUC debe tener 11 dígitos" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://api.apis.net.pe/v2/sunat/ruc?numero=${ruc}`,
      { next: { revalidate: 86400 } } // cache 24h
    );

    if (!res.ok) {
      return NextResponse.json({ valid: false, error: "RUC no encontrado en SUNAT" });
    }

    const data = await res.json() as {
      numeroDocumento: string;
      razonSocial: string;
      estado: string;      // "ACTIVO" | "BAJA DE OFICIO" etc
      condicion: string;   // "HABIDO" | "NO HABIDO"
      direccion: string;
      ubigeo: string;
      departamento: string;
      provincia: string;
      distrito: string;
    };

    const isActive = data.estado === "ACTIVO" && data.condicion === "HABIDO";

    return NextResponse.json({
      valid: isActive,
      ruc: data.numeroDocumento,
      razonSocial: data.razonSocial,
      estado: data.estado,
      condicion: data.condicion,
      direccion: data.direccion,
      distrito: data.distrito,
    });
  } catch {
    return NextResponse.json({ valid: false, error: "Error al consultar SUNAT" });
  }
}
