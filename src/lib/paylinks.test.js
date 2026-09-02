import { describe, expect, it } from "vitest";

import {
  buildPayLinks,
  buildPayLinksText,
  decodePayLink,
  encodePayLink,
  payPath,
} from "./paylinks";

const LINK = {
  proxyType: "MOBILE",
  proxyValue: "91234567",
  payeeName: "Mark",
  personName: "Amy",
  amountCents: 2410,
  reference: "Din Tai Fung",
};

describe("encode/decode round trip", () => {
  it("survives a round trip unchanged", () => {
    expect(decodePayLink(encodePayLink(LINK))).toEqual(LINK);
  });

  it("produces a payload that is safe in a URL path", () => {
    // base64url only. A "+" or "/" here would be mangled by the router or by
    // whichever chat app rewrote the link on the way.
    expect(encodePayLink(LINK)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("handles names outside Latin-1", () => {
    // btoa() throws on these outright, so this is the case that would have
    // taken the generator down for a whole table.
    const link = { ...LINK, personName: "陈美玲", payeeName: "José" };
    expect(decodePayLink(encodePayLink(link))).toEqual(link);
  });

  it("keeps a typical link short enough to paste into a chat", () => {
    const url = `https://split2win.duckdns.org${payPath(encodePayLink(LINK))}`;
    expect(url.length).toBeLessThan(160);
  });

  it("round-trips without the optional fields", () => {
    const bare = {
      proxyType: "MOBILE",
      proxyValue: "91234567",
      payeeName: "",
      personName: "Amy",
      amountCents: 100,
      reference: "",
    };
    expect(decodePayLink(encodePayLink(bare))).toEqual(bare);
  });

  it("round-trips a UEN payee", () => {
    const uen = { ...LINK, proxyType: "UEN", proxyValue: "202012345A" };
    expect(decodePayLink(encodePayLink(uen))).toEqual(uen);
  });
});

describe("encodePayLink rejects amounts it cannot represent", () => {
  it("refuses a non-integer amount", () => {
    // Everything upstream is integer cents. A float arriving here means a
    // total was re-derived somewhere, and it would round differently from the
    // figure the table already agreed on.
    expect(() => encodePayLink({ ...LINK, amountCents: 24.1 })).toThrow(/integer/i);
  });

  it("refuses zero and negative amounts", () => {
    expect(() => encodePayLink({ ...LINK, amountCents: 0 })).toThrow(/positive/i);
    expect(() => encodePayLink({ ...LINK, amountCents: -100 })).toThrow(/positive/i);
  });
});

describe("decodePayLink refuses anything it is not sure about", () => {
  it.each([
    ["empty", ""],
    ["null", null],
    ["not base64url", "!!!!"],
    ["not JSON", btoa("hello")],
    ["not an array", btoa(JSON.stringify({ a: 1 }))],
    ["too few fields", btoa(JSON.stringify([1, 0, "91234567"]))],
    ["unknown version", btoa(JSON.stringify([99, 0, "9123", "M", "A", 100]))],
    ["unknown proxy type", btoa(JSON.stringify([1, 7, "9123", "M", "A", 100]))],
    ["missing proxy value", btoa(JSON.stringify([1, 0, "", "M", "A", 100]))],
    ["float amount", btoa(JSON.stringify([1, 0, "9123", "M", "A", 10.5]))],
    ["string amount", btoa(JSON.stringify([1, 0, "9123", "M", "A", "100"]))],
    ["zero amount", btoa(JSON.stringify([1, 0, "9123", "M", "A", 0]))],
    ["negative amount", btoa(JSON.stringify([1, 0, "9123", "M", "A", -5]))],
  ])("returns null for %s", (_label, payload) => {
    expect(decodePayLink(payload)).toBeNull();
  });

  it("returns null for a truncated link rather than a smaller amount", () => {
    // Chat apps have clipped long URLs before. The failure mode that matters
    // is not "broken page", it is "plausible wrong number".
    const full = encodePayLink(LINK);
    for (let cut = 1; cut < 12; cut += 1) {
      const decoded = decodePayLink(full.slice(0, full.length - cut));
      if (decoded !== null) expect(decoded).toEqual(LINK);
    }
  });
});

describe("buildPayLinks", () => {
  const perPerson = [
    { id: "p1", name: "Mark", totalCents: 3000 },
    { id: "p2", name: "Amy", totalCents: 2410 },
    { id: "p3", name: "Jo", totalCents: 1590 },
    { id: "p4", name: "Sam", totalCents: 0 },
  ];
  const base = {
    perPerson,
    proxyType: "MOBILE",
    proxyValue: "91234567",
    payeeName: "Mark",
    reference: "Din Tai Fung",
    origin: "https://split2win.duckdns.org",
  };

  it("excludes the payer — they do not owe themselves", () => {
    const links = buildPayLinks({ ...base, payeePersonId: "p1" });
    expect(links.map((l) => l.name)).toEqual(["Amy", "Jo"]);
  });

  it("includes everyone when the payer was not at the table", () => {
    const links = buildPayLinks({ ...base, payeePersonId: "" });
    expect(links.map((l) => l.name)).toEqual(["Mark", "Amy", "Jo"]);
  });

  it("excludes anyone owing nothing", () => {
    expect(buildPayLinks(base).map((l) => l.name)).not.toContain("Sam");
  });

  it("carries each person's own amount, unmodified", () => {
    const links = buildPayLinks({ ...base, payeePersonId: "p1" });
    links.forEach((link) => {
      const source = perPerson.find((p) => p.name === link.name);
      expect(link.amountCents).toBe(source.totalCents);
      // And the amount that actually reaches the payer's page.
      const payload = link.url.split("/pay/")[1];
      expect(decodePayLink(payload).amountCents).toBe(source.totalCents);
    });
  });

  it("points every link at the same payee", () => {
    buildPayLinks({ ...base, payeePersonId: "p1" }).forEach((link) => {
      const decoded = decodePayLink(link.url.split("/pay/")[1]);
      expect(decoded.proxyValue).toBe("91234567");
      expect(decoded.payeeName).toBe("Mark");
      expect(decoded.reference).toBe("Din Tai Fung");
    });
  });

  it("names the right person in each link", () => {
    buildPayLinks({ ...base, payeePersonId: "p1" }).forEach((link) => {
      expect(decodePayLink(link.url.split("/pay/")[1]).personName).toBe(link.name);
    });
  });
});

describe("buildPayLinksText", () => {
  it("is one pasteable line per person", () => {
    const links = [
      { id: "p2", name: "Amy", amountCents: 2410, url: "https://x/pay/aaa" },
      { id: "p3", name: "Jo", amountCents: 1590, url: "https://x/pay/bbb" },
    ];
    const text = buildPayLinksText(links, {
      payeeName: "Mark",
      reference: "Din Tai Fung",
    });
    expect(text).toContain("Amy: https://x/pay/aaa");
    expect(text).toContain("Jo: https://x/pay/bbb");
    // Whose account the money lands in is the thing a group chat most needs
    // stated out loud.
    expect(text).toContain("Mark");
    expect(text).toContain("Din Tai Fung");
  });

  it("is empty when there is nothing to send", () => {
    expect(buildPayLinksText([])).toBe("");
  });
});
