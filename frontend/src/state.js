import { api } from './api.js';
import { decoratePrs } from './lib/items.js';

let state = { prs: [], lists: {}, vendors: [], projects: [], materialTypes: [], me: null, lastSync: null, err: '', loading: false };
const listeners = new Set();
// Set once a refresh has actually succeeded this session, so a SIGNED_OUT
// error (expired GIS token) reloads to the auth gate instead of looping
// on the very first load when there was never a session to lose.
let hadSession = false;

function emit() { listeners.forEach(fn => fn(state)); }

export const store = {
  get: () => state,
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  async refresh() {
    state = { ...state, loading: true };
    emit();
    try {
      const d = await api('list');
      hadSession = true;
      state = {
        prs: decoratePrs(d.prs, d.items || []),
        lists: d.lists || {},
        vendors: d.vendors || [],
        projects: d.projects || [],
        materialTypes: d.materialTypes || [],
        me: d.me, lastSync: new Date(), err: '', loading: false
      };
    } catch (e) {
      if (e.message === 'SIGNED_OUT' && hadSession) {
        location.reload();
        return;
      }
      state = { ...state, err: e.message, loading: false };
    }
    emit();
  }
};
