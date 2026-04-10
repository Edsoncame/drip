import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getProduct } from "@/lib/products";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, months, customer } = body as {
      slug: string;
      months: number;
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

    const plan = product.pricing.find(p => p.months === months);
    if (!plan) {
      return NextResponse.json({ error: "Plan no válido" }, { status: 400 });
    }

    // Amount in cents (USD → multiply by 100)
    const amountCents = plan.price * 100;

    // Create PaymentIntent for first month charge
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      metadata: {
        product_slug: slug,
        product_name: product.name,
        plan_months: months.toString(),
        monthly_price: plan.price.toString(),
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone,
        customer_company: customer.company,
        customer_ruc: customer.ruc,
      },
      description: `DRIP — ${product.name} (${months} meses) — Primer mes`,
      receipt_email: customer.email,
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error("Stripe error:", err);
    return NextResponse.json(
      { error: "Error al crear el pago. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
