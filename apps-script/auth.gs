var ALLOWED_DOMAIN = 'oizom.com';
// Must match frontend/src/config.js CLIENT_ID. Empty string = skip audience
// check (set it before real deployment!).
var OAUTH_CLIENT_ID = ''; // paste your client ID here in the Apps Script editor — never commit it

var USERS_HEADERS = ['email', 'role', 'addedBy', 'addedAt', 'department', 'name', 'picture'];

function requireUser_(body) {
  var v = verifyToken_(body.token);
  var info = getUserInfo_(v.email, v.name, v.picture);
  return { email: v.email, name: v.name, role: info.role, department: info.department };
}

function verifyToken_(idToken) {
  if (!idToken) throw new Error('Not signed in (missing token)');
  var cache = CacheService.getScriptCache();
  var key = 'tok_' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken)).slice(0, 40);
  var cached = cache.get(key);
  if (cached) {
    // old cache entries are a bare email string; new ones are JSON {e, n, p}
    try { var c = JSON.parse(cached); return { email: c.e, name: c.n || '', picture: c.p || '' }; }
    catch (err) { return { email: cached, name: '', picture: '' }; }
  }

  var res = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
    { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('Sign-in token invalid or expired — sign in again');
  var info = JSON.parse(res.getContentText());
  if (OAUTH_CLIENT_ID && info.aud !== OAUTH_CLIENT_ID) throw new Error('Token audience mismatch');
  if (info.email_verified !== 'true') throw new Error('Email not verified');
  var email = String(info.email || '').toLowerCase();
  if (email.split('@')[1] !== ALLOWED_DOMAIN) {
    throw new Error('Only @' + ALLOWED_DOMAIN + ' accounts are allowed');
  }
  var ttl = Math.min(Math.max(Number(info.exp) - Math.floor(Date.now() / 1000), 1), 3600);
  cache.put(key, JSON.stringify({ e: email, n: String(info.name || ''), p: String(info.picture || '') }), ttl);
  return { email: email, name: String(info.name || ''), picture: String(info.picture || '') };
}

// Sheets created before the name/picture columns existed have fewer header cells.
function ensureNameHeader_(sh) {
  if (String(sh.getRange(1, 6).getValue()) !== 'name') {
    sh.getRange(1, 6).setValue('name');
  }
  if (String(sh.getRange(1, 7).getValue()) !== 'picture') {
    sh.getRange(1, 7).setValue('picture');
  }
}

function getUserInfo_(email, name, picture) {
  var sh = sheet_('Users', USERS_HEADERS);
  var data = sh.getDataRange().getValues();
  // Bootstrap: empty Users tab (only header) → first caller becomes admin
  if (data.length < 2) {
    var lock = LockService.getScriptLock();
    lock.waitLock(5000);
    try {
      // Double-checked locking: re-read inside the lock before appending,
      // in case another concurrent first call already bootstrapped admin.
      data = sh.getDataRange().getValues();
      if (data.length < 2) {
        sh.appendRow([email, 'admin', 'bootstrap', nowIso_(), '', name || '', picture || '']);
        SpreadsheetApp.flush(); // commit the write before the lock is released
        return { role: 'admin', department: '' };
      }
    } finally {
      lock.releaseLock();
    }
  }
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === email) {
      // keep the Google profile name + photo synced so admin views show real identities
      if (name && String(data[i][5] || '') !== name) {
        ensureNameHeader_(sh);
        sh.getRange(i + 1, 6).setValue(name);
      }
      if (picture && String(data[i][6] || '') !== picture) {
        ensureNameHeader_(sh);
        sh.getRange(i + 1, 7).setValue(picture);
      }
      var role = String(data[i][1]).toLowerCase();
      if (!role) throw new Error('Access pending — ask an admin to assign your role and department');
      return { role: role, department: String(data[i][4] || '') };
    }
  }
  // Self-registration: record the sign-in attempt so the admin only assigns
  // role + department instead of re-typing the email. Access stays denied
  // until an admin approves (empty role = pending).
  var regLock = LockService.getScriptLock();
  regLock.waitLock(5000);
  try {
    data = sh.getDataRange().getValues();
    var exists = false;
    for (var k = 1; k < data.length; k++) {
      if (String(data[k][0]).toLowerCase() === email) { exists = true; break; }
    }
    if (!exists) {
      ensureNameHeader_(sh);
      sh.appendRow([email, '', 'self-signup', nowIso_(), '', name || '', picture || '']);
      SpreadsheetApp.flush();
      notify_('user-pending', admins_(), '',
        (name ? name + ' (' + email + ')' : email) + ' signed in and is awaiting approval — assign a role and department in the Admin tab.',
        'Procurement Hub: new user pending approval');
    }
  } finally {
    regLock.releaseLock();
  }
  throw new Error('No access yet — you are on the pending list, ask an admin to approve ' + email);
}
