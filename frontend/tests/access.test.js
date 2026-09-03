import { describe, it, expect } from 'vitest';
import { RANK, canAccess } from '../src/lib/access.js';

const open = { nav: 'Dashboard' };
const staff = { nav: 'Vendors', minRole: 'approver' };
const adminOnly = { nav: 'Admin', minRole: 'admin' };

const as = role => ({ email: 'x@oizom.com', role });

describe('canAccess', () => {
  it('lets anyone into a view with no minRole', () => {
    expect(canAccess(open, as('requester'))).toBe(true);
  });

  it('lets an admin into an admin-only view', () => {
    expect(canAccess(adminOnly, as('admin'))).toBe(true);
  });

  it('keeps a requester out of an admin-only view', () => {
    expect(canAccess(adminOnly, as('requester'))).toBe(false);
  });

  it('keeps an approver out of an admin-only view', () => {
    expect(canAccess(adminOnly, as('approver'))).toBe(false);
  });

  it('lets a higher rank into a lower-ranked view', () => {
    expect(canAccess(staff, as('admin'))).toBe(true);
  });

  it('lets finance into an approver-ranked view (tied ranks)', () => {
    expect(canAccess(staff, as('finance'))).toBe(true);
  });

  it('keeps finance out of an admin-only view', () => {
    expect(canAccess(adminOnly, as('finance'))).toBe(false);
  });

  // Before the first sync `me` is null. Bouncing then would throw an admin off
  // their own deep link just because the session hadn't loaded yet.
  it('allows access while the session is still unknown', () => {
    expect(canAccess(adminOnly, null)).toBe(true);
  });

  it('denies a signed-in user whose role is not recognised', () => {
    expect(canAccess(adminOnly, as(''))).toBe(false);
    expect(canAccess(adminOnly, as('nonsense'))).toBe(false);
  });
});

describe('RANK', () => {
  it('orders requester below approver below admin', () => {
    expect(RANK.requester).toBeLessThan(RANK.approver);
    expect(RANK.approver).toBeLessThan(RANK.admin);
  });
  it('ties finance with approver — orthogonal duties, not a hierarchy', () => {
    expect(RANK.finance).toBe(RANK.approver);
  });
});
