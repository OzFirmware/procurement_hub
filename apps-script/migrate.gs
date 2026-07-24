// ===== One-time migration: legacy spreadsheet dept tabs → Procurement Hub PRs + Items =====
// 1. Paste the OLD spreadsheet's Drive file id into LEGACY_FILE_ID.
// 2. Run dumpLegacyHeaders() and eyeball unmapped headers; extend HEADER_MAP if needed.
// 3. Run migrateLegacy(). Idempotent (skips when PRs has data). Old file is never written.

var LEGACY_FILE_ID = ''; // <-- old spreadsheet id (from its URL)

var LEGACY_SKIP_TABS = ['PRs', 'Users', 'Log', 'Form Responses 1'];

// normalized legacy header → current field. Item-level and PR-level fields mixed;
// splitLegacyRow_ decides which goes where.
var HEADER_MAP = {
  // item-level
  item: ['item', 'itemname', 'itemdescription', 'description', 'material', 'materialname', 'product', 'particulars', 'productdescription'],
  qty: ['qty', 'quantity', 'nos', 'noofunits'],
  partNo: ['zohopartnumber', 'partno', 'partnumber'],
  materialType: ['typesofmaterial', 'materialtype', 'category'],
  purchaseLink: ['purchaselink', 'producturl', 'link'],
  datasheetDoc: ['datasheet', 'specdocument'],
  // PR-level
  vendor: ['vendor', 'vendorname', 'supplier', 'suppliername', 'party', 'platform', 'source'],
  amount: ['amount', 'price', 'cost', 'value', 'total', 'totalamount', 'totalcost', 'approxcost'],
  currency: ['currency', 'cur'],
  priority: ['priority', 'urgency'],
  status: ['status', 'materialstatus', 'orderstatus', 'currentstatus', 'prstatus'],
  paymentStatus: ['payment', 'paymentstatus', 'paymentstate'],
  paymentTerm: ['paymentterm', 'paymentterms'],
  courier: ['courier', 'couriername', 'shippingvia', 'ffcourier'],
  trackingNo: ['tracking', 'trackingno', 'trackingnumber', 'awb', 'awbno', 'consignmentno'],
  trackingLink: ['trackinglink'],
  expectedDate: ['expecteddate', 'expecteddelivery', 'eta', 'deliverydate', 'duedate'],
  receivedAt: ['receiveddate', 'receivedon', 'matrcvdate'],
  createdAt: ['prdate', 'requestdate', 'requesteddate', 'createdat', 'timestamp'],
  requesterEmail: ['email', 'emailaddress'],
  requestedByName: ['requestedby', 'requester', 'raisedby'],
  approvedByName: ['approvedby'],
  project: ['projectdetails', 'project'],
  purpose: ['purposeofpurchase', 'purpose'],
  poNo: ['pono', 'ponumber'],
  poDate: ['podate'],
  invoiceNo: ['invoiceorderno', 'invoiceno', 'orderno'],
  invoiceDate: ['invoiceorderdate', 'invoicedate'],
  quotationDoc: ['pipoquotation', 'quotation'],
  notes: ['remarks', 'notes', 'comment', 'comments'],
  department: ['department', 'departmentname', 'dept']
};

// long/mangled legacy headers matched by prefix when no exact hit
var HEADER_PREFIX_MAP = {
  datasheetDoc: ['materialrequirementspecificdocument'],
  invoiceNo: ['quotenopino']
};

var ITEM_LEVEL_FIELDS = ['item', 'qty', 'partNo', 'materialType', 'purchaseLink', 'datasheetDoc'];

var OLD_STATUS_MAP = {
  'in process': 'Ordered', 'in transit': 'In Transit', 'received': 'Received',
  'cancelled': 'Cancelled', 'on hold': 'On Hold'
};

