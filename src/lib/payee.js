/**
 * The person who fronted the bill.
 *
 * This used to be modelled as "you" — one PayNow number in localStorage,
 * reused every dinner. That was wrong, and wrong in the direction that costs
 * someone money: whoever paid the bill *changes every time*. Assuming the
 * phone's owner is always the payee means the night a friend picks up the tab,
 * every link in the group chat quietly points the money at the wrong account.
 *
 * So the payee is now part of the bill, chosen explicitly per split, and it
 * lives in the per-sitting session alongside the receipt rather than in
 * long-term storage.
 *
 * What *is* kept long-term is a short list of numbers used before, purely so
 * the common case is a tap instead of typing eight digits at a dinner table.
 * That list is a suggestion. It is never applied on its own — the current
 * split's payee always starts empty and has to be chosen.
 */

import { PROXY_TYPES } from "./paynow";

const RECENTS_KEY = "splittowin.payees.recent.v1";
// The single "this is you" number the previous version stored. It is read
// once, as a suggestion, so that upgrading does not silently lose a number
// someone had saved — but it is never applied on its own, because the whole
// point of the change is that the payer is chosen per bill.
const LEGACY_KEY = "splittowin.payee.v1";
const MAX_RECENTS = 5;

const safe = (fn, fallback) => {
  try {
    return fn();
  } catch {
    // Private mode, blocked site data, quota.
    return fallback;
  }
};

/** A split with no payee chosen yet. Deliberately blank, never a default. */
export const EMPTY_PAYEE = {
  proxyType: PROXY_TYPES.MOBILE,
  proxyValue: "",
  payeeName: "",
  // Which diner paid, when they were at the table. Their link is not
  // generated — they do not owe themselves.
  personId: "",
};

const clean = (raw) => ({
  proxyType: raw?.proxyType === PROXY_TYPES.UEN ? PROXY_TYPES.UEN : PROXY_TYPES.MOBILE,
  proxyValue: typeof raw?.proxyValue === "string" ? raw.proxyValue : "",
  payeeName: typeof raw?.payeeName === "string" ? raw.payeeName : "",
  personId: typeof raw?.personId === "string" ? raw.personId : "",
});

export const normalisePayee = clean;

/** Numbers used on previous bills, most recent first. Suggestions only. */
export function loadRecentPayees() {
  return safe(() => {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .map(clean)
          .filter((p) => p.proxyValue)
          .slice(0, MAX_RECENTS);
      }
    }
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const entry = clean(JSON.parse(legacy));
      if (entry.proxyValue) return [entry];
    }
    return [];
  }, []);
}

/**
 * Remember a payee for next time, most recent first and de-duplicated on the
 * number. Called when links are generated, not while the field is being typed
 * in — a half-typed number is not a memory worth keeping.
 */
export function rememberPayee(payee) {
  const entry = clean(payee);
  if (!entry.proxyValue) return loadRecentPayees();
  const next = [
    entry,
    ...loadRecentPayees().filter(
      (p) => !(p.proxyValue === entry.proxyValue && p.proxyType === entry.proxyType)
    ),
  ].slice(0, MAX_RECENTS);
  safe(() => window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next)));
  return next;
}

export function clearRecentPayees() {
  safe(() => window.localStorage.removeItem(RECENTS_KEY));
}
