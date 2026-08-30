import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";

import { ApiError, parseReceipt } from "../api/client";

// Reading a receipt measured 7-20s, and the variance is upstream load rather
// than anything we control. A bare spinner for that long reads as "hung", so
// the wait narrates itself instead.
const STAGES = [
  { at: 0, text: "Uploading the photo…" },
  { at: 2500, text: "Reading the receipt…" },
  { at: 8000, text: "Working out the line items…" },
  { at: 16000, text: "Still going — busy receipt, hang on…" },
];

export default function UploadPanel({ onParsed, hasReceipt }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [stage, setStage] = useState(STAGES[0].text);
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const timersRef = useRef([]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  const startNarration = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = STAGES.map((s) =>
      setTimeout(() => setStage(s.text), s.at)
    );
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    // Reset immediately so picking the same file twice still fires onChange.
    event.target.value = "";
    if (!file) return;

    setError(null);
    setBusy(true);
    setStage(STAGES[0].text);
    startNarration();

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const parsed = await parseReceipt(file, { signal: controller.signal });
      onParsed(parsed, URL.createObjectURL(file));
    } catch (err) {
      if (err?.name === "AbortError") return;
      // A real message, not the old blanket alert("Failed to process receipt").
      setError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong reading that receipt."
      );
    } finally {
      timersRef.current.forEach(clearTimeout);
      abortRef.current = null;
      setBusy(false);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          alignItems={{ xs: "stretch", sm: "center" }}
        >
          <Button
            variant="contained"
            startIcon={<PhotoCameraIcon />}
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            size="large"
          >
            {hasReceipt ? "Use a different photo" : "Upload receipt"}
          </Button>
          {busy && (
            <Button color="inherit" onClick={() => abortRef.current?.abort()}>
              Cancel
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          {!busy && !hasReceipt && (
            <Typography variant="body2" color="text.secondary">
              A straight-on photo in good light reads best.
            </Typography>
          )}
        </Stack>

        {/* `capture` opens the camera directly on a phone, which is the
            common case — you are standing at the table with the bill. */}
        <input
          ref={inputRef}
          type="file"
          hidden
          accept="image/*"
          capture="environment"
          onChange={handleFile}
        />

        {busy && (
          <Box>
            <LinearProgress />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              {stage}
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}
