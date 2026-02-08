import { AppBar, Toolbar, Typography } from "@mui/material";

function Navbar() {
    return (
        <AppBar position="static" color="primary">
            <Toolbar>
                <Typography variant="h6" component="div">
                    Split-to-Win
                </Typography>
            </Toolbar>
        </AppBar>
    );
}

export default Navbar;
