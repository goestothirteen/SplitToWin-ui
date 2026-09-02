/**
 * Drawing a PayNow payload as a QR image.
 *
 * Shared by the dialog at the table and the per-person pay page, so there is
 * one set of rendering options rather than two that drift apart. The options
 * matter more than they look: these codes get scanned off a phone screen
 * across a table, and — the whole point of the pay links — re-scanned from a
 * *screenshot* uploaded into PayLah's gallery picker. That second path is
 * lossy, so the code is drawn large with a generous quiet zone.
 */

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export const QR_OPTIONS = {
  // M survives a screenshot that has been resized and re-compressed by a
  // messaging app. L does not, reliably.
  errorCorrectionLevel: "M",
  // The quiet zone is part of the spec, not decoration — a gallery-uploaded
  // crop with no margin is the classic "why won't it scan" failure.
  margin: 2,
  width: 512,
  color: { dark: "#000000", light: "#ffffff" },
};

/**
 * Render `payload` to a PNG data URL.
 *
 * The result is always paired with the payload it was drawn from, so a stale
 * code can never be shown next to a new amount while the new one renders.
 * That pairing is the reason this is a hook and not a one-liner: showing
 * person A's QR above person B's figure is a silent way to send money wrong.
 *
 * @returns {{dataUrl: string, error: string, pending: boolean}}
 */
export function useQrDataUrl(payload) {
  const [drawn, setDrawn] = useState({ payload: "", dataUrl: "", error: "" });

  useEffect(() => {
    if (!payload) return undefined;
    let cancelled = false;
    QRCode.toDataURL(payload, QR_OPTIONS)
      .then((dataUrl) => {
        if (!cancelled) setDrawn({ payload, dataUrl, error: "" });
      })
      .catch(() => {
        if (!cancelled)
          setDrawn({ payload, dataUrl: "", error: "Couldn't draw the QR code." });
      });
    return () => {
      cancelled = true;
    };
  }, [payload]);

  const current = drawn.payload === payload;
  return {
    dataUrl: current ? drawn.dataUrl : "",
    error: current ? drawn.error : "",
    pending: Boolean(payload) && !current,
  };
}

/** Trigger a download of a data URL under a readable filename. */
export function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** A filename someone can find again in their camera roll. */
export function qrFilename({ personName, amountCents }) {
  const who = String(personName || "paynow")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `paynow-${who || "share"}-${(amountCents / 100).toFixed(2)}.png`;
}
