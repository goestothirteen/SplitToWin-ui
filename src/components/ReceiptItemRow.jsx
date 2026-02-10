import { Grid, TextField, Paper } from "@mui/material";

function ReceiptItemRow({ item, onChange }) {
    return (
        <Paper sx={{ p: 2, mb: 1 }}>
            <Grid container spacing={2}>
                <Grid item xs={8}>
                    <TextField
                        size="small"
                        fullWidth
                        label="Item"
                        value={item.name}
                        onChange={(e) => onChange(item.id, { name: e.target.value })}
                    />
                </Grid>
                <Grid item xs={4}>
                    <TextField
                        size="small"
                        fullWidth
                        label="Price"
                        type="number"
                        inputProps={{ step: "0.01", min: "0" }}
                        value={item.price}
                        onChange={(e) => onChange(item.id, { price: e.target.value })}
                    />
                </Grid>
            </Grid>
        </Paper>
    );
}

export default ReceiptItemRow;
