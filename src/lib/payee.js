/**
 * The person collecting the money — you.
 *
 * Kept in localStorage rather than sessionStorage: your own PayNow number is
 * the same every dinner, so asking for it once is enough. It never leaves the
 * device — no request carries it, and it is not in the session that gets
 * shared or persisted server-side, because there is no server-side session.
 */

import { PROXY_TYPES } from "./paynow";

const KEY = "splittowin.payee.v1";

const safe = (fn, fallback) => {
  try {
    return fn();
  } catch {
    // Private mode, blocked site data, quota.
    return fallback;
  }
};

export const EMPTY_PAYEE = {
  proxyType: PROXY_TYPES.MOBILE,
  proxyValue: "",
  payeeName: "",
};

export function loadPayee() {
  return safe(() => {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY_PAYEE;
    const parsed = JSON.parse(raw);
    return {
      proxyType:
        parsed?.proxyType === PROXY_TYPES.UEN ? PROXY_TYPES.UEN : PROXY_TYPES.MOBILE,
      proxyValue: typeof parsed?.proxyValue === "string" ? parsed.proxyValue : "",
      payeeName: typeof parsed?.payeeName === "string" ? parsed.payeeName : "",
    };
  }, EMPTY_PAYEE);
}

export function savePayee(payee) {
  safe(() => window.localStorage.setItem(KEY, JSON.stringify(payee)));
}

export function clearPayee() {
  safe(() => window.localStorage.removeItem(KEY));
}
