function listUsers_() {
  var data = sheet_('Users', USERS_HEADERS).getDataRange().getValues();
  var out = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) {
      out.push({
        email: String(data[i][0]).toLowerCase(),
        role: String(data[i][1]).toLowerCase(),
        department: String(data[i][4] || ''),
        addedBy: String(data[i][2] || '')
      });
    }
  }
  return out;
}

// Sheets created before the department column existed have 4 header cells.
function ensureDeptHeader_(sh) {
  if (String(sh.getRange(1, 5).getValue()) !== 'department') {
    sh.getRange(1, 5).setValue('department');
  }
}

registerRoute_('usersList', { minRole: 'admin' }, function (user) {
  return { users: listUsers_() };
});

registerRoute_('userSet', { minRole: 'admin' }, function (user, body) {
  // Update role and/or department; role '' with no department removes the user.
  return withLock_(function () {
    var email = String(body.email || '').toLowerCase().trim();
    var role = String(body.role || '').toLowerCase().trim();
    var dept = body.department != null ? String(body.department).trim() : null;
    if (!email) throw new Error('Email required');
    if (role && ROLE_RANK[role] == null) throw new Error('Invalid role: ' + role);
    var sh = sheet_('Users', USERS_HEADERS);
    var data = sh.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase() === email) {
        if (role) {
          var wasAdmin = String(data[i][1]).toLowerCase() === 'admin';
          var staysAdmin = role === 'admin';
          if (wasAdmin && !staysAdmin) {
            var adminCount = 0;
            for (var j = 1; j < data.length; j++) {
              if (String(data[j][1]).toLowerCase() === 'admin') adminCount++;
            }
            if (adminCount <= 1) throw new Error('Cannot remove the last admin');
          }
          sh.getRange(i + 1, 2).setValue(role);
        }
        if (dept != null) {
          ensureDeptHeader_(sh);
          sh.getRange(i + 1, 5).setValue(dept);
        }
        // Approving a self-signup: the acting admin takes over as addedBy
        if ((role || dept != null) && String(data[i][2]) === 'self-signup') {
          sh.getRange(i + 1, 3).setValue(user.email);
          sh.getRange(i + 1, 4).setValue(nowIso_());
        }
        if (!role && dept == null) sh.deleteRow(i + 1);
        var detail = !role && dept == null ? 'removed'
          : (role || 'role unchanged') + (dept != null ? ' / dept: ' + (dept || 'cleared') : '');
        log_(user, '', 'userSet', email + ' → ' + detail);
        return { users: listUsers_() };
      }
    }
    if (!role) throw new Error('User not found: ' + email);
    ensureDeptHeader_(sh);
    sh.appendRow([email, role, user.email, nowIso_(), dept || '']);
    log_(user, '', 'userSet', email + ' → ' + role + (dept ? ' / dept: ' + dept : ''));
    return { users: listUsers_() };
  });
});
