import { esc } from '../ui.js';

// Shared table search for the admin tabs.
//
// Filtering happens in the DOM (toggling `tr.hidden`) rather than by
// re-rendering: adminView() rebuilds the whole tab on every save, so a
// re-render per keystroke would drop focus out of the box and force every
// row handler to be rewired. Each table renders rows carrying a
// `data-search` haystack plus a `.adm-count` footer span and a
// `.adm-nomatch` empty-state row; wireSearch() finds them from the input.

export function searchBar(q, placeholder, id = 'admSearch') {
  return `
    <div class="adm-toolbar">
      <div class="adm-search">
        <span class="material-symbols-outlined">search</span>
        <input id="${id}" type="search" autocomplete="off" spellcheck="false"
               placeholder="${esc(placeholder)}" value="${esc(q)}">
        <button type="button" class="admSearchClear" title="Clear search" ${q ? '' : 'hidden'}>
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
    </div>`;
}

// haystack for a row — everything the row shows, lowercased
export const hay = (...parts) => esc(parts.filter(Boolean).join(' ').toLowerCase());

export function noMatchRow(cols, msg) {
  return `<tr class="adm-nomatch" hidden><td colspan="${cols}" style="color:var(--adm-on-var)">${esc(msg)}</td></tr>`;
}

export function wireSearch(el, { get, set, count, id = 'admSearch' }) {
  const box = el.querySelector('#' + id);
  if (!box) return;                       // tab has no search (e.g. vendor detail view)
  const card = box.closest('.adm-card');
  const clear = card.querySelector('.admSearchClear');
  const run = () => applyFilter(card, get(), count);
  box.oninput = () => {
    set(box.value);
    clear.hidden = !box.value;
    run();
  };
  box.onkeydown = e => { if (e.key === 'Escape' && box.value) { box.value = ''; box.oninput(); } };
  clear.onclick = () => { box.value = ''; box.oninput(); box.focus(); };
  run();                                  // re-apply a query that survived a re-render
}

function applyFilter(card, query, count) {
  const q = query.trim().toLowerCase();
  const rows = [...card.querySelectorAll('tbody tr[data-search]')];
  let last = null;
  rows.forEach(tr => {
    tr.hidden = q ? !tr.dataset.search.includes(q) : false;
    tr.classList.remove('last-visible');
    if (!tr.hidden) last = tr;
  });
  // :last-child would land on a hidden row, leaving a stray border mid-table
  if (last) last.classList.add('last-visible');
  const noMatch = card.querySelector('.adm-nomatch');
  if (noMatch) noMatch.hidden = !!last || !rows.length;
  const countEl = card.querySelector('.adm-count');
  if (countEl) countEl.textContent = count(rows.filter(tr => !tr.hidden).length, rows.length);
}
