import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Container,
  Divider,
  Paper,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import { useParams } from "react-router-dom";

import NavBar from "../components/NavBar";
import { decodePayLink } from "../lib/paylinks";
import { buildPayNowPayload, normaliseMobile, normaliseUen } from "../lib/paynow";
import { downloadDataUrl, qrFilename, useQrDataUrl } from "../lib/qr";

/**
 * One person's share, opened from a link in the group chat.
 *
 * Entirely client-rendered from the URL — no session, no API call, no account.
 * Whoever taps this has probably never seen the app before and is standing
 * outside a restaurant, so it is one screen with one obvious thing to do.
 *
 * The thing to do is deliberately *save the image*, not tap through to a bank.
 * DBS PayLah has no deep link that accepts a recipient and an amount; the only
 * one it exposes takes an opaque DBS-minted reference that nobody else can
 * produce. A hand-made `dbspaylah://?mobile=..&amount=..` link does not fail
 * loudly, it just silently does nothing — which at a dinner table reads as
 * "the app is broken". A PayNow SGQR is the one thing every Singapore banking
 * app genuinely accepts, including from the gallery, which is why saving the
 * picture is the primary action on a page that will mostly be opened on the
 * same phone the payment happens on.
 */
export default function PayPage() {
  const { payload } = useParams();
  const [toast, setToast] = useState("");

  const link = useMemo(() => decodePayLink(payload), [payload]);

  // Built from the decoded link, not from anything typed here, so the amount
  // on screen and the amount in the code cannot disagree.
  const qrPayload = useMemo(() => {
    if (!link) return "";
    try {
      return buildPayNowPayload({
        proxyType: link.proxyType,
        proxyValue: link.proxyValue,
        amountCents: link.amountCents,
        reference: link.reference,
        payeeName: link.payeeName || "NA",
      });
    } catch {
      return "";
    }
  }, [link]);

  const { dataUrl, error } = useQrDataUrl(qrPayload);

  const proxyDisplay = link
    ? link.proxyType === "MOBILE"
      ? normaliseMobile(link.proxyValue)
      : normaliseUen(link.proxyValue)
    : "";
  const amount = link ? (link.amountCents / 100).toFixed(2) : "";
  const payeeLabel = link ? link.payeeName || proxyDisplay : "";

  const copy = async (text, what) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast(`${what} copied.`);
    } catch {
      setToast(`Couldn't copy — long-press to select instead.`);
    }
  };

  if (!link || !qrPayload) {
    return (
      <>
        <NavBar />
        <Container maxWidth="sm" sx={{ py: 3 }}>
          <Alert severity="error">
            This payment link is incomplete or damaged — links sometimes get cut
            short when they are forwarded. Ask for it again rather than paying
            from a half-loaded page.
          </Alert>
        </Container>
      </>
    );
  }

  return (
    <>
      <NavBar />

      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6" fontWeight={600}>
              {link.personName ? `${link.personName}, pay ` : "Pay "}
              {payeeLabel}
            </Typography>
            <Typography variant="h3" fontWeight={700} sx={{ mt: 0.5 }}>
              S${amount}
            </Typography>
            {link.reference && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {link.reference}
              </Typography>
            )}
          </Box>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={2} alignItems="center">
              {dataUrl ? (
                <Box
                  component="img"
                  src={dataUrl}
                  alt={`PayNow QR for S$${amount} to ${payeeLabel}`}
                  sx={{
                    width: "100%",
                    maxWidth: 320,
                    display: "block",
                    borderRadius: 1,
                  }}
                />
              ) : (
                <Box
                  sx={{
                    width: "100%",
                    maxWidth: 320,
                    aspectRatio: "1",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    {error || "Drawing the code…"}
                  </Typography>
                </Box>
              )}

              <Button
                fullWidth
                size="large"
                variant="contained"
                startIcon={<DownloadIcon />}
                disabled={!dataUrl}
                onClick={() =>
                  downloadDataUrl(
                    dataUrl,
                    qrFilename({
                      personName: link.personName,
                      amountCents: link.amountCents,
                    })
                  )
                }
              >
                Save QR image
              </Button>

              <Typography variant="body2" color="text.secondary" textAlign="center">
                Open PayLah → Scan &amp; Pay → upload this QR from your gallery.
              </Typography>
              <Typography variant="caption" color="text.secondary" textAlign="center">
                Or scan it directly from another phone with any Singapore banking
                app. The amount is fixed, so there is nothing to type.
              </Typography>
            </Stack>
          </Paper>

          {/* If the QR route fails them — an unusual bank app, a cracked
              screen — the same payment is still makeable by hand. */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Or pay manually
            </Typography>
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  {link.proxyType === "MOBILE" ? "PayNow mobile" : "PayNow UEN"}
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {proxyDisplay}
                </Typography>
              </Stack>
              <Divider />
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  Amount
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  S${amount}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ pt: 0.5 }}>
                <Button
                  fullWidth
                  size="small"
                  variant="outlined"
                  startIcon={<ContentCopyIcon />}
                  onClick={() => copy(amount, "Amount")}
                >
                  Copy amount
                </Button>
                <Button
                  fullWidth
                  size="small"
                  variant="outlined"
                  startIcon={<ContentCopyIcon />}
                  onClick={() =>
                    copy(
                      proxyDisplay,
                      link.proxyType === "MOBILE" ? "Number" : "UEN"
                    )
                  }
                >
                  {link.proxyType === "MOBILE" ? "Copy number" : "Copy UEN"}
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </Stack>
      </Container>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={3000}
        onClose={() => setToast("")}
        message={toast}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </>
  );
}
