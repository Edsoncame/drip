import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth";
import Stripe from "stripe";

const tag = "[purchase-checkout]";

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY no está seteada");
  return new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Debes iniciar sesión" }, { status: 401 });
    }

    const body = await req.json();
    const { equipment_id, customer, delivery } = body as {
      equipment_id: string;
      customer: {
        name: string;
        email: string;
        phone: string;
        company?: string;
        ruc?: string;
      };
      delivery: {
        method: "pickup" | "shipping";
        address: string;
        street: string;
        streetNumber: string;
        distrito: string;
        reference?: string;
        placeType?: string;
        apartment?: string;
        floor?: string;
        lat?: number;
        lng?: number;
        shippingCost?: number;
        shippingFree?: boolean;
      };
    };

    // ── Validar inputs ───────────────────────────────────────────────────────
    if (!equipment_id) {
      return NextResponse.json({ error: "Equipo requerido" }, { status: 400 });
    }
    if (!customer?.name?.trim() || !customer?.email?.trim() || !customer?.phone?.trim()) {
      return NextResponse.json({ error: "Nombre, email y teléfono son requeridos" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }
    if (!/^\+?\d{7,15}$/.test(customer.phone.trim())) {
      return NextResponse.json({ error: "Teléfono inválido — revisa el código de país" }, { status: 400 });
    }

    // ── Verificar equipo disponible ───────────────────────────────────────────
    const eqResult = await query<{
      id: string;
      modelo_completo: string;
      chip: string;
      ram: string;
      ssd: string;
      sale_price_usd: string;
      for_sale: boolean;
    }>(
      `SELECT id, modelo_completo, chip, ram, ssd, sale_price_usd, for_sale
       FROM equipment
       WHERE id = $1 AND for_sale = true`,
      [equipment_id],
    );

    if (eqResult.rows.length === 0) {
      return NextResponse.json({ error: "Equipo no disponible para la venta" }, { status: 404 });
    }

    const eq = eqResult.rows[0];

    // Verificar que no tenga una orden activa (lock optimista)
    const activeOrder = await query<{ id: string }>(
      `SELECT id FROM equipment_sale_orders
       WHERE equipment_id = $1 AND status NOT IN ('cancelled')
       LIMIT 1`,
      [equipment_id],
    );
    if (activeOrder.rows.length > 0) {
      return NextResponse.json({ error: "Este equipo ya fue reservado por otra persona" }, { status: 409 });
    }

    const salePrice = parseFloat(eq.sale_price_usd);
    if (isNaN(salePrice) || salePrice <= 0) {
      return NextResponse.json({ error: "Precio de venta no configurado" }, { status: 400 });
    }

    // ── Crear orden en DB (status pending) ───────────────────────────────────
    const orderResult = await query<{ id: string }>(
      `INSERT INTO equipment_sale_orders
        (user_id, equipment_id, sale_price_usd, status,
         customer_name, customer_email, customer_phone,
         delivery_method, delivery_address, delivery_distrito, delivery_reference,
         delivery_place_type, delivery_apartment, delivery_floor,
         delivery_lat, delivery_lng, shipping_cost_pen)
       VALUES ($1,$2,$3,'pending',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING id`,
      [
        session.userId,
        equipment_id,
        salePrice,
        customer.name,
        customer.email.toLowerCase(),
        customer.phone,
        delivery?.method ?? "shipping",
        delivery?.address ?? "",
        delivery?.distrito ?? "",
        delivery?.reference ?? "",
        delivery?.placeType ?? "",
        delivery?.apartment ?? "",
        delivery?.floor ?? "",
        delivery?.lat ?? null,
        delivery?.lng ?? null,
        delivery?.shippingCost ?? 0,
      ],
    );

    const saleOrderId = orderResult.rows[0].id;

    // ── Crear Stripe Checkout Session (pago único) ────────────────────────────
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";
    const stripe = stripeClient();

    const stripeSession = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: customer.email.toLowerCase(),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            product_data: {
              name: `FLUX — ${eq.modelo_completo}`,
              description: `${eq.chip ?? ""} · ${eq.ram ?? ""} · ${eq.ssd ?? ""} — Equipo usado certificado`,
            },
            unit_amount: Math.round(salePrice * 100),
          },
        },
      ],
      metadata: {
        order_type: "equipment_sale",
        sale_order_id: saleOrderId,
        equipment_id,
        equipment_name: eq.modelo_completo.slice(0, 250),
        sale_price_usd: String(salePrice),
        billing_name: customer.name.slice(0, 250),
        billing_phone: customer.phone.slice(0, 40),
        billing_company: (customer.company ?? "").slice(0, 250),
        billing_ruc: (customer.ruc ?? "").slice(0, 30),
        delivery_method: delivery?.method ?? "shipping",
        delivery_address: (delivery?.address ?? "").slice(0, 490),
        delivery_distrito: (delivery?.distrito ?? "").slice(0, 80),
        shipping_cost_pen: String(delivery?.shippingCost ?? 0),
      },
      success_url: `${APP_URL}/comprar-checkout/success?order_id=${saleOrderId}&name=${encodeURIComponent(customer.name)}&email=${encodeURIComponent(customer.email)}&model=${encodeURIComponent(eq.modelo_completo)}&price=${salePrice}`,
      cancel_url: `${APP_URL}/comprar-checkout?id=${equipment_id}&cancelled=1`,
      billing_address_collection: "auto",
    });

    // Guardar session id de Stripe en la orden
    await query(
      `UPDATE equipment_sale_orders SET stripe_session_id = $1, payment_session_id = $1, updated_at = NOW() WHERE id = $2`,
      [stripeSession.id, saleOrderId],
    );

    console.log(`${tag} order=${saleOrderId} stripe_session=${stripeSession.id} eq=${equipment_id} price=$${salePrice}`);

    return NextResponse.json({ sessionId: stripeSession.id, url: stripeSession.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al procesar el pago";
    console.error(`${tag} error`, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
