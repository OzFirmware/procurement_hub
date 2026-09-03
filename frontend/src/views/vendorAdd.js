import { api } from '../api.js';
import { store } from '../state.js';
import { toast, esc } from '../ui.js';
import { saveDraft, peekDraft } from '../lib/prDraft.js';

// Reached only via "Vendor not listed? Add new vendor" on the PR form — open
// to every role (unlike the admin-only Vendors section) but deliberately
// narrow: it can only register a brand-new vendor (see vendorQuickAdd in
// apps-script/vendors.gs), never edit an existing one. Bank/tax/Zoho fields
// live on the admin Vendors page, not here.
export function vendorAddView(el, s) {
  const ctx = peekDraft(); // left in place — the PR form clears it on its own remount
  const returnHash = (ctx && ctx.returnHash) || '#/new';
  const department = (ctx && ctx.department) || (s.me && s.me.department) || '';
  const prefillName = (ctx && ctx.prefillVendorName) || '';

  el.innerHTML = `
    <div class="dash">
      <div class="crumbs"><a href="${esc(returnHash)}">Purchase request</a> / add vendor</div>
      <div class="adm-head">
        <h1 style="margin:0">Add a new vendor</h1>
      </div>
      <div class="card">
        <h2>Vendor details</h2>
        <div class="pd-body pd-form">
          <div class="pd-grid">
            <label>Vendor name* <input name="name" value="${esc(prefillName)}" required></label>
            <label>Category <input name="category" placeholder="e.g. Electronics"></label>
            <label>Contact person <input name="contactPerson"></label>
            <label>Phone <input name="phone"></label>
            <label>Email <input name="email" type="email"></label>
            <label>Website <input name="website" placeholder="https://…"></label>
            <label class="full">Address <input name="address"></label>
            <label class="full">Notes <textarea name="notes" rows="3" placeholder="Anything the admin should know before onboarding this vendor fully — GST/tax ID, bank details, etc."></textarea></label>
          </div>
          <p class="pd-sub" style="margin-top:12px">${department
            ? `Registered for the <b>${esc(department)}</b> department.`
            : 'Ask an admin to assign your department first, so this vendor can be scoped correctly.'}
            ${ctx ? ' You’ll return to your purchase request after saving.' : ''}</p>
          <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn primary" id="vaSave">Save vendor</button>
            <a class="btn" href="${esc(returnHash)}">Cancel</a>
          </div>
        </div>
      </div>
    </div>`;

  el.querySelector('#vaSave').onclick = async () => {
    const get = n => el.querySelector(`[name="${n}"]`).value.trim();
    const name = get('name');
    if (!name) { toast('Vendor name required', true); return; }
    const btn = el.querySelector('#vaSave');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const d = await api('vendorQuickAdd', {
        name, department,
        category: get('category'), contactPerson: get('contactPerson'), phone: get('phone'),
        email: get('email'), website: get('website'), address: get('address'), notes: get('notes')
      });
      (s.vendors || (s.vendors = [])).push(d.vendor); // seen immediately, before the background refresh lands
      if (ctx) saveDraft({ ...ctx, fields: { ...(ctx.fields || {}), vendor: d.vendor.name } });
      toast('Vendor "' + d.vendor.name + '" added');
      location.hash = returnHash;
      store.refresh(); // syncs the real vendor record; safe now that we've navigated away from the PR form
    } catch (e) {
      toast(e.message, true);
      btn.disabled = false; btn.textContent = 'Save vendor';
    }
  };
}
