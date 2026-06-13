import {
  buildInvoiceInstructions,
  buildPaidOrderRow,
  classifyFinalOrPending,
  extractCustomFields,
  normalizeTaxIds
} from "../../_lib/fiscal.js";

const STRIPE_API_VERSION = "2026-02-25.clover";

function getEnv(env, ...names) {
  for (const name of names) {
    const value = env[name];
    if (value) return value;
  }
  return "";
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function hex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function parseStripeSignature(header) {
  const parts = String(header || "").split(",");
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3));

  return { timestamp, signatures };
}

async function verifyStripeSignature(rawBody, signatureHeader, webhookSecret) {
  const { timestamp, signatures } = parseStripeSignature(signatureHeader);
  if (!timestamp || signatures.length === 0) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const expected = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload)));

  return signatures.some((signature) => timingSafeEqual(signature, expected));
}

async function stripeGet(stripeSecretKey, path, query = {}) {
  const url = new URL(`https://api.stripe.com${path}`);
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      value.forEach((item) => url.searchParams.append(key, item));
    } else if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      authorization: `Bearer ${stripeSecretKey}`,
      "stripe-version": STRIPE_API_VERSION
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `Stripe API error ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

function getPaymentIntentId(session) {
  if (!session.payment_intent) return "";
  return typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent.id;
}

function buildPaidOrder(session) {
  const metadata = session.metadata || {};
  const customerDetails = session.customer_details || {};
  const taxIds = normalizeTaxIds(customerDetails.tax_ids || []);
  const customFields = extractCustomFields(session.custom_fields || []);
  const preliminaryCase = metadata.invoice_case_preliminary || "UNKNOWN";
  const finalCase = classifyFinalOrPending(preliminaryCase, taxIds);
  const manualReview = finalCase === "SAN_MARINO_MANUAL_REVIEW" || finalCase === "EU_B2B_VIES_INVALID_OR_MISSING";

  const order = {
    id: session.id,
    stripeSessionId: session.id,
    stripePaymentIntentId: getPaymentIntentId(session),
    stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id,
    paidAt: new Date((session.created || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    amountTotal: session.amount_total || 0,
    currency: session.currency || "",
    paymentStatus: session.payment_status || "",
    customerEmail: customerDetails.email || "",
    customerName: customerDetails.name || "",
    billingAddress: customerDetails.address || {},
    buyerTypePreselected: metadata.buyer_type_preselected || "",
    billingCountryPreselected: metadata.billing_country_preselected || "",
    invoiceCasePreliminary: preliminaryCase,
    invoiceCaseFinalOrPending: finalCase,
    taxIds,
    customFields,
    needsInvoice: true,
    invoiceIssued: false,
    manualReview,
    manualReviewReason: metadata.manual_review_reason || (manualReview ? finalCase : "")
  };

  order.invoiceInstructions = buildInvoiceInstructions(order);
  return order;
}

async function sendToOrderSheet(env, row, order) {
  const sheetWebhookUrl = getEnv(env, "ORDER_SHEET_WEBHOOK_URL", "ORDER-SHEET-WEBHOOK-URL");
  const sheetSharedSecret = getEnv(env, "ORDER_SHEET_SHARED_SECRET", "ORDER-SHEET-SHARED-SECRET");

  if (!sheetWebhookUrl || !sheetSharedSecret) {
    console.warn("Order sheet webhook is not configured. Skipping Sheet sync.");
    return { skipped: true };
  }

  const response = await fetch(sheetWebhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      secret: sheetSharedSecret,
      row,
      order
    })
  });

  const text = await response.text();
  const payload = JSON.parse(text || "{}");
  if (!response.ok) {
    throw new Error(`Order sheet sync failed: ${response.status} ${text}`);
  }
  if (payload.ok === false) {
    throw new Error(`Order sheet sync failed: ${payload.error || text}`);
  }

  return { ok: true, response: payload };
}

export async function onRequestPost({ request, env }) {
  const stripeSecretKey = getEnv(env, "STRIPE_SECRET_KEY", "STRIPE-SECRET-KEY");
  const stripeWebhookSecret = getEnv(env, "STRIPE_WEBHOOK_SECRET", "STRIPE-WEBHOOK-SECRET");

  if (!stripeSecretKey || !stripeWebhookSecret) {
    return json({ error: "Webhook is not configured yet." }, 503);
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  const verified = await verifyStripeSignature(rawBody, signature, stripeWebhookSecret);
  if (!verified) {
    return json({ error: "Invalid Stripe signature." }, 400);
  }

  const event = JSON.parse(rawBody);
  if (event.type !== "checkout.session.completed") {
    return json({ received: true, ignored: event.type });
  }

  const eventSession = event.data?.object;
  if (!eventSession?.id) {
    return json({ error: "Missing checkout session." }, 400);
  }

  const session = await stripeGet(stripeSecretKey, `/v1/checkout/sessions/${eventSession.id}`, {
    "expand[]": ["customer", "payment_intent", "line_items"]
  });

  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    return json({ received: true, ignored: "not_paid", payment_status: session.payment_status });
  }

  const order = buildPaidOrder(session);
  const row = buildPaidOrderRow(order);
  const sheetSync = await sendToOrderSheet(env, row, order);

  return json({ received: true, session_id: session.id, sheetSync });
}
