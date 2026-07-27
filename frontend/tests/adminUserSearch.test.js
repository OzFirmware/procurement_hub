// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/api.js', () => ({
  api: vi.fn(async () => ({ users: USERS }))
}));

const USERS = [
  { email: 'firmware@oizom.com', name: 'Kevin Andani', role: 'admin', department: 'R&D' },
  { email: 'inquiry@oizom.com', name: 'Jaydeep Rathod', role: 'admin', department: 'R&D' },
  { email: 'maintenance@oizom.com', name: '', role: 'requester', department: 'R&D' },
  { email: 'yash.chauhan@oizom.com', name: '', role: 'requester', department: 'R&D' }
];

const STATE = { projects: [], materialTypes: [], lists: { departments: ['R&D'] } };

const { adminView } = await import('../src/views/admin.js');

let el;
const visible = () => [...el.querySelectorAll('.adm-tbl tbody tr[data-search]')].filter(tr => !tr.hidden);
const type = q => {
  const box = el.querySelector('#admSearch');
  box.value = q;
  box.oninput();
  return box;
};

beforeEach(async () => {
  el = document.createElement('div');
  document.body.innerHTML = '';
  document.body.appendChild(el);
  adminView(el, STATE);
  await Promise.resolve();     // let the mocked usersList resolve and re-render
  await Promise.resolve();
  const box = el.querySelector('#admSearch');
  if (box && box.value) { box.value = ''; box.oninput(); }   // clear module-level USER_Q
});

describe('user search', () => {
  it('renders every user with no query', () => {
    expect(visible()).toHaveLength(4);
    expect(el.querySelector('.adm-count').textContent).toBe('Showing 4 of 4 active members');
    expect(el.querySelector('.adm-nomatch').hidden).toBe(true);
  });

  it('matches on name, case-insensitively', () => {
    type('KEVIN');
    expect(visible().map(tr => tr.querySelector('.adm-email').textContent))
      .toEqual(['firmware@oizom.com']);
    expect(el.querySelector('.adm-count').textContent).toBe('Showing 1 of 4 active members');
  });

  it('matches on email', () => {
    type('inquiry@');
    expect(visible().map(tr => tr.querySelector('.adm-name').textContent))
      .toEqual(['Jaydeep Rathod']);
  });

  it('matches the derived display name of users with no name in the sheet', () => {
    type('yash chau');
    expect(visible().map(tr => tr.querySelector('.adm-email').textContent))
      .toEqual(['yash.chauhan@oizom.com']);
  });

  it('shows an empty state when nothing matches', () => {
    type('zzz');
    expect(visible()).toHaveLength(0);
    expect(el.querySelector('.adm-nomatch').hidden).toBe(false);
    expect(el.querySelector('.adm-count').textContent).toBe('Showing 0 of 4 active members');
  });

  it('strips the bottom border from the last visible row only', () => {
    type('a');   // several matches
    const rows = visible();
    expect(rows.at(-1).classList.contains('last-visible')).toBe(true);
    expect(rows.slice(0, -1).some(tr => tr.classList.contains('last-visible'))).toBe(false);
  });

  it('survives the full re-render fired by a role/department change', () => {
    type('jaydeep');
    adminView(el, STATE);                       // what setUser() does after saving
    expect(el.querySelector('#admSearch').value).toBe('jaydeep');
    expect(visible().map(tr => tr.querySelector('.adm-name').textContent))
      .toEqual(['Jaydeep Rathod']);
    expect(el.querySelector('.adm-count').textContent).toBe('Showing 1 of 4 active members');
  });

  it('clears the query from the clear button', () => {
    type('kevin');
    el.querySelector('.admSearchClear').onclick();
    expect(el.querySelector('#admSearch').value).toBe('');
    expect(visible()).toHaveLength(4);
  });
});
