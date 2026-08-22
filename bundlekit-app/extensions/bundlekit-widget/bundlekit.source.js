/**
 * BundleKit storefront widget — EDIT THIS FILE, not assets/bundlekit.js.
 *
 * Shopify enforces a hard 10,000-byte limit on theme app-block JavaScript
 * (AssetSizeAppBlockJavaScript); this commented, readable copy is well over
 * that, so `npm run build:widget` strips comments/whitespace (identifiers
 * stay intact) into assets/bundlekit.js, which is what actually ships.
 * Run it after every change to this file, before `shopify app deploy`.
 *
 * Rules this file lives by:
 *   - no framework, no dependencies, no external fonts
 *   - no network request before first paint; the offer is already in the DOM
 *   - if anything is wrong, hide rather than break. A product page that still
 *     sells is worth more than a widget that shouts.
 *
 * The pricing math below mirrors app/lib/pricing.ts. Money is in integer
 * minor units throughout. Never introduce a float price here.
 */
(function () {
  "use strict";

  var CART_ADD = "/cart/add.js";

  /* ---------------- pricing (mirrors app/lib/pricing.ts) --------------- */

  function roundHalfUp(value) {
    return value < 0 ? -Math.round(-value) : Math.round(value);
  }

  function clampPercent(percent) {
    if (!isFinite(percent)) return 0;
    return Math.min(100, Math.max(0, percent));
  }

  function priceTier(unitPrice, tier) {
    var quantity = Math.max(1, Math.floor(tier.quantity));
    var subtotal = unitPrice * quantity;
    var total;

    if (tier.type === "percentage") {
      total = roundHalfUp((subtotal * (100 - clampPercent(tier.value))) / 100);
    } else if (tier.type === "amount") {
      total = subtotal - roundHalfUp(tier.value);
    } else if (tier.type === "fixed_price") {
      total = roundHalfUp(tier.value);
    } else {
      total = subtotal;
    }

    total = Math.min(subtotal, Math.max(0, total));
    var savings = subtotal - total;

    return {
      quantity: quantity,
      subtotal: subtotal,
      total: total,
      savings: savings,
      perUnit: roundHalfUp(total / quantity),
      percentOff: subtotal === 0 ? 0 : Math.round((savings / subtotal) * 10000) / 100,
      badge: Boolean(tier.badge),
    };
  }

  function normaliseTiers(tiers) {
    var seen = {};
    var out = [];
    (tiers || []).forEach(function (tier) {
      var quantity = Math.floor(tier.quantity);
      if (quantity < 2 || seen[quantity]) return;
      seen[quantity] = true;
      out.push({
        quantity: quantity,
        type: tier.type,
        value: Number(tier.value),
        badge: Boolean(tier.badge),
      });
    });
    return out.sort(function (a, b) {
      return a.quantity - b.quantity;
    });
  }

  /* ---------------- money formatting ---------------- */

  /** Uses the shop's own money_format so the widget matches every other price
   *  on the page, including comma decimals and currencies without cents. */
  function makeFormatter(format) {
    return function (cents) {
      var value = cents / 100;
      return format.replace(/\{\{\s*(\w+)\s*\}\}/g, function (_, token) {
        switch (token) {
          case "amount":
            return group(value.toFixed(2), ",", ".");
          case "amount_no_decimals":
            return group(Math.round(value).toFixed(0), ",", ".");
          case "amount_with_comma_separator":
            return group(value.toFixed(2), ".", ",");
          case "amount_no_decimals_with_comma_separator":
            return group(Math.round(value).toFixed(0), ".", ",");
          case "amount_with_apostrophe_separator":
            return group(value.toFixed(2), "'", ".");
          default:
            return value.toFixed(2);
        }
      });
    };
  }

  /** Mirrors app/components/OfferPreview.tsx's savingsLabel() so the
   *  storefront and the admin preview never disagree about the wording. */
  function savingsLabel(format, savings, percentOff, saveWord, mode) {
    var amount = format(savings);
    if (mode === "amount") return saveWord + " " + amount;
    if (mode === "percentage") return saveWord + " " + percentOff + "%";
    return saveWord + " " + amount + " (" + percentOff + "%)";
  }

  function group(fixed, thousands, decimal) {
    var parts = fixed.split(".");
    var whole = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
    return parts[1] ? whole + decimal + parts[1] : whole;
  }

  /* ---------------- DOM helpers ---------------- */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function readJson(root, selector) {
    var node = root.querySelector(selector);
    if (!node) return null;
    try {
      return JSON.parse(node.textContent);
    } catch (error) {
      return null;
    }
  }

  function productForm(root) {
    // The nearest real add-to-cart form. Themes differ; this covers OS 2.0.
    return (
      root.closest("form[action*='/cart/add']") ||
      document.querySelector("form[action*='/cart/add']:not([hidden])")
    );
  }

  /* ---------------- the widget ---------------- */

  function mount(root) {
    var offerRaw = readJson(root, "[data-bundlekit-offer]");
    var offer = offerRaw && offerRaw.value ? offerRaw.value : offerRaw;
    var productData = readJson(root, "[data-bundlekit-product]");
    var strings = readJson(root, "[data-bundlekit-strings]") || {};
    var settings = readJson(root, "[data-bundlekit-settings]") || {};
    var container = root.querySelector("[data-bundlekit-root]");

    if (!offer || !productData || !container) return hide(root);

    var tiers = normaliseTiers(offer.tiers);
    if (!tiers.length) return hide(root);

    var format = makeFormatter(root.getAttribute("data-money-format") || "{{amount}}");
    var offerId = root.getAttribute("data-offer-id") || offer.id;
    var form = productForm(root);
    var selectedIndex = indexOfBadged(tiers);

    function currentVariant() {
      var input = form && form.querySelector("[name='id']");
      var id = input ? Number(input.value) : productData.selected;
      for (var i = 0; i < productData.variants.length; i++) {
        if (productData.variants[i].id === id) return productData.variants[i];
      }
      return productData.variants[0];
    }

    function render() {
      var variant = currentVariant();
      if (!variant) return hide(root);
      var unitPrice = variant.price;

      container.textContent = "";

      var head = el("div", "bundlekit__head");
      head.appendChild(el("span", null, strings.heading || "Bundle & save"));
      container.appendChild(head);

      // Tier zero: the plain price, so the choice is honest.
      container.appendChild(
        tierRow({
          index: -1,
          label: "1 " + (strings.unit || "unit"),
          note: strings.regular || "Regular price",
          total: format(unitPrice),
          savings: null,
          badge: false,
          selected: selectedIndex === -1,
        }),
      );

      var savingsMode = settings.savingsDisplay || "both";
      tiers.forEach(function (tier, index) {
        var priced = priceTier(unitPrice, tier);
        container.appendChild(
          tierRow({
            index: index,
            label: priced.quantity + " " + (strings.units || "units"),
            note: format(priced.perUnit) + " " + (strings.per_unit || "/ unit"),
            total: format(priced.total),
            savings: savingsLabel(format, priced.savings, priced.percentOff, strings.save || "save", savingsMode),
            badge: priced.badge,
            selected: selectedIndex === index,
          }),
        );
      });

      if (settings.showTrustLine !== false) {
        container.appendChild(
          el("p", "bundlekit__trust", strings.trust || "Discount applied automatically at checkout"),
        );
      }

      syncForm(unitPrice);
    }

    function tierRow(options) {
      var row = el("button", "bundlekit__tier");
      row.type = "button";
      row.setAttribute("role", "radio");
      row.setAttribute("aria-checked", options.selected ? "true" : "false");
      if (options.selected) row.classList.add("is-selected");

      row.appendChild(el("span", "bundlekit__dot"));

      var main = el("span", "bundlekit__main");
      main.appendChild(el("span", "bundlekit__label", options.label));
      main.appendChild(el("span", "bundlekit__note", options.note));
      row.appendChild(main);

      if (options.badge) {
        row.appendChild(el("span", "bundlekit__badge", strings.badge || "Most popular"));
      }

      var right = el("span", "bundlekit__right");
      right.appendChild(el("span", "bundlekit__total", options.total));
      if (options.savings) right.appendChild(el("span", "bundlekit__savings", options.savings));
      row.appendChild(right);

      row.addEventListener("click", function () {
        selectedIndex = options.index;
        beacon("select");
        render();
      });

      return row;
    }

    /** The native Add to cart stays in charge. We only set its quantity. */
    function syncForm(unitPrice) {
      if (!form) return;

      var quantity = selectedIndex === -1 ? 1 : tiers[selectedIndex].quantity;
      var input = form.querySelector("[name='quantity']");
      if (input) {
        input.value = String(quantity);
        input.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        // Themes that hide the quantity field still need one submitted.
        var hidden = form.querySelector("[data-bundlekit-qty]");
        if (!hidden) {
          hidden = document.createElement("input");
          hidden.type = "hidden";
          hidden.name = "quantity";
          hidden.setAttribute("data-bundlekit-qty", "");
          form.appendChild(hidden);
        }
        hidden.value = String(quantity);
      }

      tagLine(form, offerId);

      if (settings.updateButtonLabel === false) return;
      var button = form.querySelector("[type='submit'], button[name='add']");
      if (!button) return;

      var priced =
        selectedIndex === -1
          ? { total: unitPrice }
          : priceTier(unitPrice, tiers[selectedIndex]);
      var template = strings.add_to_cart || "Add %qty% to cart";
      var label = template.replace("%qty%", String(quantity)) + " — " + format(priced.total);

      var target = button.querySelector("span") || button;
      if (!button.hasAttribute("data-bundlekit-original")) {
        button.setAttribute("data-bundlekit-original", target.textContent || "");
      }
      target.textContent = label;
    }

    /** Attribution: the order webhook looks for this property. */
    function tagLine(form, id) {
      var field = form.querySelector("[data-bundlekit-prop]");
      if (!field) {
        field = document.createElement("input");
        field.type = "hidden";
        field.name = "properties[_bundlekit]";
        field.setAttribute("data-bundlekit-prop", "");
        form.appendChild(field);
      }
      field.value = id;
    }

    function beacon(event) {
      if (settings.beacons === false || !offerId) return;
      var url = root.getAttribute("data-proxy");
      if (!url || !navigator.sendBeacon) return;
      try {
        navigator.sendBeacon(
          url + "/beacon",
          new Blob([JSON.stringify({ offerId: offerId, event: event })], {
            type: "application/json",
          }),
        );
      } catch (error) {
        /* analytics must never break a product page */
      }
    }

    // Variant switches change the price, so redraw. Themes announce this in
    // several ways; listen broadly and cheaply.
    if (form) {
      form.addEventListener("change", function (event) {
        if (event.target && event.target.name === "id") render();
      });
    }
    document.addEventListener("variant:change", render);
    document.addEventListener("shopify:variant:change", render);

    render();
    beacon("view");
  }

  function indexOfBadged(tiers) {
    for (var i = 0; i < tiers.length; i++) if (tiers[i].badge) return i;
    return tiers.length ? 0 : -1;
  }

  function hide(root) {
    root.style.display = "none";
  }

  function boot() {
    var roots = document.querySelectorAll("[data-bundlekit]");
    for (var i = 0; i < roots.length; i++) {
      try {
        mount(roots[i]);
      } catch (error) {
        hide(roots[i]);
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // Theme editor: redraw when the merchant drops or edits the block.
  document.addEventListener("shopify:block:select", boot);
  document.addEventListener("shopify:section:load", boot);

  /* ---------------- companion bundle (F4) ---------------- */

  window.BundleKit = window.BundleKit || {};
  window.BundleKit.addLines = function (lines, offerId) {
    return fetch(CART_ADD, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: lines.map(function (line) {
          return {
            id: line.variantId,
            quantity: line.quantity || 1,
            properties: { _bundlekit: offerId },
          };
        }),
      }),
    }).then(function (response) {
      if (!response.ok) throw new Error("cart/add failed");
      return response.json();
    });
  };
})();
