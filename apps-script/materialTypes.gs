// MaterialTypes sheet: one row per item type, per department — mirrors Projects.
var MATERIALTYPE_HEADERS = ['department', 'materialType'];

function listMaterialTypes_() {
  var data = sheet_('MaterialTypes', MATERIALTYPE_HEADERS).getDataRange().getValues();
  var out = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] && data[i][1]) {
      out.push({ department: String(data[i][0]), materialType: String(data[i][1]) });
    }
  }
  return out;
}

function materialTypesFor_(dept) {
  var d = String(dept || '').toLowerCase();
  return listMaterialTypes_()
    .filter(function (m) { return m.department.toLowerCase() === d; })
    .map(function (m) { return m.materialType; });
}

registerRoute_('materialTypeAdd', { minRole: 'admin' }, function (user, body) {
  return withLock_(function () {
    var dept = String(body.department || '').trim();
    var name = String(body.materialType || '').trim();
    if (!dept || !name) throw new Error('Department and item type are required');
    var dup = listMaterialTypes_().some(function (m) {
      return m.department.toLowerCase() === dept.toLowerCase() && m.materialType.toLowerCase() === name.toLowerCase();
    });
    if (dup) throw new Error('Item type already listed for ' + dept);
    sheet_('MaterialTypes', MATERIALTYPE_HEADERS).appendRow([dept, name]);
    log_(user, '', 'materialTypeAdd', dept + ' / ' + name);
    return { materialTypes: listMaterialTypes_() };
  });
});

registerRoute_('materialTypeRemove', { minRole: 'admin' }, function (user, body) {
  return withLock_(function () {
    var dept = String(body.department || '').trim().toLowerCase();
    var name = String(body.materialType || '').trim().toLowerCase();
    var sh = sheet_('MaterialTypes', MATERIALTYPE_HEADERS);
    var data = sh.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase() === dept && String(data[i][1]).toLowerCase() === name) {
        sh.deleteRow(i + 1);
        log_(user, '', 'materialTypeRemove', dept + ' / ' + name);
        return { materialTypes: listMaterialTypes_() };
      }
    }
    throw new Error('Item type not found: ' + body.department + ' / ' + body.materialType);
  });
});
