/**
 * PayNow QR payloads.
 *
 * A PayNow QR is an EMVCo QR Code (the SGQR standard): a string of
 * length-prefixed fields, ending in a CRC. It encodes the *payee* — you — and
 * optionally a fixed amount, so each person at the table gets their own QR
 * saying "pay Mark $24.10". Same destination, different amount.
 *
 * Everything here is generated on the device. No payment API, no fees, and
 * the payee's number never leaves the phone.
 */

/** `id` + zero-padded length + value. The whole format is just this, nested. */
const tlv = (id, value) =>
  `${id}${String(value.length).padStart(2, "0")}${value}`;

/**
 * CRC-16/CCITT-FALSE: poly 0x1021, init 0xFFFF, no reflection, no final xor.
 * Verified against the standard check vector (CRC of "123456789" = 0x29B1).
 */
export function crc16(input) {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i += 1) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export const PROXY_TYPES = { MOBILE: "MOBILE", UEN: "UEN" };

/**
 * Normalise a Singapore mobile into the +65XXXXXXXX form PayNow expects.
 * People type it with spaces, dashes, or no country code.
 */
export function normaliseMobile(raw) {
  const digits = String(raw || "").replace(/[^\d]/g, "");
  if (!digits) return "";
  const local = digits.startsWith("65") && digits.length > 8 ? digits.slice(2) : digits;
  return local.length === 8 ? `+65${local}` : "";
}

export function normaliseUen(raw) {
  return String(raw || "")
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "");
}

/** Is this payee usable? Returns "" when fine, or a reason it isn't. */
export function validateProxy(type, value) {
  if (type === PROXY_TYPES.MOBILE) {
    return normaliseMobile(value)
      ? ""
      : "That doesn't look like a Singapore mobile number (8 digits).";
  }
  return normaliseUen(value).length >= 9 ? "" : "That doesn't look like a UEN.";
}

/**
 * Build the PayNow QR string.
 *
 * @param {object} opts
 * @param {"MOBILE"|"UEN"} opts.proxyType
 * @param {string} opts.proxyValue  mobile number or UEN
 * @param {number} opts.amountCents locked amount; omit/0 for a payer-entered amount
 * @param {string} [opts.reference] shows up in the payer's app, e.g. "Din Tai Fung"
 * @param {string} [opts.payeeName] name shown in the payer's app
 */
export function buildPayNowPayload({
  proxyType = PROXY_TYPES.MOBILE,
  proxyValue,
  amountCents = 0,
  reference = "",
  payeeName = "NA",
}) {
  const isMobile = proxyType === PROXY_TYPES.MOBILE;
  const proxy = isMobile ? normaliseMobile(proxyValue) : normaliseUen(proxyValue);
  if (!proxy) throw new Error("A valid PayNow mobile number or UEN is required.");

  // Merchant Account Information — the PayNow-specific block.
  const merchant =
    tlv("00", "SG.PAYNOW") +
    tlv("01", isMobile ? "0" : "2") + // 0 = mobile, 2 = UEN
    tlv("02", proxy) +
    // 0 = the payer cannot change the amount. That is the point: the number
    // is already correct, so there is nothing for them to mistype.
    tlv("03", amountCents > 0 ? "0" : "1");

  // Reference shows up on both statements, which is what makes a bill
  // identifiable weeks later.
  const additional = reference ? tlv("62", tlv("01", sanitise(reference, 25))) : "";

  const body =
    tlv("00", "01") +
    // 12 = dynamic (single use, carries an amount); 11 = static.
    tlv("01", amountCents > 0 ? "12" : "11") +
    tlv("26", merchant) +
    tlv("52", "0000") + // merchant category: not a merchant
    tlv("53", "702") + // SGD
    (amountCents > 0 ? tlv("54", (amountCents / 100).toFixed(2)) : "") +
    tlv("58", "SG") +
    tlv("59", sanitise(payeeName, 25) || "NA") +
    tlv("60", "Singapore") +
    additional;

  // The CRC covers everything including its own "6304" id-and-length header.
  const withCrcHeader = `${body}6304`;
  return `${withCrcHeader}${crc16(withCrcHeader)}`;
}

/** EMVCo fields are ASCII; strip anything that would corrupt the payload. */
function sanitise(text, maxLength) {
  return String(text || "")
    .replace(/[^\x20-\x7E]/g, "")
    .trim()
    .slice(0, maxLength);
}
