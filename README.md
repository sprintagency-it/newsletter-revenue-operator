---
type: landing_asset_readme
status: v0
date: 2026-06-11
project: newsletter_revenue_operator
---

# NRO Landing V0

Static validation landing for the English-first NRO beta.

## Files

- `index.html`: landing page.
- `00_preview-hub.html`: local review hub with links to unpublished page previews.
- `newsletter-revenue-system/index.html`: indexable SEO/AI-search source page.
- `thank-you.html`: post-intake page with beta pack upsell.
- `checkout/start/index.html`: billing country and buyer type pre-check before Stripe.
- `checkout/success/index.html`: post-payment confirmation page.
- `privacy-policy/index.html`: privacy policy page.
- `cookie-policy/index.html`: cookie policy page.
- `assets/legal.css`: shared footer, legal page and cookie banner styles.
- `assets/consent.js`: lightweight consent manager and Meta Pixel prior-blocking.
- `functions/`: Cloudflare Pages Functions for dynamic Stripe Checkout and webhook handling.
- `wrangler.toml`: Cloudflare Pages project config for CLI/Git-oriented deployment.
- `robots.txt`: crawler governance and sitemap reference.
- `sitemap.xml`: indexable page discovery file.
- `llms.txt`: agent-readable project summary; useful for AI tooling, not an official Google ranking requirement.
- `_headers`: Cloudflare Pages headers for noindex on preview, checkout and API paths.
- `assets/favicon.svg`: favicon and schema logo.
- `assets/og-image.svg`: Open Graph/Twitter preview image.

## Placeholders To Replace

In `index.html`:

```text
https://tally.so/r/NpO6DO
```

In `thank-you.html`:

```text
/checkout/start/
```

## Current Flow

```text
Free-first path:
Landing
-> Tally intake form
-> Thank-you page, after Tally redirect points to https://newsletter-revenue-operator.pages.dev/thank-you.html
-> Optional Dynamic Stripe Checkout start
-> Stripe hosted Checkout
-> Checkout success page

Paid-first path:
Landing
-> Dynamic Stripe Checkout start
-> Stripe hosted Checkout
-> Checkout success page
-> Tally intake form with paid-first tracking params
-> Unified thank-you page
-> AIOS assisted delivery
```

Important: every paid customer must complete the intake form before delivery. Stripe payment alone does not provide enough context to create the newsletter drafts.

## Tracking Events

- Meta Pixel is prior-blocked by `assets/consent.js`.
- `PageView` fires only after marketing consent.
- `ViewContent` is configured on `index.html` for the main landing page, only after marketing consent.
- `Lead` is configured only on `thank-you.html`, so it should fire after a completed intake submission and redirect, only after marketing consent.
- `InitiateCheckout` is configured on `/checkout/start/`, only after marketing consent.
- `Purchase` is configured on `/checkout/success/` when a Stripe `session_id` is present, only after marketing consent.
- Checkout events include `content_ids`, `content_type`, `num_items`, `value` and `currency` where relevant.
- Tally CTA links preserve `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` and add `landing_page` automatically.
- Paid-first Tally links add `customer_path=paid_first`, `offer=beta_pack_49` and, when available, `stripe_session_id`.
- Tally needs a public completion redirect URL. Use the final hosted URL, for example `https://<project>.pages.dev/thank-you.html` or the final GoHighLevel URL. Do not use the local `file://` path.
- Recommended extra Tally hidden fields for paid-first matching: `customer_path`, `offer`, `stripe_session_id`, `landing_page`.

## Dynamic Checkout

Cloudflare Pages Functions:

```text
POST /api/checkout/session
POST /api/stripe/webhook
```

Required environment variables:

```text
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NRO_BETA_PACK_PRICE_ID
NRO_PUBLIC_BASE_URL
ORDER_SHEET_WEBHOOK_URL
ORDER_SHEET_SHARED_SECRET
```

Google Sheet destination:

```text
NRO Beta Leads - Intake & Delivery Tracker -> Paid Orders
```

## Design Direction

- Warm white notebook surface.
- Light grid background.
- Handwritten-style headline only.
- Clean SaaS-readable body typography.
- Visual metaphor: source material, Business Brain and newsletter draft.
- No AI robot framing.
- No deliverability or revenue guarantees.

## Polish Pass - 2026-06-11

Added flat HTML/CSS/JS enhancements with no external dependencies:

- Scroll progress bar.
- Scroll reveal on strategic sections and cards.
- Subtle CTA sheen on hover.
- Micro-parallax on the hero paper stack.
- Paper-line shimmer inside the mock newsletter draft.
- Floating pencil motion.
- Hover lift on problem notes, steps, deliverables, fit boxes and pricing.
- Dark offer band with subtle sweep lighting.
- `prefers-reduced-motion` support.

