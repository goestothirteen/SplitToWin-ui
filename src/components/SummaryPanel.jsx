import {
  Alert,
  Box,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import { formatMoney } from "../lib/split";

export default function SummaryPanel({ split, currency }) {
  const { perPerson, unassigned, chargeCents, totalCents, receiptTotalCents } = split;
  const grand = perPerson.reduce((sum, p) => sum + p.totalCents, 0);

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        Who owes what
      </Typography>

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
              <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                <Typography variant="body1" fontWeight={600}>
                  {p.name}
                </Typography>
                <Typography variant="h6" fontWeight={700}>
                  {formatMoney(p.totalCents, currency)}
                </Typography>
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
        </Stack>
      )}
    </Paper>
  );
}
