// ===== Notifications: in-app rows + email, one dispatcher for all events =====
// Every business route calls notify_() — the sheet feeds the topbar bell,
// the email makes sure people see it without opening the tool.

var NOTIF_HEADERS = ['id', 'ts', 'toEmail', 'event', 'prId', 'message', 'readAt'];
var APP_LINK = 'https://ozfirmware.github.io/procurement_hub/';

function notifSheet_() { return sheet_('Notifications', NOTIF_HEADERS); }

// Append one in-app row + send one email per recipient. Never throws —
// a notification failure must not fail the business action that caused it.
function notify_(event, recipients, prId, message, subject) {
  try {
    var to = [];
    (recipients || []).forEach(function (r) {
      r = String(r || '').toLowerCase();
      if (r && to.indexOf(r) < 0) to.push(r);
    });
    if (!to.length) return;
    var sh = notifSheet_();
    var rows = to.map(function (t) {
      return [Utilities.getUuid(), nowIso_(), t, event, prId || '', message, ''];
    });
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, NOTIF_HEADERS.length).setValues(rows);
    var link = prId ? APP_LINK + '#/pr/' + encodeURIComponent(prId) : APP_LINK;
    to.forEach(function (t) {
      try {
        MailApp.sendEmail(t, subject || ('Procurement Hub: ' + event), message + '\n\n' + link);
      } catch (e) { /* per-recipient mail failure is non-fatal */ }
    });
  } catch (e) { /* never break the calling route */ }
}

function admins_() {
  return listUsers_().filter(function (u) { return u.role === 'admin'; })
    .map(function (u) { return u.email; });
}

// The Finance team, centrally — payment processing isn't department-scoped
// like approval is. Falls back to admins when no one holds the finance role
// yet, so a PO never goes unannounced.
function financeUsers_() {
  var fin = listUsers_().filter(function (u) { return u.role === 'finance'; }).map(function (u) { return u.email; });
  return fin.length ? fin : admins_();
}

// Approvers of the department; falls back to ALL approvers when the
// department has none mapped, so a PR never goes unannounced.
function approversFor_(dept) {
  var d = String(dept || '').toLowerCase();
  var all = listUsers_().filter(function (u) { return u.role === 'approver'; });
  var match = all.filter(function (u) { return String(u.department || '').toLowerCase() === d; });
  return (match.length ? match : all).map(function (u) { return u.email; });
}

// Latest 30 notifications for the signed-in user (newest first).
function notificationsFor_(email) {
  var data = notifSheet_().getDataRange().getValues();
  var out = [];
  for (var i = data.length - 1; i >= 1 && out.length < 30; i--) {
    if (String(data[i][2]).toLowerCase() === email) {
      out.push({
        id: String(data[i][0]), ts: cellStr_(data[i][1]), event: String(data[i][3]),
        prId: cellStr_(data[i][4]), message: String(data[i][5]), readAt: cellStr_(data[i][6])
      });
    }
  }
  return out;
}

// Mark all of the caller's notifications read (fired when the bell opens).
registerRoute_('notifRead', { minRole: 'requester' }, function (user) {
  var sh = notifSheet_();
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][2]).toLowerCase() === user.email && !cellStr_(data[i][6])) {
      sh.getRange(i + 1, 7).setValue(nowIso_());
    }
  }
  return { ok: true };
});
