import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Divider,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import IosShareIcon from "@mui/icons-material/IosShare";
import QrCode2Icon from "@mui/icons-material/QrCode2";

import { formatMoney } from "../lib/split";
import { buildShareText, shareText } from "../lib/share";
import PayNowDialog from "./PayNowDialog";

export default function SummaryPanel({
  split,
  currency,
  chargeMode = "proportional",
  onChargeModeChange,
  payee,
  onSavePayee,
  reference = "",
}) {
  const { perPerson, unassigned, chargeCents, totalCents, receiptTotalCents } = split;
  const grand = perPerson.reduce((sum, p) => sum + p.totalCents, 0);
  const [qrPerson, setQrPerson] = useState(null);
  const [toast, setToast] = useState("");

  const onShare = async () => {
    const result = await shareText(
      buildShareText({ perPerson, receiptTotalCents, chargeMode, title: reference })
    );
    setToast(
      result === "copied"
        ? "Copied — paste it into the chat."
        : result === "failed"
          ? "Couldn't share on this device."
          : ""
    );
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        Who owes what
      </Typography>

      {/* Both are defensible and tables genuinely disagree about it, so it is
          a choice rather than a rule. Proportional is the default because it
          is how the restaurant computed the charges in the first place. */}
      {chargeCents !== 0 && onChargeModeChange && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>
            Service &amp; tax
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            fullWidth
            value={chargeMode}
            onChange={(_, next) => next && onChargeModeChange(next)}
          >
            <ToggleButton value="proportional" sx={{ textTransform: "none", py: 0.5 }}>
              By what you ate
            </ToggleButton>
            <ToggleButton value="equal" sx={{ textTransform: "none", py: 0.5 }}>
              Split evenly
            </ToggleButton>
          </ToggleButtonGroup>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
            {chargeMode === "equal"
              ? `Everyone pays the same share of ${formatMoney(chargeCents)}.`
              : `${formatMoney(chargeCents)} shared out in proportion to each person's food.`}
          </Typography>
        </Box>
      )}

      {unassigned.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {unassigned.length} line{unassigned.length === 1 ? " is" : "s are"} still
          unassigned, so these totals don't cover the whole bill yet.
        </Alert>
      )}

      {perPerson.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Add some people to see the split.
        </Typography>
      ) : (
        <Stack spacing={1}>
          {perPerson.map((p) => (
            <Box key={p.id}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body1" fontWeight={600}>
                  {p.name}
                </Typography>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Typography variant="h6" fontWeight={700}>
                    {formatMoney(p.totalCents, currency)}
                  </Typography>
                  {p.totalCents > 0 && onSavePayee && (
                    <Tooltip title={`PayNow QR for ${p.name}`}>
                      <IconButton
                        size="small"
                        aria-label={`Show PayNow QR for ${p.name}`}
                        onClick={() => setQrPerson(p)}
                      >
                        <QrCode2Icon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              </Stack>
              {/* Showing the charge share separately is the point: it is
                  proportional to what each person ate, not an even slice. */}
              {chargeCents !== 0 && (
                <Typography variant="caption" color="text.secondary">
                  {formatMoney(p.foodCents)} food + {formatMoney(p.chargeCents)} service
                  &amp; tax
                </Typography>
              )}
            </Box>
          ))}

          <Divider sx={{ my: 1 }} />

          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              Everyone together
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {formatMoney(grand)}
            </Typography>
          </Stack>

          {receiptTotalCents !== null && (
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                Receipt total
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formatMoney(receiptTotalCents)}
              </Typography>
            </Stack>
          )}

          {unassigned.length === 0 &&
            receiptTotalCents !== null &&
            grand === receiptTotalCents && (
              <Alert severity="success" variant="outlined" sx={{ mt: 1 }}>
                Adds up exactly to the receipt.
              </Alert>
            )}

          {unassigned.length === 0 &&
            receiptTotalCents !== null &&
            grand !== receiptTotalCents && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                These add up to {formatMoney(grand)} but the receipt says{" "}
                {formatMoney(receiptTotalCents)}. Check the lines on the previous
                screen.
              </Alert>
            )}

          {receiptTotalCents === null && totalCents !== grand && (
            <Alert severity="info" sx={{ mt: 1 }}>
              Some lines are still unassigned.
            </Alert>
          )}

          <Button
            variant="outlined"
            startIcon={<IosShareIcon />}
            onClick={onShare}
            sx={{ mt: 1 }}
          >
            Share the split
          </Button>
        </Stack>
      )}

      <PayNowDialog
        key={qrPerson?.id || "none"}
        open={Boolean(qrPerson)}
        onClose={() => setQrPerson(null)}
        person={qrPerson}
        payee={payee}
        onSavePayee={onSavePayee}
        reference={reference}
      />

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={3000}
        onClose={() => setToast("")}
        message={toast}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Paper>
  );
}
