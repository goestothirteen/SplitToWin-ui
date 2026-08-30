import { Box, Button, Container, Stack } from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { useNavigate } from "react-router-dom";

import NavBar from "../components/NavBar";
import PeoplePanel from "../components/PeoplePanel";
import ReceiptPanel from "../components/ReceiptPanel";
import UploadPanel from "../components/UploadPanel";

export default function BreakdownPage({ state, actions, receiptImage }) {
  const navigate = useNavigate();
  const hasReceipt = state.items.length > 0;
  const ready = hasReceipt && state.people.length > 0;

  return (
    <>
      <NavBar showReset={hasReceipt} onReset={actions.reset} />

      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Stack spacing={2}>
          <UploadPanel onParsed={actions.setReceipt} hasReceipt={hasReceipt} />

          {/* One column on a phone, two on a wide screen. The old split
              screen had no breakpoints at all and overflowed at 375px. */}
          <Box
            sx={{
              display: "grid",
              gap: 2,
              alignItems: "start",
              gridTemplateColumns: { xs: "1fr", md: "minmax(0, 3fr) minmax(0, 2fr)" },
            }}
          >
            <ReceiptPanel
              receiptImage={receiptImage}
              items={state.items}
              receipt={state.receipt}
              actions={actions}
            />

            <Stack spacing={2}>
              <PeoplePanel people={state.people} setPeople={actions.setPeople} />

              <Button
                variant="contained"
                size="large"
                endIcon={<ArrowForwardIcon />}
                disabled={!ready}
                onClick={() => navigate("/split")}
              >
                {ready
                  ? "Split the bill"
                  : hasReceipt
                    ? "Add someone first"
                    : "Upload a receipt first"}
              </Button>
            </Stack>
          </Box>
        </Stack>
      </Container>
    </>
  );
}
