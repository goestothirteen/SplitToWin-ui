import { Box, Typography } from "@mui/material";
import ReceiptItemRow from "./ReceiptItemRow";

function ReceiptBreakdown({ receiptImage, items }) {
    return (
        <Box sx={{ display: "flex", gap: 4, mt: 3, justifyContent: "center" }}>
            {/* Receipt Image */}
            <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle1" gutterBottom>
                    Receipt Image
                </Typography>
                <img
                    src={receiptImage}
                    alt="Receipt"
                    style={{ width: "100%", borderRadius: 8, boxShadow: "0 0 5px rgba(0,0,0,0.2)" }}
                />
            </Box>

            {/* Item list */}
            <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle1" gutterBottom>
                    Items
                </Typography>
                {items.map((item) => (
                    <ReceiptItemRow key={item.id} item={item} />
                ))}
            </Box>
        </Box>
    );
}

export default ReceiptBreakdown;
