export const EU_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE",
  "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"
]);

export function normalizeCountry(country) {
  return String(country || "").trim().toUpperCase();
}

export function isValidCountryCode(country) {
  return /^[A-Z]{2}$/.test(normalizeCountry(country));
}

export function classifyPreliminary(country, buyerType) {
  const c = normalizeCountry(country);

  if (c === "SM") return "SAN_MARINO_MANUAL_REVIEW";
  if (c === "IT") return buyerType === "business" ? "IT_BUSINESS" : "IT_INDIVIDUAL";
  if (EU_COUNTRIES.has(c)) return buyerType === "business" ? "EU_BUSINESS_VAT_PENDING" : "EU_INDIVIDUAL";
  return buyerType === "business" ? "EXTRA_EU_BUSINESS" : "EXTRA_EU_INDIVIDUAL";
}

export function getTaxIdCollection(country, buyerType) {
  const c = normalizeCountry(country);

  if (buyerType === "individual") {
    return { enabled: false };
  }

  if (c === "IT" || EU_COUNTRIES.has(c)) {
    return { enabled: true, required: "if_supported" };
  }

  return { enabled: true, required: "never" };
}

export function getCheckoutCustomFields(invoiceCase) {
  if (invoiceCase === "IT_INDIVIDUAL") {
    return [
      {
        key: "it_codice_fiscale",
        label: "Codice fiscale",
        optional: false,
        minimumLength: 16,
        maximumLength: 16
      }
    ];
  }

  if (invoiceCase === "IT_BUSINESS") {
    return [
      {
        key: "it_codice_fiscale_persona",
        label: "CF se ditta individuale",
        optional: true,
        maximumLength: 16
      }
    ];
  }

  return [];
}

export function getCustomText(country) {
  if (normalizeCountry(country) === "IT") {
    return "Per clienti italiani invieremo copia di cortesia della fattura via email. Non e' necessario inserire SDI o PEC.";
  }

  return "Use real billing details: we will issue the invoice based on the information entered here.";
}

export function extractCustomFields(customFields = []) {
  const out = {};

  for (const field of customFields || []) {
    if (!field || !field.key) continue;
    out[field.key] = field.text?.value || field.dropdown?.value || field.numeric?.value || "";
  }

  return out;
}

export function normalizeTaxIds(taxIds = []) {
  return (taxIds || []).map((taxId) => ({
    type: taxId.type || "",
    value: taxId.value || "",
    verificationStatus: taxId.verification?.status || taxId.verification_status || ""
  }));
}

export function classifyFinalOrPending(preliminaryCase, taxIds = []) {
  if (preliminaryCase !== "EU_BUSINESS_VAT_PENDING") {
    return preliminaryCase;
  }

  const firstTaxId = taxIds[0];
  const status = firstTaxId?.verificationStatus || "";

  if (status === "verified") return "EU_B2B_VIES_VALID";
  if (status === "pending" || status === "unverified") return "EU_B2B_VIES_PENDING";
  return "EU_B2B_VIES_INVALID_OR_MISSING";
}

