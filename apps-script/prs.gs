var PR_HEADERS = ['id', 'createdAt', 'department', 'project', 'purpose', 'requesterEmail',
  'requestedByName', 'vendor', 'totalAmount', 'currency', 'status', 'priority',
  'approverEmail', 'approvedByName', 'approvedAt', 'paymentStatus', 'paymentTerm',
  'poNo', 'poDate', 'invoiceNo', 'invoiceDate', 'quotationDoc', 'courier', 'trackingNo',
  'trackingLink', 'expectedDate', 'receivedAt', 'notes', 'updatedAt',
  'zohoPoId', 'zohoPoNumber']; // set once a PO is pushed to Zoho Books — see zoho.gs

var LOG_HEADERS = ['timestamp', 'user', 'prId', 'action', 'detail'];

// fields a requester/approver may edit directly (status changes go through
// 'transition'; totalAmount is always server-computed from items; PO/invoice/
// quotation/payment-term fields are admin-only via ADMIN_FIELDS)
var EDITABLE_FIELDS = ['department', 'project', 'purpose', 'requestedByName', 'vendor',
  'currency', 'priority', 'approvedByName', 'paymentStatus', 'courier', 'trackingNo',
  'trackingLink', 'expectedDate', 'notes'];

// Admin may correct any column except the identity key (all changes still logged).
var ADMIN_FIELDS = PR_HEADERS.filter(function (h) { return h !== 'id'; });

// ==== status matrix — MUST mirror frontend/src/lib/status.js ====
// 'approver:dept' = role==='approver' AND their department matches the PR's.
// An approver's whole job is that one decision: approve or reject a
// Submitted PR from their own department. Every move after that — ordering,
// shipping, cancelling, putting on hold, reverting — is admin-only; a
// requester keeps just their own two self-service moves (cancel their own
// Submitted PR, resubmit their own Rejected one).
var TRANSITIONS_ = {
  'Submitted':  { 'Approved': ['admin', 'approver:dept'], 'Rejected': ['admin', 'approver:dept'], 'Cancelled': ['admin', 'requester:own'], 'On Hold': ['admin'] },
  'Approved':   { 'Ordered': ['admin'], 'Cancelled': ['admin'], 'On Hold': ['admin'], 'Rejected': ['admin'], 'Submitted': ['admin'] },
  'Ordered':    { 'In Transit': ['admin'], 'Received': ['admin'], 'Cancelled': ['admin'], 'On Hold': ['admin'] },
  'In Transit': { 'Received': ['admin'], 'On Hold': ['admin'] },
  'On Hold':    { 'Submitted': ['admin'], 'Approved': ['admin'], 'Ordered': ['admin'], 'Cancelled': ['admin'] },
  'Rejected':   { 'Submitted': ['admin', 'requester:own'], 'Approved': ['admin'] },
  'Received':   {},
  'Cancelled':  {}
};

function canTransition_(from, to, role, isOwn, sameDept) {
  var allowed = (TRANSITIONS_[from] || {})[to];
  if (!allowed) return false;
  return allowed.some(function (tok) {
    return tok === 'requester:own' ? (role === 'requester' && isOwn)
      : tok === 'approver:dept' ? (role === 'approver' && sameDept)
      : tok === role;
  });
}

// PRs sheets created before a header existed (e.g. the Zoho columns) have
// fewer header cells than PR_HEADERS — same pattern as vendorSheet_() in
// vendors.gs. New fields MUST be appended at the end of PR_HEADERS, never
// inserted in the middle: rowToPr_/writePr_ read and write by position, so
// the sheet's column order has to keep matching PR_HEADERS' order exactly.
function prSheet_() {
  var sh = sheet_('PRs', PR_HEADERS);
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  var missing = PR_HEADERS.filter(function (h) { return head.indexOf(h) < 0; });
  if (missing.length) {
    sh.getRange(1, head.length + 1, 1, missing.length).setValues([missing]);
  }
  return sh;
}

function rowToPr_(row) {
  var pr = {};
  PR_HEADERS.forEach(function (h, i) { pr[h] = cellStr_(row[i]); });
  return pr;
}

function listPrs_() {
  var data = prSheet_().getDataRange().getValues();
  var out = [];
  for (var i = 1; i < data.length; i++) {
    var pr = rowToPr_(data[i]);
    pr._row = i + 1;
    if (pr.id) out.push(pr);
  }
  return out;
}

function findPr_(id) {
  var prs = listPrs_();
  for (var i = 0; i < prs.length; i++) if (prs[i].id === id) return prs[i];
  throw new Error('PR not found: ' + id);
}

function nextId_() {
  var year = new Date().getFullYear();
  var prefix = 'PR-' + year + '-';
  var max = 0;
  listPrs_().forEach(function (p) {
    if (p.id.indexOf(prefix) === 0) max = Math.max(max, parseInt(p.id.slice(prefix.length), 10) || 0);
  });
  return prefix + ('0000' + (max + 1)).slice(-4);
}

