/**
 * Session persistence.
 *
 * All state used to live only in React memory, so refreshing on /split — or
 * following the URL directly — left a blank page with no way back and the
 * whole bill lost. Phones reload tabs on their own when memory is tight,
 * which made that a real way to lose a bill mid-dinner.
 *
 * sessionStorage rather than localStorage: a bill is per-sitting, and it
 * should not still be there next week.
 */

const KEY = "splittowin.session.v1";

const safe = (fn, fallback) => {
  try {
    return fn();
  } catch {
    // Private mode, blocked site data, quota — never let storage break the app.
    return fallback;
  }
};

export function loadSession() {
  return safe(() => {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      people: Array.isArray(parsed.people) ? parsed.people : [],
      groups: Array.isArray(parsed.groups) ? parsed.groups : [],
      assignments:
        parsed.assignments && typeof parsed.assignments === "object"
          ? parsed.assignments
          : {},
      receipt: parsed.receipt && typeof parsed.receipt === "object" ? parsed.receipt : null,
      chargeMode: parsed.chargeMode === "equal" ? "equal" : "proportional",
    };
  }, null);
}

export function saveSession(state) {
  safe(() => {
    // The receipt image is a blob: URL that dies with the page, so it is
    // deliberately not persisted — only the parsed data is worth keeping.
    window.sessionStorage.setItem(
      KEY,
      JSON.stringify({
        items: state.items,
        people: state.people,
        groups: state.groups,
        assignments: state.assignments,
        receipt: state.receipt,
        chargeMode: state.chargeMode,
      })
    );
  });
}

export function clearSession() {
  safe(() => window.sessionStorage.removeItem(KEY));
}
