/**
 * GA4 dataLayer events via GTM
 * Standard e-commerce events: https://developers.google.com/analytics/devguides/collection/ga4/ecommerce
 */

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

function push(event: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined" || !window.dataLayer) return;
  window.dataLayer.push({ event, ...params });
}

export function trackViewItem(product: { name: string; slug: string; price: number; months: number }) {
  push("view_item", {
    ecommerce: {
      items: [{
        item_id: product.slug,
        item_name: product.name,
        price: product.price,
        item_variant: `${product.months} meses`,
        item_category: "MacBook",
        currency: "USD",
      }],
    },
  });
}

export function trackAddToCart(product: { name: string; slug: string; price: number; months: number; quantity: number }) {
  push("add_to_cart", {
    ecommerce: {
      items: [{
        item_id: product.slug,
        item_name: product.name,
        price: product.price,
        quantity: product.quantity,
        item_variant: `${product.months} meses`,
        item_category: "MacBook",
        currency: "USD",
      }],
    },
  });
}

export function trackBeginCheckout(product: { name: string; slug: string; price: number; months: number; quantity: number }) {
  push("begin_checkout", {
    ecommerce: {
      items: [{
        item_id: product.slug,
        item_name: product.name,
        price: product.price,
        quantity: product.quantity,
        item_variant: `${product.months} meses`,
        item_category: "MacBook",
        currency: "USD",
      }],
    },
  });
}

export function trackPurchase(data: {
  transactionId: string;
  value: number;
  product: { name: string; slug: string; price: number; months: number; quantity: number };
}) {
  push("purchase", {
    ecommerce: {
      transaction_id: data.transactionId,
      value: data.value,
      currency: "USD",
      items: [{
        item_id: data.product.slug,
        item_name: data.product.name,
        price: data.product.price,
        quantity: data.product.quantity,
        item_variant: `${data.product.months} meses`,
        item_category: "MacBook",
      }],
    },
  });
}

export function trackSignUp(method: string) {
  push("sign_up", { method });
}

export function trackGenerateLead(source: string) {
  push("generate_lead", { lead_source: source });
}
