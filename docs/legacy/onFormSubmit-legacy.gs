// LEGACY — replaced by apps-script/formSubmit.gs (form → master PRs tab).
// This was the pre-v2 handler: it routed each Google Form submission into a
// per-department tab (creating the tab on first use). Kept for reference only;
// do NOT install alongside the new handler (same function name).

function onFormSubmit(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet();
  const responseSheet = sheet.getSheetByName("Form Responses 1");
  const headers = responseSheet.getRange(1, 1, 1, responseSheet.getLastColumn()).getValues()[0];
  const values = e.values;

  const deptColumnIndex = headers.indexOf("Department Name");
  const department = values[deptColumnIndex];

  if (!department) return;

  const mergedResponse = {};
  headers.forEach((header, i) => {
    if (!mergedResponse[header]) {
      mergedResponse[header] = values[i] || "";
    } else if (!mergedResponse[header] && values[i]) {
      mergedResponse[header] = values[i];
    }
  });

  let targetSheet = sheet.getSheetByName(department);
  if (!targetSheet) {
    targetSheet = sheet.insertSheet(department);
    targetSheet.appendRow(Object.keys(mergedResponse));
  }

  const targetHeaders = targetSheet.getRange(1, 1, 1, targetSheet.getLastColumn()).getValues()[0];

  const orderedData = targetHeaders.map(header => mergedResponse[header] || "");

  targetSheet.appendRow(orderedData);
}