function log_(user, prId, action, detail) {
  sheet_('Log', LOG_HEADERS).appendRow([nowIso_(), user.email, prId, action, detail || '']);
}

function writePr_(pr) {
  var row = PR_HEADERS.map(function (h) { return pr[h] || ''; });
  prSheet_().getRange(pr._row, 1, 1, PR_HEADERS.length).setValues([row]);
}

// Serializes read-modify-write PR operations across concurrent executions.
// The read of PR data must happen inside fn so it sees the latest committed state.
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var result = fn();
    SpreadsheetApp.flush(); // commit writes before the lock is released
    return result;
  } finally {
    lock.releaseLock();
  }
}

registerRoute_('me', { minRole: 'requester' }, function (user) {
  return { email: user.email, role: user.role, department: user.department };
});

registerRoute_('list', { minRole: 'requester' }, function (user) {
  return {
    prs: listPrs_(),
    items: listAllItems_(),
    lists: getLists_(),
    vendors: listVendors_(),
    projects: listProjects_(),
    materialTypes: listMaterialTypes_(),
    notifications: notificationsFor_(user.email),
    me: { email: user.email, role: user.role, department: user.department }
  };
});

registerRoute_('create', { minRole: 'requester' }, function (user, body) {
  var d = body.pr || {};
  var norm = normalizeItems_(body.items);
  if (!norm.items.length) throw new Error('At least one item with a description is required');
  if (!user.department) throw new Error('Your department is not set — ask an admin to assign it in the Admin tab');
  var running = projectsFor_(user.department);
  if (!running.length) {
    throw new Error('No running projects listed for ' + user.department + ' — add one in the Projects sheet');
  }
  if (!d.project || running.indexOf(String(d.project)) < 0) {
    throw new Error('Select a running project for ' + user.department);
  }
  // A vendor not yet in the registry doesn't block the PR — the requester
  // just types the name, and whoever's on the Vendors admin page gets a
  // notification to add it properly (Zoho ID, bank details, etc. come later).
  var vendorText = String(d.vendor || '').trim();
  var newVendorRequested = false;
  if (vendorText) {
    var okVendors = vendorsFor_(user.department).map(function (v) { return v.toLowerCase(); });
    newVendorRequested = okVendors.indexOf(vendorText.toLowerCase()) < 0;
  }
  var okTypes = materialTypesFor_(user.department).map(function (t) { return t.toLowerCase(); });
  if (!okTypes.length) {
    throw new Error('No item types listed for ' + user.department + ' — add one in Admin → Item Types');
  }
  norm.items.forEach(function (it) {
    if (!it.materialType || okTypes.indexOf(it.materialType.toLowerCase()) < 0) {
      throw new Error('Item "' + it.description + '": select an item type for ' + user.department);
    }
    var q = Number(it.qty);
    if (!it.qty || !isFinite(q) || q <= 0) {
      throw new Error('Item "' + it.description + '": quantity is required');
    }
    if (!String(it.unit).trim()) {
      throw new Error('Item "' + it.description + '": unit is required');
    }
  });
  return withLock_(function () {
    var pr = { id: nextId_(), createdAt: nowIso_(), requesterEmail: user.email, status: 'Submitted',
      approverEmail: '', approvedByName: '', approvedAt: '', receivedAt: '', updatedAt: nowIso_() };
    EDITABLE_FIELDS.forEach(function (f) { pr[f] = d[f] != null ? String(d[f]) : ''; });
    // department and requester name come from the account, never the form
    pr.department = user.department;
    pr.requestedByName = user.name || displayNameFromEmail_(user.email);
    pr.vendor = vendorText;
    pr.paymentStatus = d.paymentStatus || 'Unpaid'; // mandatory, defaults Unpaid
    pr.paymentTerm = ''; // lives on the vendor record now
    pr.totalAmount = String(norm.totalAmount);
    prSheet_().appendRow(PR_HEADERS.map(function (h) { return pr[h] || ''; }));
    writeItemsForPr_(pr.id, norm.items);
    log_(user, pr.id, 'create', itemSummary_(norm.items));
    notify_('pr-created', approversFor_(pr.department), pr.id,
      (pr.requestedByName || user.email) + ' raised ' + pr.id + ' (' + pr.department + '): ' + itemSummary_(norm.items) +
      (pr.totalAmount ? ' — total ' + pr.totalAmount + ' ' + (pr.currency || 'INR') : ''),
      'Procurement Hub: new PR ' + pr.id);
    if (newVendorRequested) {
      notify_('vendor-requested', admins_(), pr.id,
        (pr.requestedByName || user.email) + ' raised ' + pr.id + ' (' + pr.department + ') for a vendor that isn\'t registered yet: "' +
        vendorText + '" — add it on the Vendors admin page so future PRs can select it.',
        'Procurement Hub: new vendor requested — ' + vendorText);
    }
    return { pr: pr };
  });
});

