/**
 * Stripe client + helpers para FLUX (Flux Peru, LLC — Delaware).
 *
 * Flujo de cobro:
 *   1. Frontend POST /api/checkout con datos del cliente + identity + delivery
 *   2. Backend crea Checkout Session (mode=subscription, price_data inline USD)
 *      con toda la info del pedido como metadata
 *   3. Redirect del usuario a Stripe Checkout (alojado por Stripe → PCI compliant)
 *   4. Cliente paga → Stripe redirect a /checkout/success?session_id=xxx
 *   5. Webhook checkout.session.completed hace todo el trabajo backend
 *      (crear user, subscription, asignar equipo, emails)
 *
 * Cobros recurrentes: Stripe emite invoices mensuales automáticamente.
 * Webhook invoice.paid → extiende subscription + crea payment record.
 * Webhook invoice.payment_failed → notifica cliente + ops.
 *
 * Env vars:
 *   STRIPE_SECRET_KEY      → sk_live_... (sk_test_... en test mode)
 *   STRIPE_WEBHOOK_SECRET  → whsec_... (obtenido al crear el webhook endpoint)
 *   NEXT_PUBLIC_APP_URL    → https://www.fluxperu.com
 */

import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function stripeClient(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY no está seteada. Copiala del dashboard de Stripe → Developers → API keys.",
    );
  }
  _stripe = new Stripe(key.replace(/\s+/g, ""), {
    // Se usa la versión actual de la account si se omite. Lo fijamos para
    // reproducibilidad cross-deploy.
    apiVersion: "2026-03-25.dahlia",
    typescript: true,
    maxNetworkRetries: 2,
  });
  return _stripe;
}

// ═══════════════════════════════════════════════════════════════════════════
// Checkout Session (primer cobro + setup de suscripción)
// ═══════════════════════════════════════════════════════════════════════════

export interface CreateCheckoutParams {
  productSlug: string;
  productName: string;
  months: number;
  monthlyPriceUsd: number;
  quantity: number;
  appleCare: boolean;
  customer: {
    name: string;
    email: string;
    phone: string;
    company: string;
    ruc: string;
  };
  delivery: {
    method: "pickup" | "shipping";
    address: string;
    distrito: string;
    reference: string;
  };
  identity: {
    dniNumber: string;
    dniPhotoUrl: string;
    selfieUrl: string;
  };
  successUrl: string;
  cancelUrl: string;
}

export async function createCheckoutSession(
  params: CreateCheckoutParams,
): Promise<Stripe.Checkout.Session> {
  const stripe = stripeClient();

  const description =
    params.quantity > 1
      ? `${params.productName} x${params.quantity} · Plan ${params.months}m`
      : `${params.productName} · Plan ${params.months}m${params.appleCare ? " + AppleCare+" : ""}`;

  // price_data inline — no hace falta crear Products/Prices en el dashboard.
  // unit_amount en centavos. Stripe cobra mensualmente en USD.
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: params.customer.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          recurring: { interval: "month" },
          product_data: {
            name: `FLUX — ${params.productName}`,
            description,
          },
          // unit_amount es el total mensual (ya incluye cantidad + AppleCare)
          unit_amount: Math.round(params.monthlyPriceUsd * 100),
        },
      },
    ],
    // Metadata es lo que el webhook lee para armar la subscription en DB.
    // Límite: 50 keys, 500 chars/valor. Todo string.
    metadata: {
      product_slug: params.productSlug,
      product_name: params.productName,
      months: String(params.months),
      quantity: String(params.quantity),
      apple_care: String(params.appleCare),
      monthly_price: String(params.monthlyPriceUsd),
      customer_name: params.customer.name.slice(0, 250),
      customer_phone: params.customer.phone.slice(0, 40),
      customer_company: params.customer.company.slice(0, 250),
      customer_ruc: params.customer.ruc.slice(0, 30),
      delivery_method: params.delivery.method,
      delivery_address: params.delivery.address.slice(0, 490),
      delivery_distrito: params.delivery.distrito.slice(0, 80),
      delivery_reference: params.delivery.reference.slice(0, 490),
      dni_number: params.identity.dniNumber.slice(0, 20),
      dni_photo_url: params.identity.dniPhotoUrl.slice(0, 490),
      selfie_url: params.identity.selfieUrl.slice(0, 490),
    },
    // La subscription hereda metadata para que el webhook de invoices
    // recurrentes pueda recuperar el producto y flags.
    subscription_data: {
      metadata: {
        product_slug: params.productSlug,
        months: String(params.months),
      },
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    allow_promotion_codes: false,
    billing_address_collection: "required",
    // Stripe colecta la tarjeta + la guarda automáticamente para recurring.
    payment_method_collection: "always",
  });

  return session;
}

// ═══════════════════════════════════════════════════════════════════════════
// Verificación de webhook
// ═══════════════════════════════════════════════════════════════════════════

export function constructWebhookEvent(
  rawBody: string,
  signature: string,
): Stripe.Event {
  const stripe = stripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET no está seteada");
  }
  return stripe.webhooks.constructEvent(rawBody, signature, secret.replace(/\s+/g, ""));
}

// ═══════════════════════════════════════════════════════════════════════════
// Subscriptions
// ═══════════════════════════════════════════════════════════════════════════

export async function cancelSubscription(subscriptionId: string): Promise<void> {
  const stripe = stripeClient();
  // cancel_at_period_end = false significa "cancelar inmediatamente"
  // Si querés que el cliente use hasta fin de mes pagado, poner true.
  await stripe.subscriptions.cancel(subscriptionId);
}

export async function retrieveSession(sessionId: string): Promise<Stripe.Checkout.Session> {
  const stripe = stripeClient();
  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription", "customer"],
  });
}
