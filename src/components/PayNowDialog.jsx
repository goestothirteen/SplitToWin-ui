import { useMemo } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";

import { formatMoney } from "../lib/split";
import { buildPayNowPayload, normaliseMobile, normaliseUen } from "../lib/paynow";
import { downloadDataUrl, qrFilename, useQrDataUrl } from "../lib/qr";

/**
 * One person's QR, shown across the table.
 *
 * This is the same code their pay link would render, for when everyone is
 * still sitting there and it is quicker to hold up a phone than to send a
 * message. It is deliberately *read-only*: the payee is chosen once, in the
 * pay-links dialog. It used to be editable here too, which meant two places
 * could set where the money goes and the last one tapped won — exactly the
 * kind of ambiguity that is fine for a setting and not fine for an account
 * number.
 */
export default function PayNowDialog({ open, onClose, person, payee, reference }) {
  const payload = useMemo(() => {
    if (!payee?.proxyValue || !person) return "";
    try {
      return buildPayNowPayload({
        proxyType: payee.proxyType,
        proxyValue: payee.proxyValue,
        amountCents: person.totalCents,
        reference,
        payeeName: payee.payeeName || "NA",
      });
    } catch {
      return "";
    }
  }, [payee, person, reference]);

  const { dataUrl, error } = useQrDataUrl(payload);

  const proxyDisplay = payee?.proxyValue
    ? payee.proxyType === "UEN"
      ? normaliseUen(payee.proxyValue)
      : normaliseMobile(payee.proxyValue)
    : "";

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 1 }}>
        {person ? `${person.name} pays` : "PayNow"}
        {person && (
          <Typography variant="h4" fontWeight={700} sx={{ mt: 0.5 }}>
            {formatMoney(person.totalCents)}
          </Typography>
        )}
      </DialogTitle>

      <DialogContent>
        {!payee?.proxyValue ? (
          <Alert severity="info">
            Set who is being paid first — use “Generate pay links”.
          </Alert>
        ) : (
          <Stack spacing={1.5} alignItems="center">
            {dataUrl ? (
              <Box
                component="img"
                src={dataUrl}
                alt={`PayNow QR for ${person?.name}`}
                sx={{ width: "100%", maxWidth: 300, borderRadius: 1 }}
              />
            ) : (
              <Box sx={{ height: 300, display: "grid", placeItems: "center" }}>
                <Typography variant="body2" color="text.secondary">
                  {error || "Drawing the code…"}
                </Typography>
              </Box>
            )}
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Scan with any Singapore banking app. The amount is fixed, so there
              is nothing to type.
            </Typography>
            <Button
              fullWidth
              startIcon={<DownloadIcon />}
              disabled={!dataUrl}
              onClick={() =>
                downloadDataUrl(
                  dataUrl,
                  qrFilename({
                    personName: person?.name,
                    amountCents: person?.totalCents ?? 0,
                  })
                )
              }
            >
              Save QR image
            </Button>
            <Typography variant="caption" color="text.secondary">
              Paying to {payee.payeeName ? `${payee.payeeName} · ` : ""}
              {proxyDisplay}
            </Typography>
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
