// Projects sheet: one row per running project, per department.
// Managed directly in Google Sheets — no UI routes write to it.
var PROJECTS_HEADERS = ['department', 'project'];

function listProjects_() {
  var data = sheet_('Projects', PROJECTS_HEADERS).getDataRange().getValues();
  var out = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] && data[i][1]) {
      out.push({ department: String(data[i][0]), project: String(data[i][1]) });
    }
  }
  return out;
}

function projectsFor_(dept) {
  var d = String(dept || '').toLowerCase();
  return listProjects_()
    .filter(function (p) { return p.department.toLowerCase() === d; })
    .map(function (p) { return p.project; });
}

registerRoute_('projectAdd', { minRole: 'admin' }, function (user, body) {
  return withLock_(function () {
    var dept = String(body.department || '').trim();
    var proj = String(body.project || '').trim();
    if (!dept || !proj) throw new Error('Department and project name are required');
    var dup = listProjects_().some(function (p) {
      return p.department.toLowerCase() === dept.toLowerCase() && p.project.toLowerCase() === proj.toLowerCase();
    });
    if (dup) throw new Error('Project already listed for ' + dept);
    sheet_('Projects', PROJECTS_HEADERS).appendRow([dept, proj]);
    log_(user, '', 'projectAdd', dept + ' / ' + proj);
    return { projects: listProjects_() };
  });
});

registerRoute_('projectRemove', { minRole: 'admin' }, function (user, body) {
  return withLock_(function () {
    var dept = String(body.department || '').trim().toLowerCase();
    var proj = String(body.project || '').trim().toLowerCase();
    var sh = sheet_('Projects', PROJECTS_HEADERS);
    var data = sh.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase() === dept && String(data[i][1]).toLowerCase() === proj) {
        sh.deleteRow(i + 1);
        log_(user, '', 'projectRemove', dept + ' / ' + proj);
        return { projects: listProjects_() };
      }
    }
    throw new Error('Project not found: ' + body.department + ' / ' + body.project);
  });
});
