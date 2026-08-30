import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import CallSplitIcon from "@mui/icons-material/CallSplit";

import { EVERYONE_ID, buildTargets, formatMoney, isFood, toCents } from "../lib/split";

/**
 * Assign each line to whoever ate it.
 *
 * This replaces the old drag-and-drop board. Dragging was the source of the
 * worst bug in the app — dropping an item back into the same box removed it
 * from the bill entirely, so the money quietly vanished — and on a phone it
 * needed a long-press that fought with page scrolling, which is exactly the
 * situation this gets used in. Tapping works the same on both, and there is
 * no reducer left to get wrong.
 */
export default function AssignBoard({ state, actions }) {
  const { items, people, groups, assignments } = state;
  const [menu, setMenu] = useState(null); // { anchorEl, itemIds }
  const [groupMode, setGroupMode] = useState(false);
  const [groupPick, setGroupPick] = useState([]);

  const targets = useMemo(() => buildTargets(people, groups), [people, groups]);
  const food = useMemo(() => items.filter(isFood), [items]);
  const unassigned = food.filter((i) => !assignments[i.id]);

  // Only a single multi-quantity line can be split; "assign all" cannot.
  const splittable =
    menu && menu.itemIds.length === 1
      ? food.find((i) => i.id === menu.itemIds[0] && i.quantity > 1)
      : null;

  const openMenu = (event, itemIds) =>
    setMenu({ anchorEl: event.currentTarget, itemIds });
  const closeMenu = () => setMenu(null);

  const choose = (targetId) => {
    if (menu) actions.assignMany(menu.itemIds, targetId);
    closeMenu();
  };

  const toggleGroupPick = (id) =>
    setGroupPick((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );

  const createGroup = () => {
    if (groupPick.length < 2) return;
    const memberIds = [...groupPick].sort();
    const id = `g-${memberIds.join("-")}`;
    const name = memberIds
      .map((mid) => people.find((p) => p.id === mid)?.name || "?")
      .join(" & ");
    actions.setGroups((current) =>
      current.some((g) => g.id === id) ? current : [...current, { id, name, memberIds }]
    );
    setGroupPick([]);
    setGroupMode(false);
  };

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 1 }}
        >
          <Typography variant="subtitle1" fontWeight={600}>
            Not assigned yet
          </Typography>
          {unassigned.length > 1 && (
            <Button
              size="small"
              onClick={(e) => openMenu(e, unassigned.map((i) => i.id))}
            >
              Assign all
            </Button>
          )}
        </Stack>

        {unassigned.length === 0 ? (
          <Alert severity="success" variant="outlined">
            Every line is assigned.
          </Alert>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Tap a line to say who had it.
            </Typography>
            <Stack direction="row" gap={1} flexWrap="wrap">
              {unassigned.map((item) => (
                <ItemChip
                  key={item.id}
                  item={item}
                  onClick={(e) => openMenu(e, [item.id])}
                />
              ))}
            </Stack>
          </>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 1.5 }}
        >
          <Typography variant="subtitle1" fontWeight={600}>
            Who had what
          </Typography>
          <Button
            size="small"
            startIcon={<GroupAddIcon />}
            onClick={() => setGroupMode((v) => !v)}
            disabled={people.length < 2}
          >
            {groupMode ? "Cancel" : "Shared by some"}
          </Button>
        </Stack>

        {/* A subgroup for the two people who split the wine, without making
            everyone else pay for it. */}
        {groupMode && (
          <Box sx={{ mb: 2, p: 1.5, bgcolor: "action.hover", borderRadius: 1 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Pick everyone who shared it:
            </Typography>
            <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mb: 1.5 }}>
              {people.map((p) => (
                <Chip
                  key={p.id}
                  label={p.name}
                  color={groupPick.includes(p.id) ? "primary" : "default"}
                  variant={groupPick.includes(p.id) ? "filled" : "outlined"}
                  onClick={() => toggleGroupPick(p.id)}
                />
              ))}
            </Stack>
            <Button
              size="small"
              variant="contained"
              onClick={createGroup}
              disabled={groupPick.length < 2}
            >
              Create
            </Button>
          </Box>
        )}

        <Stack spacing={1.5}>
          {targets.map((target) => {
            const mine = food.filter((i) => assignments[i.id] === target.id);
            const cents = mine.reduce((s, i) => s + toCents(i.lineTotal), 0);
            return (
              <Box key={target.id}>
                <Stack
                  direction="row"
                  alignItems="baseline"
                  justifyContent="space-between"
                  sx={{ mb: 0.5 }}
                >
                  <Typography variant="subtitle2" fontWeight={700}>
                    {target.name}
                    {target.kind !== "person" && (
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.secondary"
                        sx={{ ml: 0.75 }}
                      >
                        split {target.memberIds.length} ways
                      </Typography>
                    )}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatMoney(cents)}
                  </Typography>
                </Stack>
                {mine.length === 0 ? (
                  <Typography variant="caption" color="text.disabled">
                    nothing yet
                  </Typography>
                ) : (
                  <Stack direction="row" gap={1} flexWrap="wrap">
                    {mine.map((item) => (
                      <ItemChip
                        key={item.id}
                        item={item}
                        onClick={(e) => openMenu(e, [item.id])}
                        onDelete={() => actions.assign(item.id, null)}
                      />
                    ))}
                  </Stack>
                )}
                {target.id !== targets[targets.length - 1].id && (
                  <Divider sx={{ mt: 1.5 }} />
                )}
              </Box>
            );
          })}
        </Stack>
      </Paper>

      <Menu anchorEl={menu?.anchorEl} open={Boolean(menu)} onClose={closeMenu}>
        {/* Offered first because for a line like "3x Egg fried rice" it is
            usually what you want: three separate dishes for three people,
            rather than one shared thing needing a throwaway subgroup. */}
        {splittable && [
          <MenuItem
            key="split"
            onClick={() => {
              actions.splitItemByQuantity(splittable.id);
              closeMenu();
            }}
          >
            <ListItemIcon>
              <CallSplitIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={`Split into ${splittable.quantity} separate items`}
              secondary="Assign each one to a different person"
            />
          </MenuItem>,
          <Divider key="split-div" />,
        ]}
        {targets.map((t) => (
          <MenuItem key={t.id} onClick={() => choose(t.id)}>
            <ListItemText
              primary={t.name}
              secondary={
                t.kind === "everyone"
                  ? `split ${t.memberIds.length} ways`
                  : t.kind === "group"
                    ? `split ${t.memberIds.length} ways`
                    : null
              }
            />
          </MenuItem>
        ))}
        {menu && menu.itemIds.some((id) => assignments[id]) && [
          <Divider key="d" />,
          <MenuItem key="clear" onClick={() => choose(null)}>
            Unassign
          </MenuItem>,
        ]}
      </Menu>
    </Stack>
  );
}

function ItemChip({ item, onClick, onDelete }) {
  const qty = item.quantity > 1 ? `${item.quantity}x ` : "";
  return (
    <Chip
      onClick={onClick}
      onDelete={onDelete}
      variant="outlined"
      sx={{ height: "auto", py: 0.75, "& .MuiChip-label": { whiteSpace: "normal" } }}
      label={
        <Box sx={{ textAlign: "left" }}>
          <Typography variant="body2" component="div">
            {qty}
            {item.name || "Unnamed"}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatMoney(toCents(item.lineTotal))}
          </Typography>
        </Box>
      }
    />
  );
}

export { EVERYONE_ID };
