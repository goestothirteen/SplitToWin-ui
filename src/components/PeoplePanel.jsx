import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

let seq = 0;
// Ids used to be `name.toLowerCase()`, so two people called Mark collided into
// one droppable target and one merged total. Identity is now independent of
// the name, which also means renaming someone keeps their items.
const newId = () => `p${Date.now().toString(36)}${(seq += 1)}`;

export default function PeoplePanel({ people, setPeople }) {
  const [input, setInput] = useState("");

  const add = () => {
    const names = input
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    setPeople((current) => [
      ...current,
      ...names.map((name) => ({ id: newId(), name })),
    ]);
    setInput("");
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        Who's splitting?
      </Typography>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{ mb: people.length ? 2 : 0 }}
      >
        <TextField
          fullWidth
          size="small"
          label="Add names"
          placeholder="Mark, Amy, Jo"
          helperText="Separate several with commas"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Box>
          <Button
            variant="contained"
            onClick={add}
            disabled={!input.trim()}
            sx={{ width: { xs: "100%", sm: "auto" } }}
          >
            Add
          </Button>
        </Box>
      </Stack>

      <Stack direction="row" gap={1} flexWrap="wrap">
        {people.map((p) => (
          <Chip
            key={p.id}
            label={p.name}
            onDelete={() =>
              setPeople((current) => current.filter((x) => x.id !== p.id))
            }
          />
        ))}
      </Stack>
    </Paper>
  );
}
