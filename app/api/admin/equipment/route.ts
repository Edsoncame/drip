import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { fireSyncCatalog } from "@/lib/dropchat-catalog";

async function checkAdmin() {
  return await requireAdmin();
}

export async function GET() {
  if (!await checkAdmin()) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const result = await query(`SELECT * FROM equipment ORDER BY codigo_interno`);
  return NextResponse.json({ equipment: result.rows });
}

export async function POST(req: NextRequest) {
  if (!await checkAdmin()) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const {
    codigo_interno, marca, modelo_completo, chip, ram, ssd, color, teclado,
    numero_serie, proveedor, factura_url, web_url, fecha_compra, mantenimiento_proximo,
    precio_compra_usd, tipo_cambio, valor_soles, tipo_financiamiento, tasa_pct,
    plazo_credito_meses, cuota_credito_soles, estado_actual, cliente_actual,
    tipo_arriendo_meses, inicio_alquiler, fin_alquiler, tarifa_usd, opex_usd,
    ingreso_neto_mensual_usd, valor_residual_usd, ingreso_total_proyectado_usd,
    rentabilidad_pct, seguro, garantia_anos, ubicacion_fisica, responsable,
    usuario_dispositivo, clave_dispositivo, clave_vault, clave_vault_url, observaciones,
    colaborador, compra_status, compra_notas, compra_inicio, tipo_renta, meses_uso_previo, area,
  } = body;

  if (!codigo_interno || !modelo_completo) {
    return NextResponse.json({ error: "Código interno y modelo son requeridos" }, { status: 400 });
  }

  const result = await query(
    `INSERT INTO equipment (
      codigo_interno, marca, modelo_completo, chip, ram, ssd, color, teclado,
      numero_serie, proveedor, factura_url, web_url, fecha_compra, mantenimiento_proximo,
      precio_compra_usd, tipo_cambio, valor_soles, tipo_financiamiento, tasa_pct,
      plazo_credito_meses, cuota_credito_soles, estado_actual, cliente_actual,
      tipo_arriendo_meses, inicio_alquiler, fin_alquiler, tarifa_usd, opex_usd,
      ingreso_neto_mensual_usd, valor_residual_usd, ingreso_total_proyectado_usd,
      rentabilidad_pct, seguro, garantia_anos, ubicacion_fisica, responsable,
      usuario_dispositivo, clave_dispositivo, clave_vault, clave_vault_url, observaciones,
      colaborador, compra_status, compra_notas, compra_inicio, tipo_renta, meses_uso_previo, area
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
              $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,
              $41,$42,$43,$44,$45,$46,$47)
    RETURNING *`,
    [
      codigo_interno, marca || 'Apple', modelo_completo, chip, ram, ssd, color, teclado,
      numero_serie || null, proveedor, factura_url || null, web_url || null,
      fecha_compra || null, mantenimiento_proximo || null,
      precio_compra_usd || null, tipo_cambio || 3.39, valor_soles || null,
      tipo_financiamiento, tasa_pct || null, plazo_credito_meses || null, cuota_credito_soles || null,
      estado_actual || 'Disponible', cliente_actual || null,
      tipo_arriendo_meses || null, inicio_alquiler || null, fin_alquiler || null,
      tarifa_usd || null, opex_usd || null, ingreso_neto_mensual_usd || null,
      valor_residual_usd || null, ingreso_total_proyectado_usd || null, rentabilidad_pct || null,
      seguro || null, garantia_anos || null, ubicacion_fisica || null, responsable || null,
      usuario_dispositivo || null, clave_dispositivo || null, clave_vault || null, clave_vault_url || null,
      observaciones || null,
      colaborador || null, compra_status || 'no_desea', compra_notas || null, compra_inicio || null,
      tipo_renta || 'estreno', meses_uso_previo || 0, area || null,
    ]
  );

  return NextResponse.json({ equipment: result.rows[0] }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  if (!await checkAdmin()) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const allowed = [
    'codigo_interno','marca','modelo_completo','chip','ram','ssd','color','teclado',
    'numero_serie','proveedor','factura_url','web_url','fecha_compra','mantenimiento_proximo',
    'precio_compra_usd','tipo_cambio','valor_soles','tipo_financiamiento','tasa_pct',
    'plazo_credito_meses','cuota_credito_soles','estado_actual','cliente_actual',
    'tipo_arriendo_meses','inicio_alquiler','fin_alquiler','tarifa_usd','opex_usd',
    'ingreso_neto_mensual_usd','valor_residual_usd','ingreso_total_proyectado_usd',
    'rentabilidad_pct','seguro','garantia_anos','ubicacion_fisica','responsable',
    'usuario_dispositivo','clave_dispositivo','clave_vault','clave_vault_url','observaciones',
    'colaborador','compra_status','compra_notas','compra_inicio','tipo_renta','meses_uso_previo','area',
  ];

  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  for (const key of allowed) {
    if (key in fields) {
      updates.push(`${key} = $${idx++}`);
      values.push(fields[key] === '' ? null : fields[key]);
    }
  }
  updates.push(`updated_at = NOW()`);
  values.push(id);

  await query(
    `UPDATE equipment SET ${updates.join(', ')} WHERE id = $${idx}`,
    values
  );
  // Drop Chat sync — si cambió el estado_actual, el stock del catálogo cambia
  if (fields.estado_actual !== undefined) fireSyncCatalog();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!await checkAdmin()) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  await query(`DELETE FROM equipment WHERE id = $1`, [id]);
  fireSyncCatalog();
  return NextResponse.json({ ok: true });
}
