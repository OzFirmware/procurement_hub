// Oizom Procurement Hub backend. Bound to the procurement Google Sheet.
// All requests: POST JSON {action, token, ...}. Response: {ok, ...} JSON.

var ROUTES = {}; // filled by registerRoute_ calls in other files

function registerRoute_(action, opts, handler) {
  ROUTES[action] = { minRole: opts.minRole || 'requester', handler: handler };
}

// role ordering for minRole checks. 'finance' is tied with 'approver' rather
// than sitting "above" or "below" it — the two are orthogonal duties, not a
// hierarchy — but no route currently sets minRole:'approver', so today this
// only matters for role validity checks (userSet).
var ROLE_RANK = { requester: 0, approver: 1, finance: 1, admin: 2 };

function doGet(e) {
  return json_({ ok: true, service: 'oizom-purchase-tool', time: new Date().toISOString() });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'Invalid JSON body' });
  }
  try {
    var route = Object.prototype.hasOwnProperty.call(ROUTES, body.action) ? ROUTES[body.action] : null;
    if (!route) throw new Error('Unknown action: ' + body.action);
    var user = requireUser_(body);
    if (ROLE_RANK[user.role] == null) {
      throw new Error('Role "' + user.role + '" is no longer supported — ask an admin to update your role');
    }
    if (ROLE_RANK[user.role] < ROLE_RANK[route.minRole]) {
      throw new Error('Your role (' + user.role + ') cannot perform ' + body.action);
    }
    var result = route.handler(user, body) || {};
    result.ok = true;
    return json_(result);
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function ss_() { return SpreadsheetApp.getActive(); }

function sheet_(name, headers) {
  var sh = ss_().getSheetByName(name);
  if (!sh) {
    sh = ss_().insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
  }
  return sh;
}

function nowIso_() { return new Date().toISOString(); }

// Convert a sheet cell to a plain string (dates → ISO date part)
function cellStr_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'");
  return v == null ? '' : String(v);
}
