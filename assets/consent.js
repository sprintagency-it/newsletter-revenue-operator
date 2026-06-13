(function () {
  var STORAGE_KEY = "nro_cookie_consent_v1";
  var pixelId = window.NRO_META_PIXEL_ID || "1970427430179595";
  var pageEvents = Array.isArray(window.NRO_PAGE_EVENTS) ? window.NRO_PAGE_EVENTS : [];
  var metaLoaded = false;
  var eventsTracked = false;

  function readConsent() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function writeConsent(marketing) {
    var payload = {
      necessary: true,
      marketing: Boolean(marketing),
      updatedAt: new Date().toISOString(),
      version: 1
    };

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      // If storage is unavailable, keep the choice in memory for this page view.
    }

    return payload;
  }

  function loadMetaPixel() {
    if (metaLoaded || !pixelId) return;
    metaLoaded = true;

    window.fbq = window.fbq || function () {
      window.fbq.callMethod ? window.fbq.callMethod.apply(window.fbq, arguments) : window.fbq.queue.push(arguments);
    };
    if (!window._fbq) window._fbq = window.fbq;
    window.fbq.push = window.fbq;
    window.fbq.loaded = true;
    window.fbq.version = "2.0";
    window.fbq.queue = window.fbq.queue || [];

    var script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    var firstScript = document.getElementsByTagName("script")[0];
    firstScript.parentNode.insertBefore(script, firstScript);

    window.fbq("init", pixelId);
  }

  function trackPageEvents() {
    if (eventsTracked) return;
    eventsTracked = true;
    loadMetaPixel();
    window.fbq("track", "PageView");

    pageEvents.forEach(function (event) {
      if (event && event.name) {
        window.fbq("track", event.name, event.params || {});
      }
    });
  }

  function applyConsent(consent) {
    if (consent && consent.marketing) {
      trackPageEvents();
    }
  }

  function renderBanner() {
    if (document.querySelector("[data-cookie-banner]")) return;

    var banner = document.createElement("section");
    banner.className = "cookie-banner";
    banner.setAttribute("data-cookie-banner", "");
    banner.setAttribute("aria-label", "Cookie preferences");
    banner.innerHTML =
      '<div class="cookie-banner-inner">' +
        '<div class="cookie-kicker"><span></span> Private beta measurement</div>' +
        "<h2>Help us improve NRO</h2>" +
        '<p>We use necessary storage to keep the site working. If you accept, Meta Pixel helps us understand which messages bring relevant businesses here, so we can improve this beta faster.</p>' +
        '<p class="cookie-reassurance">No contact lists, passwords or business files are tracked here. You can reject or customize now and change this later.</p>' +
        '<div class="cookie-actions">' +
          '<button class="cookie-button primary" type="button" data-cookie-accept>Accept measurement</button>' +
          '<button class="cookie-button" type="button" data-cookie-reject>Reject non-essential</button>' +
          '<button class="cookie-button" type="button" data-cookie-customize>Customize</button>' +
        "</div>" +
        '<div class="cookie-panel" data-cookie-panel hidden>' +
          "<h2>Customize</h2>" +
          '<label class="cookie-option">' +
            '<input type="checkbox" checked disabled>' +
            '<span><strong>Necessary</strong><span>Required for basic page behavior and remembering your cookie choice.</span></span>' +
          "</label>" +
          '<label class="cookie-option">' +
            '<input type="checkbox" data-cookie-marketing>' +
            '<span><strong>Measurement and advertising</strong><span>Allows Meta Pixel to load and measure PageView, Lead, InitiateCheckout or Purchase events where applicable.</span></span>' +
          "</label>" +
          '<div class="cookie-actions">' +
            '<button class="cookie-button primary" type="button" data-cookie-save>Save preferences</button>' +
          "</div>" +
        "</div>" +
      "</div>";

    document.body.appendChild(banner);

    var panel = banner.querySelector("[data-cookie-panel]");
    var marketingInput = banner.querySelector("[data-cookie-marketing]");

    banner.querySelector("[data-cookie-accept]").addEventListener("click", function () {
      applyConsent(writeConsent(true));
      banner.hidden = true;
    });

    banner.querySelector("[data-cookie-reject]").addEventListener("click", function () {
      writeConsent(false);
      banner.hidden = true;
    });

    banner.querySelector("[data-cookie-customize]").addEventListener("click", function () {
      panel.hidden = !panel.hidden;
    });

    banner.querySelector("[data-cookie-save]").addEventListener("click", function () {
      applyConsent(writeConsent(marketingInput.checked));
      banner.hidden = true;
    });
  }

  function openPreferences() {
    var existing = document.querySelector("[data-cookie-banner]");
    if (existing) existing.remove();
    renderBanner();
    var banner = document.querySelector("[data-cookie-banner]");
    var panel = banner && banner.querySelector("[data-cookie-panel]");
    var marketingInput = banner && banner.querySelector("[data-cookie-marketing]");
    var consent = readConsent();
    if (marketingInput && consent) marketingInput.checked = Boolean(consent.marketing);
    if (panel) panel.hidden = false;
  }

  document.addEventListener("click", function (event) {
    var trigger = event.target.closest("[data-cookie-preferences]");
    if (!trigger) return;
    event.preventDefault();
    openPreferences();
  });

  document.addEventListener("DOMContentLoaded", function () {
    var consent = readConsent();
    if (consent) {
      applyConsent(consent);
      return;
    }

    renderBanner();
  });
})();
