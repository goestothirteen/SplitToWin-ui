import { describe, expect, it } from "vitest";

import {
  PROXY_TYPES,
  buildPayNowPayload,
  crc16,
  normaliseMobile,
  normaliseUen,
  validateProxy,
} from "./paynow";

/**
 * A PayNow QR that is subtly malformed does not fail loudly — the banking app
 * just refuses it, at a dinner table, with no explanation. So this file pins
 * the exact bytes.
 *
 * The expected strings below were derived independently (a separate CRC-16
 * implementation in Python, and the field layout read off the EMVCo
 * merchant-presented QR spec plus the SGQR/PayNow profile), not by printing
 * what this module happened to produce. A test that asserts a function equals
 * itself would have caught none of the things worth catching.
 *
 * The mobile number used throughout is 9123 4567 — the standard documentation
 * placeholder, deliberately not anyone's real number.
 */

// Field-by-field, this is:
//   0002 01                     payload format indicator
//   0102 12                     point of initiation: 12 = dynamic (has amount)
//   2638 ...                    merchant account info, the PayNow block:
//        0009 SG.PAYNOW           globally unique identifier
//        0101 0                   proxy type: 0 = mobile
//        0211 +6591234567         proxy value
//        0301 0                   amount editable: 0 = no
//   5204 0000                   merchant category code: not a merchant
//   5303 702                    currency: 702 = SGD
//   5405 24.10                  transaction amount
//   5802 SG                     country
//   5904 Mark                   merchant (payee) name
//   6009 Singapore              merchant city
//   6216 0112Din Tai Fung       additional data → 01 = bill reference
//   6304 90FC                   CRC-16/CCITT-FALSE over everything above
const DYNAMIC =
  "00020101021226380009SG.PAYNOW010100211+659123456703010520400005303702" +
  "540524.105802SG5904Mark6009Singapore62160112Din Tai Fung630490FC";

const STATIC =
  "00020101021126380009SG.PAYNOW010100211+65912345670301152040000530370" +
  "25802SG5902NA6009Singapore6304B5DB";

/**
 * An independent TLV reader.
 *
 * Deliberately not built out of the builder's helpers: decoding with the same
 * code that encoded would agree with itself no matter how wrong both were.
 */
function parseTlv(payload) {
  const out = {};
  let i = 0;
  while (i < payload.length) {
    const id = payload.slice(i, i + 2);
    const length = Number(payload.slice(i + 2, i + 4));
    expect(Number.isInteger(length)).toBe(true);
    const value = payload.slice(i + 4, i + 4 + length);
    expect(value).toHaveLength(length);
    out[id] = value;
    i += 4 + length;
  }
  // A payload whose fields do not tile it exactly is malformed, and that is
  // precisely the failure a banking app reports as an unreadable code.
  expect(i).toBe(payload.length);
  return out;
}

describe("crc16 (CRC-16/CCITT-FALSE)", () => {
  it("matches the standard check vector", () => {
    // The canonical check value for this algorithm. If this passes, the
    // polynomial, the 0xFFFF init, the bit order and the absence of a final
    // XOR are all right.
    expect(crc16("123456789")).toBe("29B1");
  });

  it("zero-pads to four hex digits", () => {
    // A CRC that happens to be small must not shorten the field — "6304 1A2"
    // shifts every following byte and the whole payload becomes garbage.
    const short = ["", "A", "B", "C"].map(crc16);
    short.forEach((value) => expect(value).toMatch(/^[0-9A-F]{4}$/));
  });
});

describe("normaliseMobile", () => {
  it.each([
    ["91234567", "+6591234567"],
    ["9123 4567", "+6591234567"],
    ["9123-4567", "+6591234567"],
    ["+65 9123 4567", "+6591234567"],
    ["6591234567", "+6591234567"],
    ["65 9123 4567", "+6591234567"],
  ])("normalises %s", (input, expected) => {
    expect(normaliseMobile(input)).toBe(expected);
  });

  it.each([["", ""], ["123", ""], ["912345678901", ""], [null, ""], [undefined, ""]])(
    "rejects %s",
    (input) => {
      expect(normaliseMobile(input)).toBe("");
    }
  );

  it("keeps an eight-digit number that merely starts with 65", () => {
    // 6512 3456 is a valid local number, not a country code plus six digits.
    // Stripping "65" here would silently pay a different account.
    expect(normaliseMobile("65123456")).toBe("+6565123456");
  });
});

describe("validateProxy", () => {
  it("accepts a good mobile and a good UEN", () => {
    expect(validateProxy(PROXY_TYPES.MOBILE, "9123 4567")).toBe("");
    expect(validateProxy(PROXY_TYPES.UEN, "202012345A")).toBe("");
  });

  it("explains a bad one rather than just failing", () => {
    expect(validateProxy(PROXY_TYPES.MOBILE, "123")).toMatch(/mobile/i);
    expect(validateProxy(PROXY_TYPES.UEN, "12")).toMatch(/UEN/i);
  });
});

