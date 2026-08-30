import { Box, IconButton, InputAdornment, MenuItem, TextField, Tooltip } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

const CATEGORIES = [
  { value: "item", label: "Item" },
  { value: "service_charge", label: "Service" },
  { value: "tax", label: "Tax/GST" },
  { value: "discount", label: "Discount" },
  { value: "rounding", label: "Rounding" },
];

/**
 * One editable line.
 *
 * Laid out with CSS grid rather than MUI's Grid. The old row used
 * `<Grid item xs={8}>`, and MUI v7 removed both `item` and `xs` — the props
 * were silently ignored, so the 8/4 split never actually applied.
 */
export default function ReceiptItemRow({ item, onChange, onRemove }) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 1,
        alignItems: "center",
        mb: 1,
        gridTemplateColumns: {
          xs: "1fr auto",
          sm: "minmax(0,1fr) 84px 116px auto",
        },
        gridTemplateAreas: {
          xs: '"name remove" "qty qty" "price price" "cat cat"',
          sm: "none",
        },
      }}
    >
      <TextField
        size="small"
        label="Item"
        value={item.name}
        onChange={(e) => onChange(item.id, { name: e.target.value })}
        sx={{ gridArea: { xs: "name", sm: "auto" }, minWidth: 0 }}
      />
      <TextField
        size="small"
        label="Qty"
        type="number"
        value={item.quantity}
        onChange={(e) =>
          onChange(item.id, { quantity: Math.max(1, Number(e.target.value) || 1) })
        }
        slotProps={{ htmlInput: { min: 1, step: 1, inputMode: "numeric" } }}
        sx={{ gridArea: { xs: "qty", sm: "auto" } }}
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
          input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
        }}
        sx={{ gridArea: { xs: "price", sm: "auto" } }}
      />
      <TextField
        select
        size="small"
        label="Type"
        value={item.category}
        onChange={(e) => onChange(item.id, { category: e.target.value })}
        sx={{ gridArea: { xs: "cat", sm: "auto" }, display: { xs: "flex", sm: "none" } }}
      >
        {CATEGORIES.map((c) => (
          <MenuItem key={c.value} value={c.value}>
            {c.label}
          </MenuItem>
        ))}
      </TextField>
      <Tooltip title="Remove line">
        <IconButton
          aria-label={`Remove ${item.name || "item"}`}
          onClick={() => onRemove(item.id)}
          size="small"
          sx={{ gridArea: { xs: "remove", sm: "auto" } }}
        >
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
