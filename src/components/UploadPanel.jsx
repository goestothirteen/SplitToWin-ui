import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";

import { ApiError, parseReceipt, resumeParse } from "../api/client";
import { clearPending, loadPending, newJobId, savePending } from "../lib/pending";

// The wait used to be narrated by a timer: fixed sentences on a schedule,
// which said "still going" whether the server was reading the receipt or had
// quietly died. The server now reports what it is actually doing, so this is
// only the opening line — everything after it comes from the job itself.
const OPENING = "Sending the photo…";

// A photo that isn't a bill is not an error the person should retry into.
// They need a different photo, so the panel says so and offers the picker
// instead of a Retry button that would fail the same way.
const REJECTIONS = new Set(["not_a_receipt", "no_items"]);

function describe(snapshot) {
  if (!snapshot) return OPENING;
  const { stage, detail, itemsFound } = snapshot;
  if (itemsFound > 0) {
    return `Reading the lines — ${itemsFound} so far…`;
  }
  const base = stage || OPENING;
  return detail ? `${base} — ${detail}` : `${base}…`;
}

export default function UploadPanel({ onParsed, hasReceipt }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [rejected, setRejected] = useState(false);
  const [stage, setStage] = useState(OPENING);
  const [elapsed, setElapsed] = useState(0);
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  // Guards against two resume attempts overlapping — a reload and a
  // visibility change can otherwise fire almost together.
  const runningRef = useRef(false);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const onProgress = useCallback((snapshot) => {
    setStage(describe(snapshot));
    if (typeof snapshot?.elapsedSeconds === "number") {
      setElapsed(Math.round(snapshot.elapsedSeconds));
    }
  }, []);

  /**
   * Run one upload. The photo and job id are already stored, so if this call
   * dies with the tab, `resume` can pick it up again with the same id —
   * which now means re-attaching to the job, not re-sending the photo.
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
      setRejected(false);
      setBusy(true);
      setElapsed(0);
      setStage(resumed ? "Catching up with the reader…" : OPENING);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const options = { signal: controller.signal, onProgress };
        const parsed = resumed
          ? await resumeParse(jobId, file, options)
          : await parseReceipt(file, { ...options, jobId });
        await clearPending();
        onParsed(parsed, URL.createObjectURL(file));
      } catch (err) {
        if (err?.name === "AbortError") return;
        const isRejection = err instanceof ApiError && REJECTIONS.has(err.code);
        // A rejected photo will be rejected again, so the stored one goes —
        // holding it would make the resume-on-focus loop retry it forever.
        if (isRejection) await clearPending();
        setRejected(isRejection);
        setError(
          err instanceof ApiError
            ? err.message
            : "Something went wrong reading that receipt."
        );
      } finally {
        abortRef.current = null;
        runningRef.current = false;
        setBusy(false);
      }
    },
    [onParsed, onProgress]
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
  // the page entirely — this is what turns that from "the scan died" into
  // picking the answer back up, usually already finished.
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

  const pickAnother = () => {
    setError(null);
    setRejected(false);
    inputRef.current?.click();
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
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="baseline"
              sx={{ mt: 0.75 }}
            >
              <Typography variant="body2" color="text.secondary">
                {stage}
              </Typography>
              {elapsed > 2 && (
                <Typography variant="caption" color="text.disabled">
                  {elapsed}s
                </Typography>
              )}
            </Stack>
            <Typography variant="caption" color="text.disabled">
              Safe to switch apps — this picks up again when you come back.
            </Typography>
          </Box>
        )}

        {error && (
          <Alert
            severity={rejected ? "warning" : "error"}
            onClose={() => setError(null)}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={async () => {
                  if (rejected) {
                    pickAnother();
                    return;
                  }
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
                {rejected ? "Pick another" : "Retry"}
              </Button>
            }
          >
            {rejected && <AlertTitle>That photo won't work</AlertTitle>}
            {error}
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}
