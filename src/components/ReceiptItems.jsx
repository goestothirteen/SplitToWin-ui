import { Card, CardContent, Typography, Grid } from "@mui/material";

function ReceiptItems({ items }) {
    return (
        <Grid container spacing={2}>
            {items.map((item) => (
                <Grid item xs={12} key={item.id}>
                    <Card>
                        <CardContent>
                            <Typography variant="subtitle1" fontWeight="bold">
                                {item.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                ${item.price}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            ))}
        </Grid>
    );
}

export default ReceiptItems;