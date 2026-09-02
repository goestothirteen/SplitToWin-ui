/**
 * Personalised pay links.
 *
 * One link per person who owes, pasted into the group chat. Tapping it opens
 * /pay/<payload>, which renders their name, their exact amount, and a PayNow
 * QR made out to whoever fronted the bill.
 *
 * Everything the page needs travels *in the URL*. There is no split id, no
 * database, no server round trip — the app is stateless by design, so a
 * rollback is only ever a code change. That has one consequence worth stating
 * plainly: a link is a bearer token for its own contents. Anyone holding it
 * sees the payee's PayNow number and one person's share. That is exactly what
 * you were about to paste into a group chat anyway, but it does mean links
 * should not be treated as private, and they never carry anything else.
 *
 * The payload is a positional array rather than an object because these get
 * pasted into WhatsApp, where a long URL wraps into an ugly wall of text.
 * Positional saves ~35 characters per link over named keys. The leading
 * version number is what makes that safe to change later: a decoder that
 * meets a version it does not know refuses rather than guesses, because
 * guessing here means showing someone the wrong amount.
 */

const VERSION = 1;

/**
 * Field order for v1. Changing this list is a breaking change — bump VERSION,
 * because links already sent to people keep working forever.
 *
 *   [ version, proxyTypeCode, proxyValue, payeeName, personName, amountCents, reference ]
 *
 * proxyTypeCode reuses PayNow's own numbering (0 = mobile, 2 = UEN) so there
 * is only ever one mapping to get wrong, not two.
 */
export const PROXY_CODES = { MOBILE: 0, UEN: 2 };

const PROXY_CODE_TO_TYPE = { 0: "MOBILE", 2: "UEN" };
const PROXY_TYPE_TO_CODE = { MOBILE: 0, UEN: 2 };

/** UTF-8 → base64url. `btoa` alone throws on any name outside Latin-1. */
function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** base64url → UTF-8. Throws on anything that is not valid base64url. */
function fromBase64Url(encoded) {
  const padded = String(encoded).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

/**
 * Encode one person's share into a URL-safe payload.
 *
 * @param {object} link
 * @param {"MOBILE"|"UEN"} link.proxyType
 * @param {string} link.proxyValue   the payee's PayNow mobile or UEN
 * @param {string} [link.payeeName]  who is being paid, shown on the page
 * @param {string} link.personName   who owes
 * @param {number} link.amountCents  integer cents, straight from the split
 * @param {string} [link.reference]  bill label, e.g. "Din Tai Fung"
 */
export function encodePayLink({
  proxyType = "MOBILE",
  proxyValue,
  payeeName = "",
  personName,
  amountCents,
  reference = "",
}) {
  if (!Number.isInteger(amountCents)) {
    // Money is integer cents everywhere in this app. A float arriving here
    // means someone re-derived a total instead of using the split's, and the
    // rounding would no longer match what the summary showed.
    throw new Error("amountCents must be an integer number of cents.");
  }
  if (amountCents <= 0) throw new Error("A pay link needs a positive amount.");

  const fields = [
    VERSION,
    PROXY_TYPE_TO_CODE[proxyType] ?? PROXY_CODES.MOBILE,
    String(proxyValue || ""),
    String(payeeName || ""),
    String(personName || ""),
    amountCents,
    String(reference || ""),
  ];

  // Trailing empties cost characters and carry no meaning; the decoder
  // defaults them back. Only ever trims from the end, so positions hold.
  while (fields.length > 6 && fields[fields.length - 1] === "") fields.pop();

  return toBase64Url(JSON.stringify(fields));
}

/**
 * Decode a payload back into a link.
 *
 * Returns `null` for anything malformed rather than throwing or, worse,
 * partially succeeding. A truncated link — WhatsApp has clipped one before —
 * must read as "this link is broken", never as a plausible smaller amount.
 *
 * @returns {{proxyType, proxyValue, payeeName, personName, amountCents, reference}|null}
 */
export function decodePayLink(payload) {
  if (!payload || typeof payload !== "string") return null;
  let fields;
  try {
    fields = JSON.parse(fromBase64Url(payload));
  } catch {
    return null;
  }

  if (!Array.isArray(fields) || fields.length < 6) return null;
  const [version, proxyCode, proxyValue, payeeName, personName, amountCents, reference] =
    fields;

  if (version !== VERSION) return null;
  const proxyType = PROXY_CODE_TO_TYPE[proxyCode];
  if (!proxyType) return null;
  if (typeof proxyValue !== "string" || !proxyValue) return null;
  if (typeof personName !== "string") return null;
  // Integer cents only. A float or a string here is a corrupted link, and a
  // corrupted amount is the one failure that must never render.
  if (!Number.isInteger(amountCents) || amountCents <= 0) return null;

  return {
    proxyType,
    proxyValue,
    payeeName: typeof payeeName === "string" ? payeeName : "",
    personName,
    amountCents,
    reference: typeof reference === "string" ? reference : "",
  };
}

/** The path a payload lives at. Kept here so the route and the builder agree. */
export const payPath = (payload) => `/pay/${payload}`;

/**
 * Build the full list of links for a split.
 *
 * The payee is excluded: they fronted the bill, so they do not owe themselves.
 * Anyone at zero is excluded too — a QR for $0.00 is not a thing.
 *
 * @param {object} opts
 * @param {Array<{id, name, totalCents}>} opts.perPerson  straight from computeSplit
 * @param {string} [opts.payeePersonId]  the diner who paid, if they were at the table
 * @param {string} opts.origin           e.g. "https://split2win.duckdns.org"
 * @returns {Array<{id, name, amountCents, url}>}
 */
export function buildPayLinks({
  perPerson = [],
  payeePersonId = "",
  proxyType,
  proxyValue,
  payeeName,
  reference,
  origin,
}) {
  return perPerson
    .filter((p) => p.id !== payeePersonId && p.totalCents > 0)
    .map((p) => ({
      id: p.id,
      name: p.name,
      amountCents: p.totalCents,
      url: `${origin}${payPath(
        encodePayLink({
          proxyType,
          proxyValue,
          payeeName,
          personName: p.name,
          // The split's own integer cents, never recomputed here.
          amountCents: p.totalCents,
          reference,
        })
      )}`,
    }));
}

/** "Name: <url>" per line — the shape that pastes cleanly into WhatsApp. */
export function buildPayLinksText(links, { payeeName, reference } = {}) {
  const who = payeeName ? ` ${payeeName}` : "";
  const what = reference ? ` — ${reference}` : "";
  const lines = links.length ? [`Your share${what}. Tap your link to pay${who}:`, ""] : [];
  links.forEach((l) => lines.push(`${l.name}: ${l.url}`));
  return lines.join("\n");
}
