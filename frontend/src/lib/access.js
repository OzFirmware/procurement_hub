// Role ranking, shared by the nav filter and the route guard so a view can
// never be linkable but unreachable, or reachable but unlinked. 'finance' is
// tied with 'approver' — they're orthogonal duties, not a hierarchy — but no
// current view sets minRole:'approver', so this mainly keeps the two roles
// symmetric for future gating. MUST mirror apps-script/Code.gs.
export const RANK = { requester: 0, approver: 1, finance: 1, admin: 2 };

// `me` is null until the first sync lands. Treat unknown as allowed: bouncing
// then would throw an admin off their own deep link before the session had a
// chance to load. Once `me` exists, an unrecognised role outranks nothing.
export function canAccess(view, me) {
  if (!me) return true;
  if (!view || !view.minRole) return true;
  const rank = RANK[me.role];
  return rank != null && rank >= RANK[view.minRole];
}
