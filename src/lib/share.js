/**
 * Handing the result to everyone else.
 *
 * The app used to stop at "here is what everyone owes", leaving you to
 * screenshot it into the group chat. This turns the summary into text that
 * pastes cleanly into WhatsApp.
 */

import { formatMoney } from "./split";

export function buildShareText({ perPerson, receiptTotalCents, chargeMode, title }) {
  const lines = [];
  lines.push(title ? `${title} — ${formatMoney(receiptTotalCents ?? 0)}` : "Bill split");

  // Pad names so the amounts line up in a monospaced chat bubble.
  const width = Math.max(...perPerson.map((p) => p.name.length), 0);
  perPerson.forEach((p) => {
    lines.push(`${p.name.padEnd(width)}  ${formatMoney(p.totalCents)}`);
  });

  if (chargeMode === "equal") {
    lines.push("");
    lines.push("Service & tax split evenly.");
  }
  return lines.join("\n");
}

/**
 * Share via the OS sheet where available, otherwise copy to the clipboard.
 * @returns {Promise<"shared"|"copied"|"failed">}
 */
export async function shareText(text) {
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return "shared";
    } catch (err) {
      // Dismissing the share sheet is a cancel, not a failure to report.
      if (err?.name === "AbortError") return "shared";
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
