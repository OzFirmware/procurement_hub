// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { prFormView } from '../src/views/prForm.js';

const STATE = {
  me: { role: 'requester', email: 'k@oizom.com', department: 'R&D' },
  prs: [],
  lists: {},
  projects: [{ department: 'R&D', project: 'Alpha' }],
  materialTypes: [{ department: 'R&D', materialType: 'Asset' }],
  vendors: [
    { name: 'amazon.in', displayName: 'Amazon India', category: 'Marketplace', departments: ['R&D'] },
    { name: 'digikey', displayName: '', category: 'Electronics', departments: ['R&D'] },
    { name: 'other-dept-vendor', displayName: '', category: '', departments: ['QC'] }
  ]
};

let el;
beforeEach(() => {
  el = document.createElement('div');
  document.body.innerHTML = '';
  document.body.appendChild(el);
  prFormView(el, STATE, null);
});

const focusOpen = (inputId) => {
  const input = el.querySelector('#' + inputId);
  input.onfocus();
  return input;
};

describe('currency combobox', () => {
  it('opens the option list on focus with full currency list', () => {
    focusOpen('curSearch');
    const listBox = el.querySelector('#curList');
    expect(listBox.hidden).toBe(false);
    expect(listBox.querySelectorAll('.curOpt').length).toBeGreaterThan(10);
  });
  it('filters as you type', () => {
    const input = focusOpen('curSearch');
    input.value = 'rupee';
    input.oninput();
    const codes = [...el.querySelectorAll('#curList .curOpt')].map(o => o.dataset.v);
    expect(codes).toContain('INR');
    expect(codes).not.toContain('USD');
  });
  it('click on an option commits code, shows label, closes list', () => {
    const input = focusOpen('curSearch');
    input.value = 'usd';
    input.oninput();
    const listBox = el.querySelector('#curList');
    const usd = [...listBox.querySelectorAll('.curOpt')].find(o => o.dataset.v === 'USD');
    listBox.onmousedown({ preventDefault() {}, target: usd });
    expect(el.querySelector('[name="currency"]').value).toBe('USD');
    expect(el.querySelector('#curSearch').value).toBe('USD — US Dollar $');
    expect(listBox.hidden).toBe(true);
  });
  it('typed bare code commits on blur; junk snaps back', async () => {
    const input = focusOpen('curSearch');
    input.value = 'aed';
    input.onblur();
    await new Promise(r => setTimeout(r, 150));
    expect(el.querySelector('[name="currency"]').value).toBe('AED');
    input.value = 'nonsense';
    input.onblur();
    await new Promise(r => setTimeout(r, 150));
    expect(el.querySelector('[name="currency"]').value).toBe('AED');
  });
});

describe('vendor combobox', () => {
  it('lists only the department vendors with display names', () => {
    focusOpen('venSearch');
    const rows = [...el.querySelectorAll('#venList .curOpt')];
    expect(rows.map(o => o.dataset.v).sort()).toEqual(['amazon.in', 'digikey']);
    expect(rows.find(o => o.dataset.v === 'amazon.in').textContent).toContain('Amazon India');
  });
  it('search matches display name and category', () => {
    const input = focusOpen('venSearch');
    input.value = 'electronics';
    input.oninput();
    expect([...el.querySelectorAll('#venList .curOpt')].map(o => o.dataset.v)).toEqual(['digikey']);
  });
  it('selecting commits the raw registry name, displays pretty name', () => {
    focusOpen('venSearch');
    const listBox = el.querySelector('#venList');
    const amz = [...listBox.querySelectorAll('.curOpt')].find(o => o.dataset.v === 'amazon.in');
    listBox.onmousedown({ preventDefault() {}, target: amz });
    expect(el.querySelector('[name="vendor"]').value).toBe('amazon.in');
    expect(el.querySelector('#venSearch').value).toBe('Amazon India');
  });
  it('clearing the field commits empty (vendor optional)', async () => {
    const input = focusOpen('venSearch');
    input.value = '';
    input.onblur();
    await new Promise(r => setTimeout(r, 150));
    expect(el.querySelector('[name="vendor"]').value).toBe('');
  });
});
