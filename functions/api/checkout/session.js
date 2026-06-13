import {
  classifyPreliminary,
  getCheckoutCustomFields,
  getCustomText,
  getTaxIdCollection,
  isValidCountryCode,
  normalizeCountry
} from "../../_lib/fiscal.js";

const STRIPE_API_VERSION = "2026-02-25.clover";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function encodeForm(params) {
  const body = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    body.append(key, String(value));
  }

  return body;
}

async function stripePost(env, path, params) {
  const response = await fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
      "stripe-version": STRIPE_API_VERSION
    },
    body: encodeForm(params)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `Stripe API error ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

function getBaseUrl(request, env) {
  const fallback = new URL(request.url).origin;
  return String(env.NRO_PUBLIC_BASE_URL || fallback).replace(/\/$/, "");
}

function buildCheckoutParams({ customerId, priceId, baseUrl, country, buyerType, invoiceCase }) {
  const params = {
    mode: "payment",
    customer: customerId,
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": 1,
    billing_address_collection: "required",
    "customer_update[name]": "auto",
    "customer_update[address]": "auto",
    success_url: `${baseUrl}/checkout/success/?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/checkout/start/`,
    "custom_text[submit][message]": getCustomText(country),
    "metadata[fiscal_model]": "consulting_email_marketing",
    "metadata[billing_country_preselected]": country,
    "metadata[buyer_type_preselected]": buyerType,
    "metadata[invoice_case_preliminary]": invoiceCase,
    "metadata[ask_sdi_pec]": "false",
    "metadata[requires_manual_review]": invoiceCase === "SAN_MARINO_MANUAL_REVIEW" ? "true" : "false",
    "metadata[manual_review_reason]": invoiceCase === "SAN_MARINO_MANUAL_REVIEW" ? "san_marino" : "",
    "payment_intent_data[metadata][fiscal_model]": "consulting_email_marketing",
    "payment_intent_data[metadata][billing_country_preselected]": country,
    "payment_intent_data[metadata][buyer_type_preselected]": buyerType,
    "payment_intent_data[metadata][invoice_case_preliminary]": invoiceCase
  };

  const taxIdCollection = getTaxIdCollection(country, buyerType);
  params["tax_id_collection[enabled]"] = taxIdCollection.enabled ? "true" : "false";
  if (taxIdCollection.enabled && taxIdCollection.required) {
    params["tax_id_collection[required]"] = taxIdCollection.required;
  }

  const customFields = getCheckoutCustomFields(invoiceCase);
  customFields.forEach((field, index) => {
    params[`custom_fields[${index}][key]`] = field.key;
    params[`custom_fields[${index}][label][type]`] = "custom";
    params[`custom_fields[${index}][label][custom]`] = field.label;
    params[`custom_fields[${index}][type]`] = "text";
    params[`custom_fields[${index}][optional]`] = field.optional ? "true" : "false";
    if (field.minimumLength) params[`custom_fields[${index}][text][minimum_length]`] = field.minimumLength;
    if (field.maximumLength) params[`custom_fields[${index}][text][maximum_length]`] = field.maximumLength;
  });

  return params;
}

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_SECRET_KEY || !env.NRO_BETA_PACK_PRICE_ID) {
    return json({ error: "Checkout is not configured yet." }, 503);
  }

  const form = await request.formData();
  const country = normalizeCountry(form.get("billingCountry"));
  const buyerType = String(form.get("buyerType") || "").trim();

  if (!isValidCountryCode(country)) {
    return json({ error: "Select a valid billing country." }, 400);
  }

  if (!["individual", "business"].includes(buyerType)) {
    return json({ error: "Select individual or business." }, 400);
  }

  const invoiceCase = classifyPreliminary(country, buyerType);

  try {
    const customer = await stripePost(env, "/v1/customers", {
      "metadata[fiscal_model]": "consulting_email_marketing",
      "metadata[billing_country_preselected]": country,
      "metadata[buyer_type_preselected]": buyerType,
      "metadata[invoice_case_preliminary]": invoiceCase,
      "metadata[ask_sdi_pec]": "false"
    });

    const session = await stripePost(env, "/v1/checkout/sessions", buildCheckoutParams({
      customerId: customer.id,
      priceId: env.NRO_BETA_PACK_PRICE_ID,
      baseUrl: getBaseUrl(request, env),
      country,
      buyerType,
      invoiceCase
    }));

    return new Response(null, {
      status: 303,
      headers: {
        location: session.url,
        "cache-control": "no-store"
      }
    });
  } catch (error) {
    return json({ error: error.message || "Unable to start checkout." }, 500);
  }
}
