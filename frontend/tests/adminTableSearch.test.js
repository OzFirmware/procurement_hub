// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/api.js', () => ({
  api: vi.fn(async () => ({ users: [] }))
}));

const STATE = {
  prs: [],
  lists: { departments: ['R&D', 'QC'], paymentTerms: [] },
  projects: [
    { department: 'R&D', project: 'Polludrone' },
    { department: 'R&D', project: 'Aeroqual Bench' },
    { department: 'QC', project: 'Calibration Rig' }
  ],
  materialTypes: [
    { department: 'R&D', materialType: 'Sensor' },
    { department: 'QC', materialType: 'Consumable' }
  ],
  vendors: [
    { name: 'digikey', displayName: 'DigiKey', category: 'Electronics', type: 'International', departments: ['R&D'] },
    { name: 'amazon.in', displayName: 'Amazon India', category: 'Marketplace', type: 'Domestic', departments: ['R&D', 'QC'] },
    { name: 'shah-packaging', displayName: '', category: 'Packaging', type: 'Domestic', departments: ['QC'] },
    { name: "O'Brien & Sons", displayName: '', category: 'Tooling', type: 'International', departments: ['QC'] }
  ]
};

const { adminView } = await import('../src/views/admin.js');

let el;
const tab = name => el.querySelector(`.adm-tab[data-tab="${name}"]`).onclick();
const box = () => el.querySelector('#admSearch');
const visible = () => [...el.querySelectorAll('.adm-tbl tbody tr[data-search]')].filter(tr => !tr.hidden);
const cell = tr => [...tr.querySelectorAll('td')].map(td => td.textContent.trim());
const type = q => { const b = box(); b.value = q; b.oninput(); return b; };
const count = () => el.querySelector('.adm-count').textContent;

beforeEach(async () => {
  el = document.createElement('div');
  document.body.innerHTML = '';
  document.body.appendChild(el);
  adminView(el, STATE);
  await Promise.resolve();
  await Promise.resolve();
  // clear any query left on module state by a previous test
  for (const t of ['projects', 'types', 'vendors']) {
    tab(t);
    if (box().value) type('');
  }
  tab('projects');
});

describe('project search', () => {
  it('lists everything with no query', () => {
    expect(visible()).toHaveLength(3);
    expect(count()).toBe('Showing 3 projects');
    expect(el.querySelector('.adm-nomatch').hidden).toBe(true);
  });

  it('matches on project name', () => {
    type('pollu');
    expect(visible().map(tr => cell(tr)[1])).toEqual(['Polludrone']);
    expect(count()).toBe('Showing 1 of 3 projects');
  });

  it('matches on department', () => {
    type('r&d');
    expect(visible().map(tr => cell(tr)[1]).sort()).toEqual(['Aeroqual Bench', 'Polludrone']);
    expect(count()).toBe('Showing 2 of 3 projects');
  });

  it('shows the empty state when nothing matches', () => {
    type('zzz');
    expect(visible()).toHaveLength(0);
    expect(el.querySelector('.adm-nomatch').hidden).toBe(false);
    expect(count()).toBe('Showing 0 of 3 projects');
  });
});

describe('item type search', () => {
  it('filters independently of the projects query', () => {
    type('pollu');                       // projects tab
    tab('types');
    expect(box().value).toBe('');        // item types keeps its own query
    expect(visible()).toHaveLength(2);

    type('consum');
    expect(visible().map(tr => cell(tr)[1])).toEqual(['Consumable']);
    expect(count()).toBe('Showing 1 of 2 item types');

    tab('projects');
    expect(box().value).toBe('pollu');   // projects query survived the tab round-trip
    expect(visible()).toHaveLength(1);
  });
});

describe('vendor search', () => {
  beforeEach(() => tab('vendors'));

  it('lists everything with no query', () => {
    expect(visible()).toHaveLength(4);
    expect(count()).toBe('Showing 4 vendors');
  });

  it('matches on vendor name', () => {
    type('digi');
    expect(visible().map(tr => cell(tr)[0])).toEqual(['digikey']);
    expect(count()).toBe('Showing 1 of 4 vendors');
  });

  it('matches on category and on department', () => {
    type('packaging');
    expect(visible().map(tr => cell(tr)[0])).toEqual(['shah-packaging']);
    type('qc');
    expect(visible().map(tr => cell(tr)[0]).sort())
      .toEqual(["O'Brien & Sons", 'amazon.in', 'shah-packaging']);
  });

  // the haystack round-trips through an HTML attribute, so escaped characters
  // must decode back to the raw text the user types
  it('matches names holding characters that HTML-escape', () => {
    type("o'brien &");
    expect(visible().map(tr => cell(tr)[0])).toEqual(["O'Brien & Sons"]);
    type('& sons');
    expect(visible().map(tr => cell(tr)[0])).toEqual(["O'Brien & Sons"]);
  });

  it('matches on the display name shown nowhere in the row cells', () => {
    type('amazon india');
    expect(visible().map(tr => cell(tr)[0])).toEqual(['amazon.in']);
  });

  it('still opens the detail editor from a filtered row', () => {
    type('digi');
    const row = visible()[0];
    row.onclick({ target: row });
    expect(el.querySelector('h2').textContent).toBe('digikey');
    expect(box()).toBe(null);            // detail view renders no search box
  });

  it('shows the empty state when nothing matches', () => {
    type('zzz');
    expect(visible()).toHaveLength(0);
    expect(el.querySelector('.adm-nomatch').hidden).toBe(false);
    expect(count()).toBe('Showing 0 of 4 vendors');
  });
});