export function buildInvoiceInstructions(order) {
  const wording = "Servizio di consulenza operativa in email marketing con predisposizione materiali email/newsletter.";
  const finalCase = order.invoiceCaseFinalOrPending;

  if (finalCase === "IT_INDIVIDUAL") {
    return {
      recipientType: "Italia privato",
      codiceDestinatario: "0000000",
      vatNatureLikely: "N2.2",
      wordingSuggestion: wording,
      notes: [
        "Usare nome/cognome e codice fiscale italiano raccolto in it_codice_fiscale.",
        "Inviare copia di cortesia via email.",
        "Verificare bollo se importo sopra soglia applicabile."
      ]
    };
  }

  if (finalCase === "IT_BUSINESS") {
    return {
      recipientType: "Italia azienda/professionista",
      codiceDestinatario: "0000000",
      vatNatureLikely: "N2.2",
      wordingSuggestion: wording,
      notes: [
        "Usare ragione sociale/nome business e P.IVA/VAT ID raccolto da Stripe tax ID collection.",
        "Se presente it_codice_fiscale_persona, inserirlo come CF per ditta individuale/professionista.",
        "Non chiediamo SDI/PEC: usare 0000000 e inviare copia di cortesia via email.",
        "Verificare bollo se importo sopra soglia applicabile."
      ]
    };
  }

  if (finalCase === "EU_INDIVIDUAL") {
    return {
      recipientType: "UE privato",
      codiceDestinatario: "XXXXXXX",
      vatNatureLikely: "N2.2",
      wordingSuggestion: wording,
      notes: [
        "Usare nome, indirizzo e paese raccolti da Stripe.",
        "Tenere monitorata soglia annua UE B2C / eventuale OSS secondo indicazioni del commercialista.",
        "Verificare bollo se importo sopra soglia applicabile."
      ]
    };
  }

  if (finalCase === "EU_B2B_VIES_VALID") {
    return {
      recipientType: "UE business con VAT/VIES valido",
      codiceDestinatario: "XXXXXXX",
      vatNatureLikely: "N2.1",
      wordingSuggestion: wording,
      notes: [
        "Usare ragione sociale, indirizzo e VAT ID raccolti da Stripe.",
        "Inserire dicitura inversione contabile / Art. 7-ter DPR 633/1972 secondo istruzioni del commercialista.",
        "Conservare evidenza verifica VIES se disponibile.",
        "Verificare bollo se importo sopra soglia applicabile."
      ]
    };
  }

  if (finalCase === "EU_B2B_VIES_PENDING" || finalCase === "EU_B2B_VIES_INVALID_OR_MISSING") {
    return {
      recipientType: "UE business VAT mancante/non valido",
      codiceDestinatario: "XXXXXXX",
      vatNatureLikely: "N2.2",
      wordingSuggestion: wording,
      notes: [
        "Trattare come non VIES / assimilato a privato secondo tabella commercialista, salvo diversa indicazione.",
        "Manual review consigliata.",
        "Verificare bollo se importo sopra soglia applicabile."
      ]
    };
  }

  if (finalCase === "SAN_MARINO_MANUAL_REVIEW") {
    return {
      recipientType: "San Marino",
      codiceDestinatario: "manual_review",
      vatNatureLikely: "manual_review",
      wordingSuggestion: wording,
      notes: [
        "Ordine raro: non automatizzare. Verificare COE e istruzioni specifiche con commercialista prima di emettere."
      ]
    };
  }

  return {
    recipientType: "Extra-UE privato/business",
    codiceDestinatario: "XXXXXXX",
    vatNatureLikely: "N2.1",
    wordingSuggestion: wording,
    notes: [
      "Usare nome/ragione sociale, indirizzo e paese raccolti da Stripe.",
      "Tax ID locale se raccolto; altrimenti non bloccare fattura.",
      "Verificare bollo se importo sopra soglia applicabile."
    ]
  };
}

export function buildPaidOrderRow(order) {
  const address = order.billingAddress || {};
  const firstTaxId = order.taxIds?.[0] || {};
  const customFields = order.customFields || {};
  const instructions = order.invoiceInstructions || {};

  return {
    paid_at: order.paidAt || "",
    stripe_session_id: order.stripeSessionId || "",
    payment_intent: order.stripePaymentIntentId || "",
    amount: order.amountTotal || 0,
    currency: order.currency || "",
    email: order.customerEmail || "",
    name: order.customerName || "",
    country: address.country || order.billingCountryPreselected || "",
    address_line1: address.line1 || "",
    address_line2: address.line2 || "",
    postal_code: address.postal_code || "",
    city: address.city || "",
    state: address.state || "",
    buyer_type: order.buyerTypePreselected || "",
    invoice_case_preliminary: order.invoiceCasePreliminary || "",
    invoice_case_final: order.invoiceCaseFinalOrPending || "",
    tax_id_type: firstTaxId.type || "",
    tax_id_value: firstTaxId.value || "",
    it_codice_fiscale: customFields.it_codice_fiscale || "",
    it_cf_ditta_individuale: customFields.it_codice_fiscale_persona || "",
    codice_destinatario: instructions.codiceDestinatario || "",
    natura_iva_suggerita: instructions.vatNatureLikely || "",
    wording_fattura: instructions.wordingSuggestion || "",
    manual_review: order.manualReview ? "true" : "false",
    invoice_issued: "false",
    invoice_number: "",
    notes: (instructions.notes || []).join(" | ")
  };
}
