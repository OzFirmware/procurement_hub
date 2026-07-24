// ===== Items tab: one row per PR line item =====

var ITEM_HEADERS = ['prId', 'itemNo', 'description', 'partNo', 'materialType', 'qty', 'unit',
  'unitPrice', 'lineTotal', 'purchaseLink', 'datasheetDoc'];

// fields accepted from clients; prId/itemNo/lineTotal are server-assigned
var ITEM_FIELDS = ['description', 'partNo', 'materialType', 'qty', 'unit', 'unitPrice',
  'purchaseLink', 'datasheetDoc'];

function itemSheet_() { return sheet_('Items', ITEM_HEADERS); }

function rowToItem_(row) {
  var it = {};
  ITEM_HEADERS.forEach(function (h, i) { it[h] = cellStr_(row[i]); });
  return it;
}

function listAllItems_() {
  var data = itemSheet_().getDataRange().getValues();
  var out = [];
  for (var i = 1; i < data.length; i++) {
    var it = rowToItem_(data[i]);
    if (it.prId) out.push(it);
  }
  return out;
}

function numOrBlank_(v) {
  if (v === '' || v == null) return '';
  var n = Number(v);
  return isFinite(n) ? n : '';
}

// Normalize client-supplied items: skip empty rows, assign itemNo,
// lineTotal = qty × unitPrice when both numeric, else preserved from the
// submitted row total — carries legacy/form row totals through edits.
function normalizeItems_(raw) {
  var items = [];
  (raw || []).forEach(function (r) {
    if (!r || !String(r.description || '').trim()) return;
    var it = {};
    ITEM_FIELDS.forEach(function (f) { it[f] = r[f] != null ? String(r[f]) : ''; });
    var q = numOrBlank_(it.qty), u = numOrBlank_(it.unitPrice);
    var computed = (q !== '' && u !== '') ? Math.round(q * u * 100) / 100 : '';
    it.lineTotal = computed !== '' ? computed : numOrBlank_(r.lineTotal);
    items.push(it);
  });
  var sum = 0, any = false;
  items.forEach(function (it, i) {
    it.itemNo = i + 1;
    if (it.lineTotal !== '') { sum += it.lineTotal; any = true; }
  });
  return { items: items, totalAmount: any ? Math.round(sum * 100) / 100 : '' };
}

// Replace-all write of a PR's items. Caller must hold withLock_.
function writeItemsForPr_(prId, items) {
  var sh = itemSheet_();
  var data = sh.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (cellStr_(data[i][0]) === prId) sh.deleteRow(i + 1);
  }
  if (items.length) {
    var rows = items.map(function (it) {
      return ITEM_HEADERS.map(function (h) { return h === 'prId' ? prId : (it[h] != null ? it[h] : ''); });
    });
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, ITEM_HEADERS.length).setValues(rows);
  }
}

function itemSummary_(items) {
  if (!items.length) return '';
  var first = items[0].description || '';
  return items.length > 1 ? first + ' (+' + (items.length - 1) + ' more)' : first;
}
