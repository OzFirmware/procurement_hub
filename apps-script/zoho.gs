// ===== Zoho Books integration: push a PR's PO to Zoho Books =====
//
// Manual, admin-triggered only (the 'zohoPushPo' route below) — never fired
// automatically off a PR event. Vendor/item matching can't be verified
// without a live account, so a human should confirm the local PO (made via
// the "Make a PO" flow in prs.gs) before pushing it to Zoho for real.
//
// ---- One-time setup ----
// 1. In the Zoho API Console (api-console.zoho.com), register a "Self
//    Client" (recommended for a backend-only integration with no browser
//    redirect) with these scopes: ZohoBooks.purchaseorders.CREATE,
//    ZohoBooks.contacts.READ, ZohoBooks.settings.READ
// 2. Under that client's "Generate Code" tab, generate an authorization
//    code, then exchange it once (by hand, e.g. with curl) for a
//    refresh_token at {accounts domain}/oauth/v2/token — the refresh token
//    doesn't expire until revoked, so this is a one-time step.
// 3. Set these in Project Settings → Script properties:
//      ZOHO_CLIENT_ID
//      ZOHO_CLIENT_SECRET
//      ZOHO_REFRESH_TOKEN
//      ZOHO_ORGANIZATION_ID   — Zoho Books → Settings → Organizations
//      ZOHO_REGION            — the data center your account lives in:
//                                com | in | eu | com.au | jp | ca
// 4. On each Vendor (Admin → Vendors), fill in "Zoho Vendor ID" — the
//    Contact ID from Zoho Books → Contacts. Pushing a PO for a vendor
//    without one fails with a clear error rather than guessing or creating
//    a new Zoho contact.
// 5. In Zoho Books → Settings → Currencies, add every currency your PRs are
//    raised in (USD, EUR, JPY, ...) — Zoho only exposes currencies the
//    organization has explicitly enabled, and a push fails with a clear
//    error rather than silently booking a foreign PO in your base currency.
//
// Nothing here executes, and no property needs to be set, until someone
// actually clicks "Send to Zoho Books" on an admin's PR detail page.

function zohoProp_(key) {
  var v = PropertiesService.getScriptProperties().getProperty(key);
  if (!v) throw new Error('Zoho integration is not configured — missing script property ' + key);
  return v;
}

function zohoAccountsDomain_() { return 'https://accounts.zoho.' + zohoProp_('ZOHO_REGION'); }
function zohoApiDomain_() { return 'https://books.zoho.' + zohoProp_('ZOHO_REGION'); }

// Access tokens live an hour (Zoho's limit) — cache one instead of a token
// round-trip on every push.
function zohoAccessToken_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('zoho_access_token');
  if (cached) return cached;
  var resp = UrlFetchApp.fetch(zohoAccountsDomain_() + '/oauth/v2/token', {
    method: 'post',
    payload: {
      grant_type: 'refresh_token',
      client_id: zohoProp_('ZOHO_CLIENT_ID'),
      client_secret: zohoProp_('ZOHO_CLIENT_SECRET'),
      refresh_token: zohoProp_('ZOHO_REFRESH_TOKEN')
    },
    muteHttpExceptions: true
  });
  var body = JSON.parse(resp.getContentText());
  if (!body.access_token) throw new Error('Zoho token refresh failed: ' + (body.error || resp.getContentText()));
  cache.put('zoho_access_token', body.access_token, 3300); // a bit under the 1h expiry
  return body.access_token;
}

// Vendors are bought from in whatever currency their country invoices in —
// USD from the US, EUR from the EU, JPY from Japan, etc. — so the PO must
// carry a currency_id or Zoho silently books it in the org's base currency
// (a ₹ organization would record a $5,000 order as ₹5,000). Zoho assigns
// currency_id per organization (only currencies you've explicitly enabled in
// Zoho Books → Settings → Currencies get one), so it has to be looked up,
// never hardcoded. exchange_rate is deliberately omitted — Zoho fills in its
// own current rate; pass one explicitly here later if the business ever
// needs to lock a quoted rate instead.
function zohoCurrencies_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('zoho_currencies');
  if (cached) return JSON.parse(cached);
  var url = zohoApiDomain_() + '/books/v3/settings/currencies?organization_id=' + encodeURIComponent(zohoProp_('ZOHO_ORGANIZATION_ID'));
  var resp = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: 'Zoho-oauthtoken ' + zohoAccessToken_() },
    muteHttpExceptions: true
  });
  var body = JSON.parse(resp.getContentText());
  if (!body.currencies) throw new Error('Could not load Zoho Books currencies: ' + (body.message || resp.getContentText()));
  var map = {};
  body.currencies.forEach(function (c) { map[String(c.currency_code || '').toUpperCase()] = c.currency_id; });
  cache.put('zoho_currencies', JSON.stringify(map), 21600); // 6h — an org's enabled currencies rarely change
  return map;
}
function zohoCurrencyId_(code) {
  if (!code) return null;
  return zohoCurrencies_()[String(code).toUpperCase()] || null;
}

