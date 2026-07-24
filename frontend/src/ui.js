export const esc = s => s == null ? '' : String(s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function chip(status) {
  return `<span class="chip ${esc(status)}" data-s="${esc(status)}">${esc(status)}</span>`;
}

export function toast(msg, isErr = false) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const el = document.createElement('div');
  el.className = 'toast' + (isErr ? ' err' : '');
  el.innerHTML = `
    <span class="t-ico material-symbols-outlined">${isErr ? 'error' : 'check_circle'}</span>
    <div class="t-body">
      <div class="t-title">${isErr ? 'Error' : 'Success'}</div>
      <div class="t-msg"></div>
    </div>
    <button class="t-close" aria-label="Dismiss">&times;</button>`;
  el.querySelector('.t-msg').textContent = msg;
  el.querySelector('.t-close').onclick = () => el.remove();
  document.body.appendChild(el);
  setTimeout(() => el.remove(), isErr ? 6000 : 4000);
}

export const fmtDate = s => s ? esc(String(s).slice(0, 10)) : '—';

// "priya.v@oizom.com" → "Priya V"
export function displayName(email) {
  const parts = String(email || '').split('@')[0].split(/[._-]+/).filter(Boolean);
  return parts.map(p => p[0].toUpperCase() + p.slice(1)).join(' ') || email;
}

// "priya.v@oizom.com" → "PV"
export function initials(email) {
  const parts = String(email || '').split('@')[0].split(/[._-]+/).filter(Boolean);
  return ((parts[0] || 'u')[0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}
