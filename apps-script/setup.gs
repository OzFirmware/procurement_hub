// ===== One-time v3 spreadsheet bootstrap =====
// Run setupV3() from the Apps Script editor of the NEW spreadsheet.
// Idempotent: sheet_() only creates missing tabs; Lists is only seeded when empty;
// re-applying validations is harmless.

function setupV3() {
  sheet_('PRs', PR_HEADERS);
  sheet_('Items', ITEM_HEADERS);
  sheet_('Users', USERS_HEADERS);
  sheet_('Projects', PROJECTS_HEADERS);
  sheet_('MaterialTypes', MATERIALTYPE_HEADERS);
  sheet_('Log', LOG_HEADERS);
  var lists = sheet_('Lists', LISTS_HEADERS);
  sheet_('Vendors', VENDOR_HEADERS);

  if (lists.getLastRow() < 2) {
    var maxLen = 0;
    LISTS_HEADERS.forEach(function (h) { maxLen = Math.max(maxLen, LISTS_SEED[h].length); });
    var rows = [];
    for (var r = 0; r < maxLen; r++) {
      rows.push(LISTS_HEADERS.map(function (h) { return LISTS_SEED[h][r] || ''; }));
    }
    lists.getRange(2, 1, rows.length, LISTS_HEADERS.length).setValues(rows);
  }
  applyValidations_();
  Logger.log('v3 tabs ready.');
}

function applyValidations_() {
  var lists = ss_().getSheetByName('Lists');
  var prs = ss_().getSheetByName('PRs');
  var items = ss_().getSheetByName('Items');
  var N = 1000; // validated data rows

  function fromLists(listName) {
    var col = LISTS_HEADERS.indexOf(listName) + 1;
    return SpreadsheetApp.newDataValidation()
      .requireValueInRange(lists.getRange(2, col, 500, 1), true)
      .setAllowInvalid(true).build();
  }
  function fromValues(values) {
    return SpreadsheetApp.newDataValidation()
      .requireValueInList(values, true).setAllowInvalid(true).build();
  }
  function apply(sh, headers, field, rule) {
    sh.getRange(2, headers.indexOf(field) + 1, N, 1).setDataValidation(rule);
  }

  apply(prs, PR_HEADERS, 'department', fromLists('departments'));
  apply(prs, PR_HEADERS, 'currency', fromLists('currencies'));
  apply(prs, PR_HEADERS, 'priority', fromLists('priorities'));
  apply(prs, PR_HEADERS, 'paymentTerm', fromLists('paymentTerms'));
  apply(prs, PR_HEADERS, 'courier', fromLists('couriers'));
  apply(prs, PR_HEADERS, 'status', fromValues(Object.keys(TRANSITIONS_)));
  apply(prs, PR_HEADERS, 'paymentStatus', fromValues(['Unpaid', 'Paid', 'Partially Paid', 'FOC / Free']));
  apply(items, ITEM_HEADERS, 'materialType', fromLists('materialTypes'));
  apply(items, ITEM_HEADERS, 'unit', fromLists('units'));
}
