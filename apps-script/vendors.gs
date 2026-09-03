// ===== Vendors tab: canonical vendor registry =====
// departments column holds a comma-separated list; the API exposes it as an array.

var VENDOR_HEADERS = ['name', 'displayName', 'logoUrl', 'departments', 'category', 'type',
  'contactPerson', 'phone', 'email', 'address', 'website', 'gstTaxId', 'rating', 'bankName',
  'accountNumber', 'ifsc', 'swift', 'paymentTerms', 'notes', 'addedBy', 'addedAt',
  'zohoVendorId']; // the Zoho Books Contact ID this vendor maps to — see apps-script/zoho.gs

// Columns are located by header name so sheets created with the old layout
// (name, website, contactEmail, phone, notes, …) keep working; any headers
// missing from the sheet are appended to the header row.
function vendorSheet_() {
  var sh = sheet_('Vendors', VENDOR_HEADERS);
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  var missing = VENDOR_HEADERS.filter(function (h) { return head.indexOf(h) < 0; });
  if (missing.length) {
    sh.getRange(1, head.length + 1, 1, missing.length).setValues([missing]);
  }
  return sh;
}

function vendorCols_(sh) {
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  var idx = {};
  head.forEach(function (h, i) { if (h) idx[h] = i; });
  return idx;
}

function listVendors_() {
  var sh = vendorSheet_();
  var idx = vendorCols_(sh);
  var data = sh.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var get = function (h) { return idx[h] == null ? '' : cellStr_(row[idx[h]]); };
    if (!get('name')) continue;
    var v = {};
    VENDOR_HEADERS.forEach(function (h) { v[h] = get(h); });
    if (!v.email) v.email = get('contactEmail'); // legacy column
    v.departments = v.departments
      ? v.departments.split(',').map(function (s) { return s.trim(); }).filter(String)
      : [];
    v._row = i + 1;
    out.push(v);
  }
  return out;
}

function vendorsFor_(dept) {
  var d = String(dept || '').toLowerCase();
  return listVendors_().filter(function (v) {
    return v.departments.some(function (x) { return x.toLowerCase() === d; });
  }).map(function (v) { return v.name; });
}

var VENDOR_EDITABLE = VENDOR_HEADERS.filter(function (h) {
  return h !== 'addedBy' && h !== 'addedAt';
});

function vendorFieldValue_(f, val) {
  if (f === 'departments') {
    return (Array.isArray(val) ? val : String(val).split(','))
      .map(function (s) { return String(s).trim(); }).filter(String).join(', ');
  }
  return String(val);
}

// Create or update a vendor. body: { name, updates: {field: value, …} }
registerRoute_('vendorSet', { minRole: 'admin' }, function (user, body) {
  return withLock_(function () {
    var name = String(body.name || '').trim();
    if (!name) throw new Error('Vendor name required');
    var updates = body.updates || {};
    var sh = vendorSheet_();
    var idx = vendorCols_(sh);
    var vendors = listVendors_();
    var lower = name.toLowerCase();
    var found = null;
    for (var i = 0; i < vendors.length; i++) {
      if (vendors[i].name.toLowerCase() === lower) { found = vendors[i]; break; }
    }
    var newName = updates.name != null ? String(updates.name).trim() : '';
    if (newName && newName.toLowerCase() !== lower) {
      var clash = vendors.some(function (v) { return v.name.toLowerCase() === newName.toLowerCase(); });
      if (clash) throw new Error('A vendor named "' + newName + '" already exists');
    }
    if (found) {
      VENDOR_EDITABLE.forEach(function (f) {
        if (updates[f] == null) return;
        if (f === 'name' && !String(updates[f]).trim()) return;
        sh.getRange(found._row, idx[f] + 1).setValue(vendorFieldValue_(f, updates[f]));
      });
      log_(user, '', 'vendorSet', name + ': ' + Object.keys(updates).join(', '));
    } else {
      var row = [];
      var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
      head.forEach(function (h, c) {
        if (h === 'name') row[c] = newName || name;
        else if (h === 'addedBy') row[c] = user.email;
        else if (h === 'addedAt') row[c] = nowIso_();
        else if (updates[h] != null) row[c] = vendorFieldValue_(h, updates[h]);
        else row[c] = '';
      });
      sh.appendRow(row);
      log_(user, '', 'vendorAdd', name);
    }
    return { vendors: listVendors_() };
  });
});

// Lets any requester register a brand-new vendor inline while raising a PR
// (see the "+ Add new vendor" panel in prForm.js) — deliberately narrower
// than vendorSet above: only ever INSERTS a new row (never edits/overwrites
// an existing vendor) and only accepts a safe subset of fields, so admins
// still own vendor vetting (bank/tax/Zoho fields stay admin-only, edited on
// the Vendors admin page). A vendor added this way can't reach Zoho Books
// until an admin fills in its Zoho Vendor ID — see zoho.gs's zohoPushPo.
var VENDOR_QUICK_FIELDS = ['category', 'contactPerson', 'phone', 'email', 'address', 'website', 'notes'];
registerRoute_('vendorQuickAdd', { minRole: 'requester' }, function (user, body) {
  return withLock_(function () {
    var name = String(body.name || '').trim();
    if (!name) throw new Error('Vendor name required');
    var lower = name.toLowerCase();
    var vendors = listVendors_();
    if (vendors.some(function (v) { return v.name.toLowerCase() === lower; })) {
      throw new Error('A vendor named "' + name + '" already exists — search for it instead');
    }
    var dept = String(body.department || user.department || '').trim();
    var sh = vendorSheet_();
    var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    var row = [];
    head.forEach(function (h, c) {
      if (h === 'name') row[c] = name;
      else if (h === 'departments') row[c] = dept;
      else if (h === 'addedBy') row[c] = user.email;
      else if (h === 'addedAt') row[c] = nowIso_();
      else if (VENDOR_QUICK_FIELDS.indexOf(h) >= 0 && body[h] != null) row[c] = String(body[h]).trim();
      else row[c] = '';
    });
    sh.appendRow(row);
    log_(user, '', 'vendorQuickAdd', name + (dept ? ' (' + dept + ')' : ''));
    var vendor = listVendors_().filter(function (v) { return v.name.toLowerCase() === lower; })[0];
    return { vendor: vendor, vendors: listVendors_() };
  });
});

registerRoute_('vendorRemove', { minRole: 'admin' }, function (user, body) {
  return withLock_(function () {
    var name = String(body.name || '').trim().toLowerCase();
    var vendors = listVendors_();
    for (var i = 0; i < vendors.length; i++) {
      if (vendors[i].name.toLowerCase() === name) {
        vendorSheet_().deleteRow(vendors[i]._row);
        log_(user, '', 'vendorRemove', vendors[i].name);
        return { vendors: listVendors_() };
      }
    }
    throw new Error('Vendor not found: ' + body.name);
  });
});
