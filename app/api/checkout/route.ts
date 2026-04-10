import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, PreApprovalPlan, PreApproval } from "mercadopago";
import { getProduct } from "@/lib/products";

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
  options: { timeout: 5000 },
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, months, cardToken, customer } = body as {
      slug: string;
      months: number;
      cardToken: string;
      customer: {
        name: string;
        email: string;
        phone: string;
        company: string;
        ruc: string;
      };
    };

    const product = getProduct(slug);
    if (!product) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    const plan = product.pricing.find((p) => p.months === months);
    if (!plan) {
      return NextResponse.json({ error: "Plan no válido" }, { status: 400 });
    }

    // 1 — Create a subscription plan (one per checkout)
    const preApprovalPlan = await new PreApprovalPlan(client).create({
      body: {
        reason: `DRIP — ${product.name} · ${months} meses`,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          repetitions: months,
          billing_day: new Date().getDate(),
          transaction_amount: plan.price,
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

    return NextResponse.json({
      subscriptionId: preApproval.id,
      status: preApproval.status,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al procesar el pago";
    console.error("MP error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
