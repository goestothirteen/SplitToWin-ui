import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

import ReceiptItemRow from "./ReceiptItemRow";
import { formatMoney, isCharge, isFood, toCents } from "../lib/split";

export default function ReceiptPanel({ receiptImage, items, receipt, actions }) {
  const [editingId, setEditingId] = useState(null);
  const foodCents = items.filter(isFood).reduce((s, i) => s + toCents(i.lineTotal), 0);
  const chargeCents = items
    .filter(isCharge)
    .reduce((s, i) => s + toCents(i.lineTotal), 0);
  const grandCents = foodCents + chargeCents;
  const printedCents = receipt?.total ? toCents(receipt.total) : null;
  const off = printedCents !== null ? grandCents - printedCents : 0;

  return (
    <Stack spacing={2}>
      {receiptImage && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Your photo
          </Typography>
          <Box
            component="img"
            src={receiptImage}
            alt="The receipt you uploaded"
            sx={{
              width: "100%",
              maxHeight: { xs: 260, md: 420 },
              objectFit: "contain",
              borderRadius: 1,
              bgcolor: "grey.100",
            }}
          />
        </Paper>
      )}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 1.5 }}
        >
          <Typography variant="subtitle1" fontWeight={600}>
            Lines
          </Typography>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setEditingId(actions.addItem())}
          >
            Add line
          </Button>
        </Stack>

        {/* The parser is good but not infallible, so every field stays
            editable and the arithmetic below updates as you correct it.
            One row open at a time keeps the list scannable while editing. */}
        {items.map((item) => (
          <ReceiptItemRow
            key={item.id}
            item={item}
            expanded={editingId === item.id}
            onToggle={(id) => setEditingId((current) => (current === id ? null : id))}
            onChange={actions.updateItem}
            onRemove={actions.removeItem}
          />
        ))}

        {items.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            No lines yet — upload a receipt, or add them by hand.
          </Typography>
        )}

        <Divider sx={{ my: 2 }} />

        <Stack spacing={0.5}>
          <Row label="Items" value={formatMoney(foodCents)} />
          {chargeCents !== 0 && (
            <Row
              label="Service, tax & adjustments"
              value={formatMoney(chargeCents)}
              muted
            />
          )}
          <Row label="Total" value={formatMoney(grandCents)} bold />
          {printedCents !== null && (
            <Row
              label="Printed on the receipt"
              value={formatMoney(printedCents)}
              muted
            />
          )}
        </Stack>

        {/* The receipt's own total is a free checksum. The old app read it
            and threw it away, so a misread line silently produced a wrong
            bill that nobody could catch. */}
        {printedCents !== null && Math.abs(off) >= 1 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            These lines add up to {formatMoney(grandCents)}, but the receipt says{" "}
            {formatMoney(printedCents)} — a difference of {formatMoney(Math.abs(off))}.
            Check for a missed or misread line before splitting.
          </Alert>
        )}
      </Paper>
    </Stack>
  );
}

function Row({ label, value, bold = false, muted = false }) {
  return (
    <Stack direction="row" justifyContent="space-between">
      <Typography
        variant={bold ? "subtitle1" : "body2"}
        color={muted ? "text.secondary" : "text.primary"}
        fontWeight={bold ? 700 : 400}
      >
        {label}
      </Typography>
      <Typography
        variant={bold ? "subtitle1" : "body2"}
        color={muted ? "text.secondary" : "text.primary"}
        fontWeight={bold ? 700 : 400}
      >
        {value}
      </Typography>
    </Stack>
  );
}
