import {
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";

import { formatMoney, toCents } from "../lib/split";

const CATEGORIES = [
  { value: "item", label: "Food or drink" },
  { value: "service_charge", label: "Service charge" },
  { value: "tax", label: "Tax / GST" },
  { value: "discount", label: "Discount" },
  { value: "rounding", label: "Rounding" },
];

const CATEGORY_CHIP = {
  service_charge: "service",
  tax: "tax",
  discount: "discount",
  rounding: "rounding",
};

/**
 * One receipt line: compact by default, editable when tapped.
 *
 * It used to render four full-width stacked fields per item, so a phone
 * showed barely three lines and checking the parse meant scrolling the whole
 * receipt. Reading is the common case and editing the exception, so the row
 * now reads like a receipt and only becomes a form when you ask it to.
 */
export default function ReceiptItemRow({ item, expanded, onToggle, onChange, onRemove }) {
  const chip = CATEGORY_CHIP[item.category];

  return (
    <Box
      sx={{
        borderBottom: "1px solid",
        borderColor: "divider",
        "&:last-of-type": { borderBottom: 0 },
      }}
    >
      <Box
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => onToggle(item.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle(item.id);
          }
        }}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          // Comfortable one-handed tap target at a dinner table.
          py: 1.25,
          px: 0.5,
          cursor: "pointer",
          borderRadius: 1,
          "&:hover": { bgcolor: "action.hover" },
          "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main" },
        }}
      >
        {item.quantity > 1 && (
          <Typography
            variant="body2"
            sx={{
              fontWeight: 700,
              color: "primary.main",
              minWidth: 24,
              flexShrink: 0,
            }}
          >
            {item.quantity}×
          </Typography>
        )}

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="body1"
            sx={{ lineHeight: 1.3, color: chip ? "text.secondary" : "text.primary" }}
          >
            {item.name || (
              <Box component="span" sx={{ color: "text.disabled", fontStyle: "italic" }}>
                Unnamed — tap to fix
              </Box>
            )}
          </Typography>
          {chip && (
            <Chip
              label={chip}
              size="small"
              variant="outlined"
              sx={{ mt: 0.5, height: 20, fontSize: 11 }}
            />
          )}
        </Box>

        <Typography
          variant="body1"
          sx={{
            fontWeight: 600,
            flexShrink: 0,
            fontVariantNumeric: "tabular-nums",
            color: chip ? "text.secondary" : "text.primary",
          }}
        >
          {formatMoney(toCents(item.lineTotal))}
        </Typography>

        <EditIcon
          fontSize="small"
          sx={{ color: "text.disabled", flexShrink: 0, opacity: expanded ? 1 : 0.5 }}
        />
      </Box>

      <Collapse in={expanded} unmountOnExit>
        <Box sx={{ px: 0.5, pb: 2, pt: 0.5 }}>
          <Stack spacing={1.5}>
            <TextField
              size="small"
              label="Item"
              fullWidth
              autoFocus
              value={item.name}
              onChange={(e) => onChange(item.id, { name: e.target.value })}
            />
            <Stack direction="row" spacing={1.5}>
              <TextField
                size="small"
                label="Qty"
                type="number"
                value={item.quantity}
                onChange={(e) =>
                  onChange(item.id, {
                    quantity: Math.max(1, Number(e.target.value) || 1),
                  })
                }
                slotProps={{ htmlInput: { min: 1, step: 1, inputMode: "numeric" } }}
                sx={{ width: 90 }}
              />
              <TextField
                size="small"
                label="Price"
                type="number"
                value={item.lineTotal}
                onChange={(e) => onChange(item.id, { lineTotal: e.target.value })}
                onBlur={(e) =>
                  onChange(item.id, { lineTotal: Number(e.target.value) || 0 })
                }
                slotProps={{
                  htmlInput: { step: "0.01", inputMode: "decimal" },
                  input: {
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  },
                }}
                sx={{ flex: 1 }}
              />
            </Stack>
            <TextField
              select
              size="small"
              label="Type"
              fullWidth
              value={item.category}
              onChange={(e) => onChange(item.id, { category: e.target.value })}
              helperText={
                item.category === "item"
                  ? "Assigned to whoever ate it"
                  : "Shared out in proportion to what each person ate"
              }
            >
              {CATEGORIES.map((c) => (
                <MenuItem key={c.value} value={c.value}>
                  {c.label}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="contained" onClick={() => onToggle(item.id)}>
                Done
              </Button>
              <Box sx={{ flex: 1 }} />
              <IconButton
                aria-label={`Remove ${item.name || "item"}`}
                onClick={() => onRemove(item.id)}
                size="small"
                color="error"
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Stack>
        </Box>
      </Collapse>
    </Box>
  );
}
