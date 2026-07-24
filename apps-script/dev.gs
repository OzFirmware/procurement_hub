// Admin-only maintenance routes — dashboard replaces the Apps Script
// editor for routine operations.

registerRoute_('health', { minRole: 'admin' }, function () {
  var tabs = ss_().getSheets().map(function (sh) {
    return { name: sh.getName(), rows: Math.max(sh.getLastRow() - 1, 0) };
  });
  return { tabs: tabs, time: nowIso_(), tz: Session.getScriptTimeZone() };
});

registerRoute_('logTail', { minRole: 'admin' }, function (user, body) {
  var sh = sheet_('Log', LOG_HEADERS);
  var last = sh.getLastRow();
  if (last < 2) return { rows: [] };
  var n = Math.max(1, Math.min(Number(body.n) || 50, 200));
  var start = Math.max(2, last - n + 1);
  var data = sh.getRange(start, 1, last - start + 1, LOG_HEADERS.length).getValues();
  return { rows: data.reverse().map(function (r) { return r.map(cellStr_); }) };
});

registerRoute_('dumpLegacyHeaders', { minRole: 'admin' }, function () {
  return { headers: dumpLegacyHeaders() };
});

registerRoute_('runMigration', { minRole: 'admin' }, function (user) {
  var migrated = migrateLegacy();
  log_(user, '', 'runMigration', 'migrated ' + migrated + ' PRs');
  return { migrated: migrated };
});
