import { AppBar, Box, Button, Toolbar, Typography } from "@mui/material";
import { Link } from "react-router-dom";

/** Always offers a way home — the old navbar was a dead end on /split. */
export default function NavBar({ onReset, showReset = false }) {
  return (
    <AppBar position="sticky" color="primary" elevation={0}>
      <Toolbar sx={{ gap: 1 }}>
        <Typography
          variant="h6"
          component={Link}
          to="/"
          sx={{ color: "inherit", textDecoration: "none", fontWeight: 700 }}
        >
          Split&#8209;to&#8209;Win
        </Typography>
        <Box sx={{ flex: 1 }} />
        {showReset && (
          <Button color="inherit" size="small" onClick={onReset}>
            Start over
          </Button>
        )}
      </Toolbar>
    </AppBar>
  );
}
