// ===== Lists tab: one column per dropdown list =====
// Admins edit this tab directly in the sheet; no UI, no route.

// currencies moved out of Lists: the frontend ships the full ISO 4217 list
// (frontend/src/lib/currencies.js) and the sheet validates against
// CURRENCY_CODES in setup.gs. A leftover currencies column is harmless.
var LISTS_HEADERS = ['departments', 'materialTypes', 'priorities', 'couriers',
  'paymentTerms', 'units'];

var LISTS_SEED = {
  departments: ['Admin', 'Device Management', 'Environment', 'Marketing', 'Production',
    'Projects', 'QC', 'R&D', 'Sales', 'Support'],
  materialTypes: ['Asset', 'Inventory', 'Local Purchase', 'Subscription', 'Certification'],
  priorities: ['High', 'Medium', 'Low'],
  couriers: ['BlueDart', 'DHL', 'FedEx', 'DTDC', 'India Post', 'Amazon', 'Porter', 'Delhivery', 'Other'],
  paymentTerms: ['Advance 100%', 'Advance 50%', 'Net 15', 'Net 30', 'On Delivery', 'Milestone'],
  units: ['pcs', 'L', 'kg', 'm', 'set', 'box', 'license']
};

function getLists_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('lists-v3');
  if (hit) return JSON.parse(hit);
  var data = sheet_('Lists', LISTS_HEADERS).getDataRange().getValues();
  var out = {};
  LISTS_HEADERS.forEach(function (h, c) {
    out[h] = [];
    for (var r = 1; r < data.length; r++) {
      var v = cellStr_(data[r][c]);
      if (v) out[h].push(v);
    }
  });
  cache.put('lists-v3', JSON.stringify(out), 300);
  return out;
}