describe("buildPayNowPayload", () => {
  it("builds the exact expected payload for a fixed number and amount", () => {
    expect(
      buildPayNowPayload({
        proxyType: PROXY_TYPES.MOBILE,
        proxyValue: "9123 4567",
        amountCents: 2410,
        reference: "Din Tai Fung",
        payeeName: "Mark",
      })
    ).toBe(DYNAMIC);
  });

  it("builds the exact expected payload with no amount", () => {
    expect(
      buildPayNowPayload({
        proxyType: PROXY_TYPES.MOBILE,
        proxyValue: "91234567",
      })
    ).toBe(STATIC);
  });

  it("decodes back to the intended payee and amount", () => {
    const fields = parseTlv(DYNAMIC);

    expect(fields["00"]).toBe("01");
    expect(fields["01"]).toBe("12"); // dynamic: carries an amount
    expect(fields["52"]).toBe("0000");
    expect(fields["53"]).toBe("702"); // SGD
    expect(fields["54"]).toBe("24.10");
    expect(fields["58"]).toBe("SG");
    expect(fields["59"]).toBe("Mark");
    expect(fields["60"]).toBe("Singapore");

    const merchant = parseTlv(fields["26"]);
    expect(merchant["00"]).toBe("SG.PAYNOW");
    expect(merchant["01"]).toBe("0"); // mobile
    expect(merchant["02"]).toBe("+6591234567");
    expect(merchant["03"]).toBe("0"); // the payer cannot edit the amount

    expect(parseTlv(fields["62"])["01"]).toBe("Din Tai Fung");
  });

  it("carries a self-consistent CRC", () => {
    const payload = buildPayNowPayload({
      proxyValue: "98765432",
      amountCents: 999,
      reference: "Lunch",
    });
    const body = payload.slice(0, -4);
    expect(body.slice(-4)).toBe("6304");
    expect(payload.slice(-4)).toBe(crc16(body));
  });

  it("locks the amount only when there is one", () => {
    // 03 is "amount editable". With a fixed figure it must be 0, or the payer
    // is free to type a different number over the top of it.
    expect(
      parseTlv(parseTlv(buildPayNowPayload({ proxyValue: "91234567", amountCents: 100 }))["26"])[
        "03"
      ]
    ).toBe("0");
    expect(
      parseTlv(parseTlv(buildPayNowPayload({ proxyValue: "91234567" }))["26"])["03"]
    ).toBe("1");
  });

  it.each([
    [1, "0.01"],
    [5, "0.05"],
    [50, "0.50"],
    [100, "1.00"],
    [2410, "24.10"],
    [123456, "1234.56"],
    [100000000, "1000000.00"],
  ])("formats %d cents as %s", (cents, expected) => {
    expect(parseTlv(buildPayNowPayload({ proxyValue: "91234567", amountCents: cents }))["54"]).toBe(
      expected
    );
  });

  it("builds a UEN payload with proxy type 2", () => {
    const merchant = parseTlv(
      parseTlv(
        buildPayNowPayload({
          proxyType: PROXY_TYPES.UEN,
          proxyValue: "202012345a",
          amountCents: 1000,
        })
      )["26"]
    );
    expect(merchant["01"]).toBe("2");
    expect(merchant["02"]).toBe("202012345A");
  });

  it("refuses to build anything without a valid proxy", () => {
    expect(() => buildPayNowPayload({ proxyValue: "123" })).toThrow(/valid PayNow/i);
    expect(() => buildPayNowPayload({ proxyValue: "" })).toThrow(/valid PayNow/i);
  });

  it("strips characters that would corrupt the payload", () => {
    // Lengths are counted in characters, so a stray emoji in a restaurant name
    // would desynchronise every field after it.
    const fields = parseTlv(
      buildPayNowPayload({
        proxyValue: "91234567",
        amountCents: 500,
        payeeName: "Mark 🎉",
        reference: "Café ☕ night",
      })
    );
    expect(fields["59"]).toBe("Mark");
    expect(parseTlv(fields["62"])["01"]).toBe("Caf  night");
  });

  it("truncates long names rather than overflowing the field", () => {
    const fields = parseTlv(
      buildPayNowPayload({
        proxyValue: "91234567",
        amountCents: 500,
        payeeName: "A".repeat(80),
        reference: "B".repeat(80),
      })
    );
    expect(fields["59"]).toHaveLength(25);
    expect(parseTlv(fields["62"])["01"]).toHaveLength(25);
  });

  it("normaliseUen strips punctuation and upper-cases", () => {
    expect(normaliseUen("2020-12345 a")).toBe("202012345A");
  });
});