function norm_(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

function legacySs_() {
  if (!LEGACY_FILE_ID) throw new Error('Set LEGACY_FILE_ID at the top of migrate.gs first');
  return SpreadsheetApp.openById(LEGACY_FILE_ID);
}

function dumpLegacyHeaders() {
  var out = {};
  legacySs_().getSheets().forEach(function (sh) {
    if (LEGACY_SKIP_TABS.indexOf(sh.getName()) !== -1 || sh.getLastRow() < 1) return;
    out[sh.getName()] = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  });
  Logger.log(JSON.stringify(out, null, 2));
  return out;
}

// header row → { field: colIndex } using exact then prefix matching
function resolveIdx_(headers) {
  var idx = {};
  Object.keys(HEADER_MAP).forEach(function (field) {
    for (var c = 0; c < headers.length; c++) {
      if (HEADER_MAP[field].indexOf(headers[c]) !== -1) { idx[field] = c; return; }
    }
    var prefixes = HEADER_PREFIX_MAP[field] || [];
    for (var c2 = 0; c2 < headers.length; c2++) {
      for (var p = 0; p < prefixes.length; p++) {
        if (headers[c2].indexOf(prefixes[p]) === 0) { idx[field] = c2; return; }
      }
    }
  });
  return idx;
}

// "10 L" → { qty: '10', unit: 'L' }; non-numeric qty → unit only
function parseQtyUnit_(s) {
  var t = String(s || '').trim();
  if (!t) return { qty: '', unit: '' };
  var m = t.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if (!m) return { qty: '', unit: t.slice(0, 20) };
  return { qty: m[1], unit: (m[2] || '').slice(0, 20) };
}

// GAS port of frontend parseAmtStr (frontend/src/lib/currency.js:27).
// Returns { amt } | { amt, note } | { note } | {} — never guesses.
function parseAmount_(s) {
  if (s == null) return {};
  var t = String(s).trim();
  if (['', 'na', 'n/a', '-', 'nan', 'tbd', '--'].indexOf(t.toLowerCase()) !== -1) return {};
  var m = t.match(/(\d[\d,]*(?:\.\d+)?)/);
  if (!m) return { note: t.slice(0, 80) };
  var amt = Math.round(parseFloat(m[1].replace(/,/g, '')) * 100) / 100;
  var clean = t.replace(/[\d,.\s₹$€£¥]+/g, '').toLowerCase();
  var trivial = ['inr', 'usd', 'rs', 'eur', 'euro', 'gbp'];
  return (clean && trivial.indexOf(clean) === -1) ? { amt: amt, note: t.slice(0, 80) } : { amt: amt };
}

var CUR_TOKENS_ = [
  ['USD', ['usd', 'us$', 'dollar', '$']], ['EUR', ['euro', 'eur', '€']], ['GBP', ['gbp', 'pound', '£']],
  ['INR', ['inr', 'rupee', 'rs.', 'rs ', '₹']], ['AED', ['aed', 'dirham']], ['SGD', ['sgd']]
];

function detectCurrency_(curCol, amtStr) {
  var probe = [curCol, amtStr];
  for (var i = 0; i < probe.length; i++) {
    var t = String(probe[i] || '').toLowerCase();
    if (!t) continue;
    for (var c = 0; c < CUR_TOKENS_.length; c++) {
      var toks = CUR_TOKENS_[c][1];
      for (var k = 0; k < toks.length; k++) if (t.indexOf(toks[k]) !== -1) return CUR_TOKENS_[c][0];
    }
    if (/^[a-z]{3}$/.test(t.trim())) return t.trim().toUpperCase();
  }
  return '';
}

function migrateLegacy() {
  var target = prSheet_();
  if (target.getLastRow() > 1) {
    Logger.log('PRs tab already has data — migration skipped (idempotent).');
    return 0;
  }
  var prRows = [], itemRows = [], vendorRows = [], vendorSeen = {};
  var counter = 0;

  legacySs_().getSheets().forEach(function (sh) {
    var tab = sh.getName();
    if (LEGACY_SKIP_TABS.indexOf(tab) !== -1 || sh.getLastRow() < 2) return;
    var data = sh.getDataRange().getValues();
    var headers = data[0].map(norm_);
    var idx = resolveIdx_(headers);
    var mapped = Object.keys(idx).map(function (f) { return idx[f]; });

    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      if (row.every(function (c) { return c === '' || c == null; })) continue;
      counter++;
      var raw = {};
      Object.keys(idx).forEach(function (f) { raw[f] = cellStr_(row[idx[f]]); });

      var pr = { id: 'PR-MIG-' + ('00000' + counter).slice(-5), department: tab, updatedAt: nowIso_() };
      Object.keys(raw).forEach(function (f) {
        if (ITEM_LEVEL_FIELDS.indexOf(f) === -1 && f !== 'amount') pr[f] = raw[f];
      });
      pr.department = tab; // tab name wins over any mapped Department column
      pr.status = OLD_STATUS_MAP[String(pr.status || '').toLowerCase().trim()] || 'Received';
      pr.requesterEmail = String(pr.requesterEmail || '').toLowerCase();
      if (!pr.createdAt) pr.createdAt = nowIso_();

      // money: parsed number → lineTotal + totalAmount; unparseable → notes verbatim
      var money = parseAmount_(raw.amount);
      pr.totalAmount = money.amt != null ? money.amt : '';
      pr.currency = detectCurrency_(raw.currency, raw.amount);
      if (money.note) pr.notes = ((pr.notes || '') + ' | amount: ' + money.note).replace(/^ \| /, '');

      // preserve unmapped columns in notes (same as v1)
      var extras = [];
      for (var c = 0; c < row.length; c++) {
        if (mapped.indexOf(c) === -1 && cellStr_(row[c])) {
          extras.push(String(data[0][c]) + ': ' + cellStr_(row[c]));
        }
      }
      if (extras.length) pr.notes = ((pr.notes || '') + ' | ' + extras.join(' | ')).replace(/^ \| /, '');

      // single item per legacy row; lineTotal carries the row's parsed total
      var qu = parseQtyUnit_(raw.qty);
      itemRows.push(ITEM_HEADERS.map(function (h) {
        return { prId: pr.id, itemNo: 1, description: raw.item || '', partNo: raw.partNo || '',
                 materialType: raw.materialType || '', qty: qu.qty, unit: qu.unit, unitPrice: '',
                 lineTotal: pr.totalAmount, purchaseLink: raw.purchaseLink || '',
                 datasheetDoc: raw.datasheetDoc || '' }[h];
      }));

      var vkey = String(pr.vendor || '').trim().toLowerCase();
      if (vkey && !vendorSeen[vkey]) {
        vendorSeen[vkey] = true;
        var vend = { name: String(pr.vendor).trim(), addedBy: 'migration', addedAt: nowIso_() };
        vendorRows.push(VENDOR_HEADERS.map(function (h) { return vend[h] != null ? vend[h] : ''; }));
      }

      prRows.push(PR_HEADERS.map(function (h) { return pr[h] != null ? pr[h] : ''; }));
    }
  });

  if (prRows.length) target.getRange(2, 1, prRows.length, PR_HEADERS.length).setValues(prRows);
  if (itemRows.length) itemSheet_().getRange(2, 1, itemRows.length, ITEM_HEADERS.length).setValues(itemRows);
  if (vendorRows.length) vendorSheet_().getRange(2, 1, vendorRows.length, VENDOR_HEADERS.length).setValues(vendorRows);
  Logger.log('Migrated ' + prRows.length + ' PRs, ' + itemRows.length + ' items, ' + vendorRows.length + ' vendors.');
  return prRows.length;
}
