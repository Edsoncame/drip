import { NextRequest, NextResponse } from "next/server";

/**
 * Verifica RUC en SUNAT usando la API pública de apis.net.pe.
 * Retorna: razón social, estado (ACTIVO/BAJA), condición (HABIDO/NO HABIDO).
 *
 * 2026-09-24 — la v2 pasó a exigir token (`Invalid token https://decolecta.com`)
 * y devolvía 401 para todo RUC. El código traducía cualquier fallo a "RUC no
 * encontrado en SUNAT", así que registro, checkout y el formulario de empresas
 * marcaban en rojo hasta el RUC de la propia Tika Services. Ahora:
 *
 *  - con `APIS_NET_PE_TOKEN` seteado usamos la v2 (con Bearer);
 *  - sin token, o si la v2 falla, caemos a la v1, que sigue abierta;
 *  - y separamos "no pudimos consultar" de "el RUC no está activo", porque
 *    al cliente no se le puede decir que su RUC está mal cuando el problema
 *    es nuestro.
 */

interface SunatData {
  razonSocial: string;
  numeroDocumento: string;
  estado: string;
  condicion: string;
  direccion?: string;
  distrito?: string;
}

async function fetchV2(ruc: string, token: string): Promise<SunatData | null> {
  const res = await fetch(`https://api.apis.net.pe/v2/sunat/ruc?numero=${ruc}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  const d = await res.json();
  if (!d?.numeroDocumento) return null;
  return {
    razonSocial: d.razonSocial,
    numeroDocumento: d.numeroDocumento,
    estado: d.estado,
    condicion: d.condicion,
    direccion: d.direccion,
    distrito: d.distrito,
  };
}

async function fetchV1(ruc: string): Promise<SunatData | null> {
  const res = await fetch(`https://api.apis.net.pe/v1/ruc?numero=${ruc}`, {
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  const d = await res.json();
  if (!d?.numeroDocumento) return null;
  // La v1 llama "nombre" a lo que la v2 llama "razonSocial".
  return {
    razonSocial: d.nombre ?? d.razonSocial,
    numeroDocumento: d.numeroDocumento,
    estado: d.estado,
    condicion: d.condicion,
    direccion: d.direccion,
    distrito: d.distrito,
  };
}

export async function GET(req: NextRequest) {
  const ruc = req.nextUrl.searchParams.get("ruc");

  if (!ruc || !/^\d{11}$/.test(ruc)) {
    return NextResponse.json({ error: "RUC debe tener 11 dígitos" }, { status: 400 });
  }

  let data: SunatData | null = null;
  const token = process.env.APIS_NET_PE_TOKEN;

  try {
    if (token) {
      data = await fetchV2(ruc, token).catch(() => null);
    }
    if (!data) data = await fetchV1(ruc);
  } catch (err) {
    console.error("[verify-ruc] consulta fallida:", err);
    return NextResponse.json({
      valid: false,
      unavailable: true,
      error: "No pudimos consultar SUNAT en este momento",
    });
  }

  if (!data) {
    // Puede ser un RUC inexistente o que la fuente esté caída: no afirmamos
    // que el RUC esté mal sin poder comprobarlo.
    return NextResponse.json({
      valid: false,
      unavailable: true,
      error: "No pudimos consultar SUNAT en este momento",
    });
  }

  const isActive = data.estado === "ACTIVO" && data.condicion === "HABIDO";

  return NextResponse.json({
    valid: isActive,
    unavailable: false,
    ruc: data.numeroDocumento,
    razonSocial: data.razonSocial,
    estado: data.estado,
    condicion: data.condicion,
    direccion: data.direccion,
    distrito: data.distrito,
  });
}
