import { NextRequest, NextResponse } from "next/server";
import { getProduct } from "@/lib/products";
import { createCheckoutSession } from "@/lib/stripe";

/**
 * Checkout endpoint — crea Stripe Checkout Session y devuelve URL para
 * redireccionar al usuario. Todo el procesamiento post-pago ocurre en
 * /api/webhooks/stripe (async, idempotente).
 *
 * Env vars requeridas:
 *   STRIPE_SECRET_KEY     — sk_live_... o sk_test_...
 *   STRIPE_WEBHOOK_SECRET — whsec_...
 *   NEXT_PUBLIC_APP_URL   — https://www.fluxperu.com
 */

const tag = "[checkout]";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      slug,
      months,
      customer,
      quantity = 1,
      appleCare = false,
      delivery,
      identity,
    } = body as {
      slug: string;
      months: number;
      quantity?: number;
      appleCare?: boolean;
      customer: {
        name: string;
        email: string;
        phone: string;
        company: string;
        ruc: string;
      };
      delivery?: {
        method: "pickup" | "shipping";
        address: string;
        distrito: string;
        reference: string;
        placeType?: "casa" | "depto" | "edificio" | "";
        apartment?: string;
        floor?: string;
        lat?: number;
        lng?: number;
        shippingCost?: number;
        shippingFree?: boolean;
      };
      identity?: {
        dniNumber: string;
        kycCorrelationId: string;
      };
    };

    // ── Input validation ─────────────────────────────────────────────────────
    if (!slug || typeof months !== "number") {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }
    if (
      !customer?.name?.trim() ||
      !customer?.email?.trim() ||
      !customer?.phone?.trim()
    ) {
      return NextResponse.json(
        { error: "Nombre, email y teléfono son requeridos" },
        { status: 400 },
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }
    // Si el cliente se declara empresa, razón social + RUC son obligatorios.
    if (customer.ruc?.trim() && !customer.company?.trim()) {
      return NextResponse.json(
        { error: "Si ingresas RUC, la razón social también es obligatoria" },
        { status: 400 },
      );
    }
    if (!/^\+?\d{7,15}$/.test(customer.phone.trim())) {
      return NextResponse.json(
        { error: "Teléfono inválido — revisa el código de país" },
        { status: 400 },
      );
    }

    const product = await getProduct(slug);
    if (!product) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }
    if (product.stock === 0) {
      return NextResponse.json({ error: "Producto agotado" }, { status: 400 });
    }

    const pricing = product.pricing.find((p) => p.months === months);
    if (!pricing) {
      return NextResponse.json({ error: "Plan no válido" }, { status: 400 });
    }

    const qty = Math.max(1, Math.min(20, Math.floor(quantity)));
    const APPLECARE_PRICE = 12;
    const totalMonthly = (pricing.price + (appleCare ? APPLECARE_PRICE : 0)) * qty;

    const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";

    const session = await createCheckoutSession({
      productSlug: product.slug,
      productName: product.name,
      months,
      monthlyPriceUsd: totalMonthly,
      quantity: qty,
      appleCare,
      customer: {
        name: customer.name,
        email: customer.email.toLowerCase(),
        phone: customer.phone,
        company: customer.company,
        ruc: customer.ruc || "",
      },
      delivery: {
        method: delivery?.method ?? "shipping",
        address: delivery?.address ?? "",
        distrito: delivery?.distrito ?? "",
        reference: delivery?.reference ?? "",
        placeType: delivery?.placeType ?? "",
        apartment: delivery?.apartment ?? "",
        floor: delivery?.floor ?? "",
        lat: delivery?.lat,
        lng: delivery?.lng,
        shippingCostPen: delivery?.shippingCost ?? 0,
        shippingFree: delivery?.shippingFree ?? false,
      },
      identity: {
        dniNumber: identity?.dniNumber ?? "",
        kycCorrelationId: identity?.kycCorrelationId ?? "",
      },
      successUrl: `${APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${APP_URL}/checkout?cancelled=1`,
    });

    console.log(
      `${tag} session created id=${session.id} product=${slug} months=${months} total=$${totalMonthly}/mo`,
    );

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al procesar el pago";
    console.error(`${tag} error`, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
