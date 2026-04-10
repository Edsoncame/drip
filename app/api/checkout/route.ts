import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, PreApprovalPlan, PreApproval } from "mercadopago";
import { getProduct } from "@/lib/products";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sendConfirmationEmail } from "@/lib/email";

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
  options: { timeout: 5000 },
});

const tag = "[checkout]";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, months, cardToken, customer, quantity = 1, appleCare = false } = body as {
      slug: string;
      months: number;
      cardToken: string;
      quantity?: number;
      appleCare?: boolean;
      customer: {
        name: string;
        email: string;
        phone: string;
        company: string;
        ruc: string;
      };
    };

    // ── Input validation ────────────────────────────────────────────────────────
    if (!slug || typeof months !== "number") {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }
    if (!customer?.name?.trim() || !customer?.email?.trim() || !customer?.phone?.trim() || !customer?.company?.trim()) {
      return NextResponse.json({ error: "Nombre, email, teléfono y empresa son requeridos" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }
    if (!cardToken) {
      return NextResponse.json({ error: "Token de tarjeta requerido" }, { status: 400 });
    }

    const product = getProduct(slug);
    if (!product) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }
    if (product.stock === 0) {
      return NextResponse.json({ error: "Producto agotado" }, { status: 400 });
    }

    const plan = product.pricing.find((p) => p.months === months);
    if (!plan) {
      return NextResponse.json({ error: "Plan no válido" }, { status: 400 });
    }

    const qty = Math.max(1, Math.min(20, Math.floor(quantity)));
    const APPLECARE_PRICE = 15;
    const totalMonthly = (plan.price + (appleCare ? APPLECARE_PRICE : 0)) * qty;

    // 1 — Create a subscription plan (one per checkout)
    const preApprovalPlan = await new PreApprovalPlan(client).create({
      body: {
        reason: `FLUX — ${product.name}${qty > 1 ? ` ×${qty}` : ""} · ${months} meses`,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          repetitions: months,
          billing_day: new Date().getDate(),
          transaction_amount: totalMonthly,
          currency_id: "USD",
        },
        back_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success`,
      },
    });

    if (!preApprovalPlan.id) {
      throw new Error("No se pudo crear el plan de suscripción");
    }

    // 2 — Subscribe the customer using the card token from the frontend
    const preApproval = await new PreApproval(client).create({
      body: {
        preapproval_plan_id: preApprovalPlan.id,
        payer_email: customer.email,
        card_token_id: cardToken,
        status: "authorized",
      },
    });

    // 3 — Save subscription to DB
    const session = await getSession();
    const endsAt = new Date();
    endsAt.setMonth(endsAt.getMonth() + months);

    await query(
      `INSERT INTO subscriptions
        (user_id, product_slug, product_name, months, monthly_price, status, started_at, ends_at, mp_subscription_id, customer_name, customer_email, customer_phone, customer_company, customer_ruc)
       VALUES ($1,$2,$3,$4,$5,'active',NOW(),$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT DO NOTHING`,
      [
        session?.userId ?? null,
        product.slug,
        product.name,
        months,
        totalMonthly,
        endsAt,
        preApproval.id ?? null,
        customer.name,
        customer.email,
        customer.phone,
        customer.company,
        customer.ruc || null,
      ]
    );

    // 4 — Send confirmation email (non-blocking)
    sendConfirmationEmail({
      to: customer.email,
      name: customer.name,
      productName: product.name,
      months,
      price: totalMonthly,
      endsAt,
    }).catch(() => {});

    console.log(`${tag} subscription created mp_id=${preApproval.id} product=${slug} months=${months} user=${session?.userId ?? "guest"}`);

    return NextResponse.json({
      subscriptionId: preApproval.id,
      status: preApproval.status,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al procesar el pago";
    console.error(`${tag} error`, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
