import { Box, Typography, Paper } from "@mui/material";
import ReceiptItemRow from "./ReceiptItemRow";

function ReceiptBreakdown({ receiptImage, items, onItemChange }) {
    const total = items.reduce((sum, item) => sum + Number(item.price || 0), 0);

    return (
        <Box
            sx={{
                display: "flex",
                gap: 3,
                mt: 3,
                width: "100%",
                justifyContent: "space-between",
                flexDirection: { xs: "column", md: "row" },
            }}
        >
            <Paper sx={{ flex: 1, minWidth: 0, p: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                    Receipt Image
                </Typography>
                <Box
                    sx={{
                        width: "100%",
                        aspectRatio: "3 / 4",
                        borderRadius: 2,
                        overflow: "hidden",
                        boxShadow: "0 0 8px rgba(0,0,0,0.15)",
                        backgroundColor: "#f0f0f0",
                        border: "1px solid #e0e0e0",
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    {receiptImage ? (
                        <Box
                            component="img"
                            src={receiptImage}
                            alt="Receipt"
                            sx={{
                                width: "100%",
                                height: "100%",
                                objectFit: "contain",
                                display: "block",
                                transition: "transform 180ms ease",
                                transformOrigin: "center",
                                "&:hover": {
                                    transform: "scale(1.08)",
                                },
                            }}
                        />
                    ) : (
                        <Typography variant="body2" color="text.secondary">
                            No receipt uploaded yet
                        </Typography>
                    )}
                </Box>
                <Typography variant="caption" sx={{ display: "block", mt: 1, color: "text.secondary" }}>
                    Hover to zoom
                </Typography>
            </Paper>

            <Paper sx={{ flex: 1, minWidth: 0, p: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                    Items
                </Typography>
                {items.map((item) => (
                    <ReceiptItemRow
                        key={item.id}
                        item={item}
                        onChange={onItemChange}
                    />
                ))}
                <Paper
                    variant="outlined"
                    sx={{
                        p: 2,
                        mt: 2,
                        backgroundColor: "#fafafa",
                        borderColor: "#e0e0e0",
                    }}
                >
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography variant="subtitle1">Total</Typography>
                        <Typography variant="subtitle1">${total.toFixed(2)}</Typography>
                    </Box>
                </Paper>
            </Paper>
        </Box>
    );
}

export default ReceiptBreakdown;
