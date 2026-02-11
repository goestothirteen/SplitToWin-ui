import { Box, Container, Button, CircularProgress, Typography } from "@mui/material";
import { useState } from "react";
import Tesseract from "tesseract.js";
import Navbar from "../components/NavBar";
import ReceiptBreakdown from "../components/ReceiptBreakdown";
import PeoplePanel from "../components/PeoplePanel";
import { useNavigate } from "react-router-dom";

function BreakdownPage({ items, setItems, people, setPeople, receiptImage, setReceiptImage }) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    const proceedToSplit = () => {
        navigate("/split", {
            state: {
                items,
                people,
                receiptImage,
            },
        });
    };

    const handleItemChange = (id, updates) => {
        setItems((prev) =>
            prev.map((item) => {
                if (item.id !== id) return item;
                const next = { ...item, ...updates };
                if (Object.prototype.hasOwnProperty.call(updates, "price")) {
                    const parsed = Number(next.price);
                    next.price = Number.isNaN(parsed) ? "" : parsed;
                }
                return next;
            })
        );
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setLoading(true);

        try {
            const {
                data: { text },
            } = await Tesseract.recognize(file, "eng", {
                logger: (m) => console.log(m),
            });

            const aiResponse = await callBackendOCR(text);

            const itemsWithIds = aiResponse.items.map((item, idx) => ({
                id: String(idx + 1),
                ...item,
            }));
            const receiptImageUrl = URL.createObjectURL(file);
            setItems(itemsWithIds);
            setReceiptImage(receiptImageUrl);
        } catch (err) {
            console.error("Upload flow failed", err);
            alert("Failed to process receipt. Try a clearer photo.");
        } finally {
            setLoading(false);
        }
    };

    async function callBackendOCR(text) {
        const apiBaseUrl =
            import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
        const response = await fetch(`${apiBaseUrl}/parse-receipt`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ ocrText: text }),
        });

        if (!response.ok) {
            throw new Error("Backend OCR processing failed");
        }

        return response.json();
    }

    return (
        <>
            <Navbar />

            <Container maxWidth={false} sx={{ mt: 4 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
                    <Button
                        variant="contained"
                        component="label"
                        disabled={loading}
                    >
                        Upload Receipt
                        <input
                            type="file"
                            hidden
                            accept="image/*"
                            onChange={handleFileUpload}
                        />
                    </Button>
                    {loading && (
                        <>
                            <CircularProgress size={20} />
                            <Typography variant="body2" color="text.secondary">
                                Reading receipt with AI...
                            </Typography>
                        </>
                    )}
                </Box>
                <Box
                    sx={{
                        display: "flex",
                        gap: { xs: 3, md: 3 },
                        alignItems: { xs: "stretch", md: "flex-start" },
                        flexDirection: { xs: "column", md: "row" },
                    }}
                >
                    <Box sx={{ flex: 2, minWidth: 0 }}>
                        <ReceiptBreakdown
                            receiptImage={receiptImage}
                            items={items}
                            onItemChange={handleItemChange}
                        />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0, width: { xs: "100%", md: "auto" } }}>
                        <PeoplePanel people={people} setPeople={setPeople} />
                        <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 4 }}>
                            <Button
                                variant="contained"
                                onClick={proceedToSplit}
                                disabled={people.length === 0}
                            >
                                Proceed to Split
                            </Button>
                        </Box>
                    </Box>
                </Box>
            </Container>
        </>
    );
}

export default BreakdownPage;
