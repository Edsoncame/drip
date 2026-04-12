/**
 * Culqi API wrapper for FLUX subscriptions
 *
 * Flow: Token (frontend) → Customer → Card → Subscription
 *
 * Environment variables:
 *   CULQI_SECRET_KEY    — sk_test_... or sk_live_...
 *   NEXT_PUBLIC_CULQI_PUBLIC_KEY — pk_test_... or pk_live_...
 *
 * Docs: https://apidocs.culqi.com/
 */

const BASE = "https://api.culqi.com/v2";

function headers() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.CULQI_SECRET_KEY}`,
  };
}

async function culqiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = (data as { user_message?: string; merchant_message?: string }).user_message
      ?? (data as { merchant_message?: string }).merchant_message
      ?? "Error en Culqi";
    throw new Error(msg);
  }
  return data as T;
}

async function culqiDelete(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error("Error al cancelar en Culqi");
  }
}

// ── Plan ──────────────────────────────────────────────────────────────────────

interface CulqiPlan {
  id: string;
  name: string;
  amount: number;
  currency: string;
  status: number;
}

export async function createPlan(params: {
  name: string;
  shortName: string;
  amount: number; // in cents (e.g. 11500 = $115.00)
  currency: "USD" | "PEN";
  intervalMonths: number;
  totalCycles: number;
}): Promise<CulqiPlan> {
  return culqiPost<CulqiPlan>("/plans", {
    name: params.name,
    short_name: params.shortName,
    description: `FLUX — ${params.name}`,
    amount: params.amount,
    currency: params.currency,
    interval_unit_time: 5, // 5 = monthly in Culqi
    interval_count: params.intervalMonths,
    initial_cycles: {
      count: params.totalCycles,
      has_initial_charge: true,
      amount: params.amount,
      interval_unit_time: 5,
    },
  });
}

// ── Customer ──────────────────────────────────────────────────────────────────

interface CulqiCustomer {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

export async function createCustomer(params: {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  address?: string;
  city?: string;
}): Promise<CulqiCustomer> {
  return culqiPost<CulqiCustomer>("/customers", {
    first_name: params.firstName,
    last_name: params.lastName,
    email: params.email,
    phone_number: params.phone.replace(/\D/g, "").slice(-9),
    address: params.address ?? "Lima",
    address_city: params.city ?? "Lima",
    country_code: "PE",
  });
}

// ── Card ──────────────────────────────────────────────────────────────────────

interface CulqiCard {
  id: string;
  last_four: string;
  brand: string;
}

export async function createCard(params: {
  customerId: string;
  tokenId: string;
}): Promise<CulqiCard> {
  return culqiPost<CulqiCard>("/cards", {
    customer_id: params.customerId,
    token_id: params.tokenId,
  });
}

// ── Subscription ──────────────────────────────────────────────────────────────

interface CulqiSubscription {
  id: string;
  card_id: string;
  plan_id: string;
  status: string;
  creation_date: number;
}

export async function createSubscription(params: {
  cardId: string;
  planId: string;
}): Promise<CulqiSubscription> {
  return culqiPost<CulqiSubscription>("/subscriptions", {
    card_id: params.cardId,
    plan_id: params.planId,
    tyc: true,
  });
}

export async function cancelSubscription(subscriptionId: string): Promise<void> {
  return culqiDelete(`/subscriptions/${subscriptionId}`);
}

// ── One-time charge (for first payment) ───────────────────────────────────────

interface CulqiCharge {
  id: string;
  amount: number;
  currency_code: string;
  outcome: { type: string; user_message: string };
}

export async function createCharge(params: {
  amount: number; // cents
  currency: "USD" | "PEN";
  email: string;
  tokenId: string;
  description: string;
}): Promise<CulqiCharge> {
  return culqiPost<CulqiCharge>("/charges", {
    amount: params.amount,
    currency_code: params.currency,
    email: params.email,
    source_id: params.tokenId,
    description: params.description,
    metadata: { source: "fluxperu.com" },
  });
}