These effects are progressive enhancement: if JavaScript is disabled, the page remains readable and usable.

## Font Test Notes

- Variant A, original: `"Bradley Hand", "Segoe Print", "Comic Sans MS", Inter, sans-serif` with larger hero sizing. Strong handwritten feel, lower readability.
- Variant B, current: `"Segoe Print", "Bradley Hand", "Comic Sans MS", Inter, sans-serif` with slightly smaller hero sizing and taller line-height. Same concept, more readable.

## Launch Notes

- This can be opened directly in a browser.
- For local review before deploy, open `00_preview-hub.html` and use its links to comment on the unpublished file previews. It is a local review hub, not a funnel page; it includes `noindex,nofollow` in case it is deployed accidentally.
- For production, host as static HTML or convert to React/Next.
- Tally form is connected. Dynamic Stripe Checkout source is present, but requires Cloudflare env vars and Stripe webhook setup before public paid traffic.
- Privacy Policy, Cookie Policy, legal footer and a lightweight consent banner are installed in V0. This is review-ready, not legal advice.
- Meta Pixel is blocked until the visitor accepts marketing cookies.
- Free/static hosting recommendation: Cloudflare Pages for best long-term static hosting; Netlify Drop for fastest no-repo preview; Vercel if the page later becomes a Next.js app; GoHighLevel if CRM/funnel management convenience matters more than static hosting cleanliness.

## SEO + AI Search Pass - 2026-06-13

Applied from AIOS `SEO and AI Search`, `AI Search Visibility`, `Content Marketing Operating System` and official Google/OpenAI search crawler guidance.

Added:

- Homepage canonical, robots meta, Open Graph, Twitter Card, favicon and JSON-LD graph.
- Structured data for `Organization`, `WebSite`, `Service`, `WebPage` and matching `FAQPage`.
- A visible sourceable homepage section explaining what NRO is, who it is for, what it does and what it does not do.
- Indexable guide page: `newsletter-revenue-system/`, built as a source page for queries around newsletter revenue systems, email list monetization, AI newsletter writing, email list reactivation and newsletter consistency.
- Expanded guide coverage for: target fit, why lists go quiet, AI newsletter writer vs newsletter revenue system, common monetization mistakes, checklist, metrics and NRO's assisted beta mechanism.
- `robots.txt` with public search/AI crawler allowance and sitemap reference.
- `sitemap.xml` with homepage, guide, privacy policy and cookie policy.
- `llms.txt` with a concise machine-readable summary for AI agents and answer tools. This is intentionally treated as experimental support, not as a Google SEO requirement.
- `noindex,follow` on thank-you and checkout pages, plus Cloudflare `_headers` noindex rules for preview/checkout/API paths.
- Favicon and OG image assets.

Important:

- Current canonical domain is `https://newsletter-revenue-operator.pages.dev/`. If a custom domain is added, update canonical URLs, sitemap, robots, Open Graph, JSON-LD, `llms.txt`, Tally redirects and Stripe base URL together.
- `llms.txt` should not be marketed as a ranking hack. It exists for agent-readability and clarity.
- Next live steps: verify property in Google Search Console, submit `sitemap.xml`, verify in Bing Webmaster Tools, evaluate IndexNow only after a stable domain and publishing workflow are set.
- Future SEO moat should come from non-commodity source pages: examples, teardown, checklists, comparisons, output samples and proof assets. Do not mass-produce thin AI pages.

QA completed locally:

- HTML parser, JSON-LD parser and sitemap XML parser passed.
- Local internal href/src references resolve.
- Indexability intent checked: homepage, guide, privacy and cookie pages are indexable; preview hub, checkout and thank-you pages are noindex.
- Automated visual browser rendering could not be completed in this sandbox because Chromium launch was blocked by macOS permissions; use `00_preview-hub.html` for manual visual review before pushing.

## Assisted Delivery V0

- Do not ask customers to provide a destination Drive folder in the intake form. It adds friction and creates avoidable access/confidence issues.
- Create the pack inside the AIOS workflow, then export/share it as a Google Doc and optional PDF.
- Deliver by email to the address collected in Tally. For the first test, `info@sprintagency.it` can be used with sender name `Newsletter Revenue Operator by SprintAgency`.
- Later, after validation, add a dedicated sender/domain alias such as `hello@newsletterrevenueoperator.com`.
- If a customer bought first, match the Stripe order and Tally row by email first and `stripe_session_id` when present.

## Legal Data Used

- Public footer label: Newsletter Revenue Operator - Private Beta.
- Public footer admin line: P.IVA IT16566571002 and info@sprintagency.it, styled as low-emphasis footer details.
- Privacy Policy controller label: SprintAgency / Lorenzo Mottola.
- VAT ID: IT16566571002.
- Contact email: info@sprintagency.it.
- Registered office / PEC were not found in the available project references and were not invented.
