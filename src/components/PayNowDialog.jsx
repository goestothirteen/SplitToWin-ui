import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import QRCode from "qrcode";

import { formatMoney } from "../lib/split";
import { PROXY_TYPES, buildPayNowPayload, validateProxy } from "../lib/paynow";

/**
 * A PayNow QR for one person's share.
 *
 * The QR encodes *you* as payee plus *their* exact amount, so scanning it in a
 * banking app pre-fills both and locks the figure. One QR per person, all
 * paying the same account.
 *
 * If no payee is set up yet the dialog collects it first, since a QR without a
 * destination is useless.
 */
export default function PayNowDialog({
  open,
  onClose,
  person,
  payee,
  onSavePayee,
  reference,
}) {
  const [draft, setDraft] = useState(payee);
  const [editing, setEditing] = useState(!payee.proxyValue);
  // Paired with the payload it was drawn from, so a stale code can never be
  // shown for the wrong amount while a new one renders.
  const [qr, setQr] = useState({ payload: "", url: "", error: "" });

  const problem = useMemo(
    () => (editing ? validateProxy(draft.proxyType, draft.proxyValue) : ""),
    [editing, draft]
  );

  const payload = useMemo(() => {
    if (editing || !payee.proxyValue || !person) return "";
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
  }, [editing, payee, person, reference]);

  useEffect(() => {
    if (!payload) return undefined;
    let cancelled = false;
    // Generous margin so it scans off a phone screen across a table.
    QRCode.toDataURL(payload, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 320,
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setQr({ payload, url, error: "" });
      })
      .catch(() => {
        if (!cancelled) setQr({ payload, url: "", error: "Couldn't draw the QR code." });
      });
    return () => {
      cancelled = true;
    };
  }, [payload]);

  // Only trust the code if it was drawn from the payload we want right now.
  const dataUrl = qr.payload === payload ? qr.url : "";
  const error = qr.payload === payload ? qr.error : "";

  const save = () => {
    if (problem) return;
    onSavePayee(draft);
    setEditing(false);
  };

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
        {editing ? (
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Where should the money go? This is stored on this phone only and
              is never sent anywhere.
            </Typography>
            <TextField
              select
              size="small"
              label="PayNow to"
              value={draft.proxyType}
              onChange={(e) => setDraft({ ...draft, proxyType: e.target.value })}
            >
              <MenuItem value={PROXY_TYPES.MOBILE}>Mobile number</MenuItem>
              <MenuItem value={PROXY_TYPES.UEN}>UEN</MenuItem>
            </TextField>
            <TextField
              size="small"
              label={draft.proxyType === PROXY_TYPES.MOBILE ? "Mobile number" : "UEN"}
              placeholder={
                draft.proxyType === PROXY_TYPES.MOBILE ? "9123 4567" : "202012345A"
              }
              value={draft.proxyValue}
              onChange={(e) => setDraft({ ...draft, proxyValue: e.target.value })}
              error={Boolean(draft.proxyValue) && Boolean(problem)}
              helperText={draft.proxyValue ? problem : " "}
              slotProps={{
                htmlInput: {
                  inputMode:
                    draft.proxyType === PROXY_TYPES.MOBILE ? "tel" : "text",
                },
              }}
            />
            <TextField
              size="small"
              label="Your name (optional)"
              placeholder="Shows in their banking app"
              value={draft.payeeName}
              onChange={(e) => setDraft({ ...draft, payeeName: e.target.value })}
            />
          </Stack>
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
            <Button size="small" onClick={() => setEditing(true)}>
              Paying to {payee.proxyValue} — change
            </Button>
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        {editing ? (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              variant="contained"
              onClick={save}
              disabled={Boolean(problem) || !draft.proxyValue}
            >
              Save
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>Done</Button>
        )}
      </DialogActions>

      {!editing && !payee.proxyValue && (
        <Alert severity="info" sx={{ m: 2, mt: 0 }}>
          Add your PayNow number to show a code.
        </Alert>
      )}
    </Dialog>
  );
}
