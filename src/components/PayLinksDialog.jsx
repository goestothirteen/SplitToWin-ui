import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

import { formatMoney } from "../lib/split";
import { PROXY_TYPES, validateProxy } from "../lib/paynow";
import { buildPayLinks, buildPayLinksText } from "../lib/paylinks";
import { loadRecentPayees, rememberPayee } from "../lib/payee";

const SOMEONE_ELSE = "";

/**
 * Turn a finished split into one link per person, ready for the group chat.
 *
 * The first field is "who paid", and it starts empty on every bill. That is a
 * deliberate bit of friction: the payee changes from dinner to dinner, and a
 * remembered default is indistinguishable from a chosen one right up until
 * the money lands in last week's payer's account. Previously-used numbers are
 * offered as chips to tap, which keeps the common case fast without letting
 * the app decide on its own where the money goes.
 */
export default function PayLinksDialog({
  open,
  onClose,
  people,
  perPerson,
  payee,
  onSavePayee,
  reference,
  onReferenceChange,
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [toast, setToast] = useState("");
  // Read once on mount rather than on every open: this component is the only
  // thing that writes the list, and it updates the state itself when it does.
  const [recents, setRecents] = useState(loadRecentPayees);

  const problem = useMemo(
    () =>
      payee.proxyValue ? validateProxy(payee.proxyType, payee.proxyValue) : "",
    [payee.proxyType, payee.proxyValue]
  );

  const ready = Boolean(payee.proxyValue) && !problem;

  const links = useMemo(() => {
    if (!ready) return [];
    return buildPayLinks({
      perPerson,
      payeePersonId: payee.personId,
      proxyType: payee.proxyType,
      proxyValue: payee.proxyValue,
      payeeName: payee.payeeName,
      reference,
      origin: window.location.origin,
    });
  }, [ready, perPerson, payee, reference]);

  const allText = useMemo(
    () => buildPayLinksText(links, { payeeName: payee.payeeName, reference }),
    [links, payee.payeeName, reference]
  );

  const patch = (next) => onSavePayee({ ...payee, ...next });

  // Picking a diner fills their name in as the payee too, but only as a
  // starting point — it stays editable, since the name on a bank account is
  // not always the name on the group chat.
  const choosePerson = (personId) => {
    const person = people.find((p) => p.id === personId);
    patch({ personId, payeeName: person ? person.name : payee.payeeName });
  };

  const copy = async (text, what) => {
    try {
      await navigator.clipboard.writeText(text);
      // Remembering only once links have actually been taken away keeps
      // half-typed numbers out of the suggestions.
      if (ready) setRecents(rememberPayee(payee));
      setToast(`${what} copied — paste it into the chat.`);
    } catch {
      setToast("Couldn't copy on this device.");
    }
  };

  const excluded = payee.personId
    ? people.find((p) => p.id === payee.personId)
    : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      fullScreen={fullScreen}
    >
      <DialogTitle sx={{ pb: 1 }}>Pay links</DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            One link each. They tap it, see their own amount, and get a PayNow
            QR to save and upload into their banking app.
          </Typography>

          <TextField
            select
            size="small"
            label="Who paid the bill?"
            value={payee.personId}
            onChange={(e) => choosePerson(e.target.value)}
            helperText="They won't get a link — they're the one being paid."
          >
            <MenuItem value={SOMEONE_ELSE}>Someone else</MenuItem>
            {people.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </TextField>

          {recents.length > 0 && (
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                sx={{ mb: 0.75 }}
              >
                Used before
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {recents.map((r) => (
                  <Chip
                    key={`${r.proxyType}:${r.proxyValue}`}
                    size="small"
                    label={r.payeeName ? `${r.payeeName} · ${r.proxyValue}` : r.proxyValue}
                    onClick={() =>
                      patch({
                        proxyType: r.proxyType,
                        proxyValue: r.proxyValue,
                        payeeName: r.payeeName || payee.payeeName,
                      })
                    }
                    variant={payee.proxyValue === r.proxyValue ? "filled" : "outlined"}
                    color={payee.proxyValue === r.proxyValue ? "primary" : "default"}
                  />
                ))}
              </Stack>
            </Box>
          )}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              select
              size="small"
              label="PayNow to"
              value={payee.proxyType}
              onChange={(e) => patch({ proxyType: e.target.value })}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value={PROXY_TYPES.MOBILE}>Mobile number</MenuItem>
              <MenuItem value={PROXY_TYPES.UEN}>UEN</MenuItem>
            </TextField>
            <TextField
              fullWidth
              size="small"
              label={
                payee.proxyType === PROXY_TYPES.MOBILE
                  ? "Their PayNow mobile"
                  : "Their UEN"
              }
              placeholder={
                payee.proxyType === PROXY_TYPES.MOBILE ? "9123 4567" : "202012345A"
              }
              value={payee.proxyValue}
              onChange={(e) => patch({ proxyValue: e.target.value })}
              error={Boolean(payee.proxyValue) && Boolean(problem)}
              helperText={payee.proxyValue ? problem || " " : " "}
              slotProps={{
                htmlInput: {
                  inputMode:
                    payee.proxyType === PROXY_TYPES.MOBILE ? "tel" : "text",
                },
              }}
            />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              fullWidth
              size="small"
              label="Name to show"
              placeholder="Who they're paying"
              value={payee.payeeName}
              onChange={(e) => patch({ payeeName: e.target.value })}
            />
            <TextField
              fullWidth
              size="small"
              label="Bill label (optional)"
              placeholder="Din Tai Fung"
              value={reference}
              onChange={(e) => onReferenceChange(e.target.value)}
            />
          </Stack>

          <Typography variant="caption" color="text.secondary">
            The number is never sent anywhere — it is written into the links
            themselves, which is what lets the pages work without an account.
            Anyone with a link can see it, so send them to the people who owe.
          </Typography>

          <Divider />

          {!ready ? (
            <Alert severity="info">
              Enter the payer's PayNow number to generate the links.
            </Alert>
          ) : links.length === 0 ? (
            <Alert severity="warning">
              Nobody owes anything yet — assign some items first.
            </Alert>
          ) : (
            <Stack spacing={1}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography variant="subtitle2" fontWeight={600}>
                  {links.length} link{links.length === 1 ? "" : "s"}
                </Typography>
                {excluded && (
                  <Typography variant="caption" color="text.secondary">
                    {excluded.name} excluded — they paid
                  </Typography>
                )}
              </Stack>

              {links.map((l) => (
                <Paper key={l.id} variant="outlined" sx={{ p: 1, pl: 1.5 }}>
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    justifyContent="space-between"
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600}>
                        {l.name} — {formatMoney(l.amountCents)}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {l.url}
                      </Typography>
                    </Box>
                    <Tooltip title={`Copy ${l.name}'s link`}>
                      <IconButton
                        size="small"
                        aria-label={`Copy ${l.name}'s link`}
                        onClick={() => copy(l.url, `${l.name}'s link`)}
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Paper>
              ))}

              <Button
                variant="contained"
                startIcon={<ContentCopyIcon />}
                onClick={() => copy(allText, "All links")}
                sx={{ mt: 1 }}
              >
                Copy all
              </Button>
            </Stack>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={3000}
        onClose={() => setToast("")}
        message={toast}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Dialog>
  );
}
