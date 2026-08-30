import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";

import BreakdownPage from "./pages/BreakdownPage";
import SplitPage from "./pages/SplitPage";
import { clearSession, loadSession, saveSession } from "./lib/storage";

const theme = createTheme({
  palette: { primary: { main: "#2e7d5b" } },
  shape: { borderRadius: 10 },
  components: {
    // Comfortable touch targets: this is used one-handed at a dinner table.
    MuiButton: { defaultProps: { disableElevation: true } },
  },
});

const EMPTY = {
  items: [],
  people: [],
  groups: [],
  assignments: {},
  receipt: null,
  chargeMode: "proportional",
};

export default function App() {
  // Restored synchronously so a refresh on /split never flashes an empty bill.
  const [state, setState] = useState(() => loadSession() || EMPTY);
  const [receiptImage, setReceiptImage] = useState(null);

  useEffect(() => {
    saveSession(state);
  }, [state]);

  // Blob URLs leak until revoked, and a long dinner can mean several uploads.
  useEffect(() => {
    return () => {
      if (receiptImage) URL.revokeObjectURL(receiptImage);
    };
  }, [receiptImage]);

  const setReceipt = useCallback((parsed, objectUrl) => {
    setReceiptImage((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return objectUrl;
    });
    setState({
      items: parsed.items,
      people: [],
      groups: [],
      assignments: {},
      chargeMode: "proportional",
      receipt: {
        currency: parsed.currency,
        subtotal: parsed.subtotal,
        total: parsed.total,
        discrepancy: parsed.discrepancy,
        provider: parsed.provider,
      },
    });
  }, []);

  const reset = useCallback(() => {
    setReceiptImage((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
    clearSession();
    setState(EMPTY);
  }, []);

  const actions = useMemo(
    () => ({
      setReceipt,
      reset,
      updateItem: (id, patch) =>
        setState((s) => ({
          ...s,
          items: s.items.map((item) =>
            item.id === id ? { ...item, ...patch } : item
          ),
        })),
      removeItem: (id) =>
        setState((s) => {
          const assignments = { ...s.assignments };
          delete assignments[id];
          return {
            ...s,
            items: s.items.filter((item) => item.id !== id),
            assignments,
          };
        }),
      // Returns the new id so the caller can open it for editing — a blank
      // line is useless until you type in it.
      addItem: () => {
        const id = `manual-${Date.now()}`;
        setState((s) => ({
          ...s,
          items: [
            ...s.items,
            { id, name: "", quantity: 1, lineTotal: 0, category: "item" },
          ],
        }));
        return id;
      },
      setChargeMode: (chargeMode) => setState((s) => ({ ...s, chargeMode })),
      setPeople: (updater) =>
        setState((s) => {
          const people = typeof updater === "function" ? updater(s.people) : updater;
          const ids = new Set(people.map((p) => p.id));
          // Dropping a person must not leave their items or groups dangling.
          const groups = s.groups
            .map((g) => ({ ...g, memberIds: g.memberIds.filter((id) => ids.has(id)) }))
            .filter((g) => g.memberIds.length > 1);
          const groupIds = new Set(groups.map((g) => g.id));
          const assignments = Object.fromEntries(
            Object.entries(s.assignments).filter(
              ([, target]) =>
                target === "everyone" || ids.has(target) || groupIds.has(target)
            )
          );
          return { ...s, people, groups, assignments };
        }),
      setGroups: (updater) =>
        setState((s) => {
          const groups = typeof updater === "function" ? updater(s.groups) : updater;
          const groupIds = new Set(groups.map((g) => g.id));
          const ids = new Set(s.people.map((p) => p.id));
          const assignments = Object.fromEntries(
            Object.entries(s.assignments).filter(
              ([, target]) =>
                target === "everyone" || ids.has(target) || groupIds.has(target)
            )
          );
          return { ...s, groups, assignments };
        }),
      assign: (itemId, targetId) =>
        setState((s) => {
          const assignments = { ...s.assignments };
          if (targetId === null) delete assignments[itemId];
          else assignments[itemId] = targetId;
          return { ...s, assignments };
        }),
      assignMany: (itemIds, targetId) =>
        setState((s) => {
          const assignments = { ...s.assignments };
          itemIds.forEach((id) => {
            if (targetId === null) delete assignments[id];
            else assignments[id] = targetId;
          });
          return { ...s, assignments };
        }),
    }),
    [setReceipt, reset]
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <BreakdownPage
                state={state}
                actions={actions}
                receiptImage={receiptImage}
              />
            }
          />
          <Route path="/split" element={<SplitPage state={state} actions={actions} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
