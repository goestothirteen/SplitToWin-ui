import { Grid, Typography, Paper } from "@mui/material";

function ReceiptItemRow({ item }) {
    return (
        <Paper sx={{ p: 2, mb: 1 }}>
            <Grid container spacing={2}>
                <Grid item xs={8}>
                    <Typography>{item.name}</Typography>
                </Grid>
                <Grid item xs={4}>
                    <Typography align="right">${item.price}</Typography>
                </Grid>
            </Grid>
        </Paper>
    );
}

export default ReceiptItemRow;
