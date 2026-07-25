var PR_HEADERS = ['id', 'createdAt', 'department', 'project', 'purpose', 'requesterEmail',
  'requestedByName', 'vendor', 'totalAmount', 'currency', 'status', 'priority',
  'approverEmail', 'approvedByName', 'approvedAt', 'paymentStatus', 'paymentTerm',
  'poNo', 'poDate', 'invoiceNo', 'invoiceDate', 'quotationDoc', 'courier', 'trackingNo',
  'trackingLink', 'expectedDate', 'receivedAt', 'notes', 'updatedAt'];

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
var STAFF_ = ['approver', 'admin'];
var TRANSITIONS_ = {
  'Submitted':  { 'Approved': STAFF_, 'Rejected': STAFF_, 'Cancelled': STAFF_.concat(['requester:own']), 'On Hold': STAFF_ },
  'Approved':   { 'Ordered': STAFF_, 'Cancelled': STAFF_, 'On Hold': STAFF_, 'Rejected': STAFF_, 'Submitted': STAFF_ },
  'Ordered':    { 'In Transit': STAFF_, 'Received': STAFF_, 'Cancelled': STAFF_, 'On Hold': STAFF_ },
  'In Transit': { 'Received': STAFF_, 'On Hold': STAFF_ },
  'On Hold':    { 'Submitted': STAFF_, 'Approved': STAFF_, 'Ordered': STAFF_, 'Cancelled': STAFF_ },
  'Rejected':   { 'Submitted': STAFF_.concat(['requester:own']), 'Approved': STAFF_ },
  'Received':   {},
  'Cancelled':  {}
};

function canTransition_(from, to, role, isOwn) {
  var allowed = (TRANSITIONS_[from] || {})[to];
  if (!allowed) return false;
  return allowed.some(function (tok) {
    return tok === 'requester:own' ? (role === 'requester' && isOwn) : tok === role;
  });
}

function prSheet_() { return sheet_('PRs', PR_HEADERS); }

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
  if (d.vendor) {
    var okVendors = vendorsFor_(user.department).map(function (v) { return v.toLowerCase(); });
    if (okVendors.indexOf(String(d.vendor).trim().toLowerCase()) < 0) {
      throw new Error('Vendor not registered for ' + user.department + ' — ask an admin to add it in the Vendors tab');
    }
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
    pr.requestedByName = user.name || '';
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
    return { pr: pr };
  });
});

registerRoute_('update', { minRole: 'requester' }, function (user, body) {
  return withLock_(function () {
    var pr = findPr_(body.id);
    var isOwn = pr.requesterEmail.toLowerCase() === user.email;
    var isStaff = user.role === 'approver' || user.role === 'admin';
    if (!isStaff && !(isOwn && pr.status === 'Submitted')) {
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
    if (!canTransition_(pr.status, to, user.role, isOwn)) {
      throw new Error('Cannot move ' + pr.id + ' from ' + pr.status + ' to ' + to + ' as ' + user.role);
    }
    var detail = pr.status + ' → ' + to;
    if (to === 'Approved' || to === 'Rejected') { pr.approverEmail = user.email; pr.approvedAt = nowIso_(); }
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