// Pure — builds the exact Zoho request body from a PR + its items + its
// vendor record + a resolved currency_id (looked up separately since that's
// the one piece that needs a network call). No network calls of its own, so
// this can be dry-run / eyeballed on its own before ever touching
// UrlFetchApp (see the "Zoho PO Payload Preview" test bench for exactly that).
function buildZohoPoPayload_(pr, items, vendor, currencyId) {
  if (!vendor || !vendor.zohoVendorId) {
    throw new Error('Vendor "' + pr.vendor + '" has no Zoho Vendor ID set — add one on the Vendors tab first');
  }
  if (pr.currency && !currencyId) {
    throw new Error('Zoho Books has no "' + pr.currency + '" currency enabled for this organization — ' +
      'add it under Zoho Books → Settings → Currencies, then try again');
  }
  return {
    vendor_id: vendor.zohoVendorId,
    currency_id: currencyId || undefined,
    // the PO's own issue date (set in "Make a PO"), not the PR's original
    // request date — those are different moments
    date: String(pr.poDate || pr.createdAt || '').slice(0, 10),
    delivery_date: pr.expectedDate ? String(pr.expectedDate).slice(0, 10) : undefined,
    reference_number: pr.id,
    payment_terms_label: pr.paymentTerm || undefined,
    notes: pr.notes || undefined,
    line_items: (items || []).map(function (it) {
      return {
        name: it.description,
        description: [it.materialType, [it.qty, it.unit].filter(Boolean).join(' ')].filter(Boolean).join(' — '),
        rate: Number(it.unitPrice) || 0,
        quantity: Number(it.qty) || 1
      };
    })
  };
}

function pushPoToZoho_(pr, items, vendor) {
  var currencyId = zohoCurrencyId_(pr.currency);
  var payload = buildZohoPoPayload_(pr, items, vendor, currencyId);
  var url = zohoApiDomain_() + '/books/v3/purchaseorders?organization_id=' + encodeURIComponent(zohoProp_('ZOHO_ORGANIZATION_ID'));
  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Zoho-oauthtoken ' + zohoAccessToken_() },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  var body = JSON.parse(resp.getContentText());
  if (resp.getResponseCode() >= 300 || !body.purchaseorder) {
    throw new Error('Zoho Books rejected the PO: ' + (body.message || resp.getContentText()));
  }
  return body.purchaseorder; // { purchaseorder_id, purchaseorder_number, ... }
}

registerRoute_('zohoPushPo', { minRole: 'admin' }, function (user, body) {
  return withLock_(function () {
    var pr = findPr_(body.id);
    if (!pr.poNo) throw new Error('Make a PO for ' + pr.id + ' first — Zoho needs a PO number to attach to');
    if (pr.zohoPoId) throw new Error(pr.id + ' was already pushed to Zoho as PO ' + pr.zohoPoNumber);
    var items = listAllItems_().filter(function (it) { return it.prId === pr.id; });
    var vendor = listVendors_().filter(function (v) {
      return v.name.toLowerCase() === String(pr.vendor || '').toLowerCase();
    })[0];
    var zpo = pushPoToZoho_(pr, items, vendor);
    pr.zohoPoId = String(zpo.purchaseorder_id || '');
    pr.zohoPoNumber = String(zpo.purchaseorder_number || '');
    pr.updatedAt = nowIso_();
    writePr_(pr);
    log_(user, pr.id, 'zohoPushPo', 'Zoho PO ' + pr.zohoPoNumber + ' (' + pr.zohoPoId + ')');
    return { pr: pr };
  });
});