registerRoute_('update', { minRole: 'requester' }, function (user, body) {
  return withLock_(function () {
    var pr = findPr_(body.id);
    var isOwn = pr.requesterEmail.toLowerCase() === user.email;
    // An approver's job ends at approve/reject (see TRANSITIONS_ above) — they
    // get no general edit rights either, same as the "Edit" button being
    // hidden from them in the UI. Finance keeps 'update' for paymentStatus,
    // their one field to act on (they never get transition access at all,
    // since 'finance' isn't a token in TRANSITIONS_).
    var canUpdate = user.role === 'admin' || user.role === 'finance' || (isOwn && pr.status === 'Submitted');
    if (!canUpdate) {
      throw new Error('You can only edit your own PRs while they are Submitted');
    }
    var changes = [];
    var fields = user.role === 'admin' ? ADMIN_FIELDS : EDITABLE_FIELDS;
    fields.forEach(function (f) {
      if (body.updates && body.updates[f] != null && String(body.updates[f]) !== pr[f]) {
        changes.push(f + ': "' + pr[f] + '" → "' + body.updates[f] + '"');
        pr[f] = String(body.updates[f]);
      }
    });
    if (body.items != null) {
      var norm = normalizeItems_(body.items);
      if (!norm.items.length) throw new Error('At least one item with a description is required');
      if (String(norm.totalAmount) !== pr.totalAmount) {
        changes.push('totalAmount: "' + pr.totalAmount + '" → "' + norm.totalAmount + '"');
      }
      pr.totalAmount = String(norm.totalAmount);
      writeItemsForPr_(pr.id, norm.items);
      changes.push('items: ' + norm.items.length + ' row(s) rewritten');
    }
    if (changes.length) {
      pr.updatedAt = nowIso_();
      writePr_(pr);
      log_(user, pr.id, 'update', changes.join('; '));
    }
    return { pr: pr };
  });
});

registerRoute_('transition', { minRole: 'requester' }, function (user, body) {
  return withLock_(function () {
    var pr = findPr_(body.id);
    var to = body.to;
    var isOwn = pr.requesterEmail.toLowerCase() === user.email;
    var sameDept = String(pr.department || '').toLowerCase() === String(user.department || '').toLowerCase();
    if (!canTransition_(pr.status, to, user.role, isOwn, sameDept)) {
      var allowed = TRANSITIONS_[pr.status] && TRANSITIONS_[pr.status][to];
      var reason = '';
      if (allowed && allowed.indexOf('approver:dept') >= 0 && user.role === 'approver' && !sameDept) {
        reason = ' — ' + pr.department + ' PRs are approved by ' + pr.department + ' approvers';
      } else if (allowed && user.role === 'approver') {
        reason = ' — only an admin can do that once a decision has been made';
      }
      throw new Error('Cannot move ' + pr.id + ' from ' + pr.status + ' to ' + to + ' as ' + user.role + reason);
    }
    var detail = pr.status + ' → ' + to;
    // record the name alongside the email, the way create does for the
    // requester — without it the row has no name and the UI has to guess one
    // from the address (or, worse, borrow one from an unrelated PR)
    if (to === 'Approved' || to === 'Rejected') {
      pr.approverEmail = user.email;
      pr.approvedByName = user.name || displayNameFromEmail_(user.email);
      pr.approvedAt = nowIso_();
    }
    if (to === 'Received') pr.receivedAt = nowIso_();
    if (to === 'Submitted') { pr.approverEmail = ''; pr.approvedByName = ''; pr.approvedAt = ''; pr.receivedAt = ''; }
    pr.status = to;
    pr.updatedAt = nowIso_();
    writePr_(pr);
    log_(user, pr.id, 'transition', detail);
    if (to === 'Approved' || to === 'Rejected') {
      notify_('pr-' + to.toLowerCase(), [pr.requesterEmail], pr.id,
        'Your PR ' + pr.id + ' was ' + to.toLowerCase() + ' by ' + (user.name || user.email) + '.',
        'Procurement Hub: ' + pr.id + ' ' + to.toLowerCase());
    }
    if (to === 'Ordered') {
      notify_('po-ready', financeUsers_(), pr.id,
        pr.id + ' (' + pr.department + ') has a PO ready for payment' +
        (pr.paymentTerm ? ' — ' + pr.paymentTerm : '') + (pr.poNo ? ', PO ' + pr.poNo : '') + '.',
        'Procurement Hub: PO ready for payment — ' + pr.id);
    }
    return { pr: pr };
  });
});

registerRoute_('delete', { minRole: 'admin' }, function (user, body) {
  return withLock_(function () {
    var pr = findPr_(body.id);
    writeItemsForPr_(pr.id, []); // remove item rows first
    prSheet_().deleteRow(pr._row);
    log_(user, pr.id, 'delete', JSON.stringify(pr).slice(0, 500));
    return { deleted: pr.id };
  });
});
