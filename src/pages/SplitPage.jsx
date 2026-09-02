import { useMemo } from "react";
import { Alert, Box, Button, Container, Stack } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Link, Navigate } from "react-router-dom";

import AssignBoard from "../components/AssignBoard";
import NavBar from "../components/NavBar";
import SummaryPanel from "../components/SummaryPanel";
import { computeSplit } from "../lib/split";

export default function SplitPage({ state, actions }) {
  const split = useMemo(
    () =>
      computeSplit({
        items: state.items,
        people: state.people,
        groups: state.groups,
        assignments: state.assignments,
        receiptTotal: state.receipt?.total ?? null,
        chargeMode: state.chargeMode,
      }),
    [
      state.items,
      state.people,
      state.groups,
      state.assignments,
      state.receipt,
      state.chargeMode,
    ]
  );

  // Reaching /split with nothing loaded used to render a permanently blank
  // page with no way back. State survives a refresh now, so this only fires
  // when there genuinely is no bill.
  if (state.items.length === 0) return <Navigate to="/" replace />;

  return (
    <>
      <NavBar showReset onReset={actions.reset} />

      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Stack spacing={2}>
          <Box>
            <Button component={Link} to="/" startIcon={<ArrowBackIcon />} size="small">
              Back to the receipt
            </Button>
          </Box>

          {state.people.length === 0 && (
            <Alert severity="info">
              Nobody added yet — go back and add the people splitting this bill.
            </Alert>
          )}

          <Box
            sx={{
              display: "grid",
              gap: 2,
              alignItems: "start",
              gridTemplateColumns: { xs: "1fr", md: "minmax(0, 3fr) minmax(0, 2fr)" },
            }}
          >
            <AssignBoard state={state} actions={actions} />
            {/* Sticky on desktop so the running total stays visible while
                assigning; a normal block on a phone. */}
            <Box sx={{ position: { md: "sticky" }, top: { md: 88 } }}>
              <SummaryPanel
                split={split}
                currency={state.receipt?.currency || ""}
                chargeMode={state.chargeMode}
                onChargeModeChange={actions.setChargeMode}
                people={state.people}
                payee={state.payee}
                onSavePayee={actions.setPayee}
                reference={state.reference}
                onReferenceChange={actions.setReference}
              />
            </Box>
          </Box>
        </Stack>
      </Container>
    </>
  );
}
