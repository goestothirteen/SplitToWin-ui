import { useCallback, useEffect, useRef, useState } from "react";
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
import { clearPending, loadPending, newJobId, savePending } from "../lib/pending";

// Reading a receipt measured 12-30s, and the variance is upstream load rather
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
  // Guards against two resume attempts overlapping — a reload and a
  // visibility change can otherwise fire almost together.
  const runningRef = useRef(false);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  const startNarration = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = STAGES.map((s) => setTimeout(() => setStage(s.text), s.at));
  }, []);

  /**
   * Run one upload. The photo and job id are already stored, so if this call
   * dies with the tab, `resume` can pick it up again with the same id.
   */
  const run = useCallback(
    async ({ jobId, file, resumed = false }) => {
      if (runningRef.current) return;
      // Belt and braces: an empty file would post a request with no image and
      // come back as "no image was uploaded", which reads like the app losing
      // your photo rather than a storage problem.
      if (!file || file.size === 0) {
        await clearPending();
        setError("That photo didn't survive — pick it again.");
        return;
      }
      runningRef.current = true;

      setError(null);
      setBusy(true);
      setStage(resumed ? "Picking up where it left off…" : STAGES[0].text);
      startNarration();

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const parsed = await parseReceipt(file, { signal: controller.signal, jobId });
        await clearPending();
        onParsed(parsed, URL.createObjectURL(file));
      } catch (err) {
        if (err?.name === "AbortError") return;
        // The pending record is deliberately left in place: the next time the
        // page is visible it retries, and the server serves the cached result
        // if it had already finished.
        setError(
          err instanceof ApiError
            ? err.message
            : "Something went wrong reading that receipt."
        );
      } finally {
        timersRef.current.forEach(clearTimeout);
        abortRef.current = null;
        runningRef.current = false;
        setBusy(false);
      }
    },
    [onParsed, startNarration]
  );

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    // Reset immediately so picking the same file twice still fires onChange.
    event.target.value = "";
    if (!file) return;

    const jobId = newJobId();
    // Stored *before* the request, so a tab discarded mid-upload can still
    // find the photo when it reloads.
    await savePending({ jobId, file });
    run({ jobId, file });
  };

  // Resume on load and whenever the tab comes back to the foreground. iOS
  // Safari kills the in-flight request when you switch apps, and may discard
  // the page entirely — this is what turns that from "the scan died" into a
  // few seconds of catching up.
  useEffect(() => {
    if (hasReceipt) return undefined;

    let cancelled = false;
    const resume = async () => {
      if (cancelled || runningRef.current || document.hidden) return;
      const pending = await loadPending();
      if (!pending || cancelled || runningRef.current) return;
      run({ jobId: pending.jobId, file: pending.file, resumed: true });
    };

    resume();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("pageshow", resume);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("pageshow", resume);
    };
  }, [hasReceipt, run]);

  const cancel = async () => {
    abortRef.current?.abort();
    await clearPending();
    setBusy(false);
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
            <Button color="inherit" onClick={cancel}>
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

        {/* Deliberately no `capture` attribute: it forces the camera and
            hides the photo library, so you cannot pick a receipt you already
            photographed. Without it the phone offers the full chooser —
            camera, library, and files. */}
        <input
          ref={inputRef}
          type="file"
          hidden
          accept="image/*"
          onChange={handleFile}
        />

        {busy && (
          <Box>
            <LinearProgress />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              {stage}
            </Typography>
            <Typography variant="caption" color="text.disabled">
              Safe to switch apps — this picks up again when you come back.
            </Typography>
          </Box>
        )}

        {error && (
          <Alert
            severity="error"
            onClose={() => setError(null)}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={async () => {
                  const pending = await loadPending();
                  if (pending) {
                    run({ jobId: pending.jobId, file: pending.file, resumed: true });
                  } else {
                    // Nothing stored to retry with — sending them back to the
                    // picker is more use than silently dismissing the error.
                    setError("That photo is no longer available — pick it again.");
                    inputRef.current?.click();
                  }
                }}
              >
                Retry
              </Button>
            }
          >
            {error}
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}
