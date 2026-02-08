import { Button, Container, Typography, CircularProgress } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import Tesseract from "tesseract.js";

function UploadPage({ setItems }) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

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

            console.log("OCR TEXT:", text);

            const aiResponse = await callBackendOCR(text);

            console.log("AI RESPONSE:", aiResponse);



            const itemsWithIds = aiResponse.items.map((item, idx) => ({
                id: String(idx + 1),
                ...item,
            }));
            const receiptImageUrl = URL.createObjectURL(file);
            setItems(itemsWithIds);

            navigate("/breakdown", { state: { receiptImage: receiptImageUrl } });
        } catch (err) {
            console.error("Upload flow failed", err);
            alert("Failed to process receipt. Try a clearer photo.");
        } finally {
            setLoading(false);
        }
    };


    async function callBackendOCR(text) {
        const response = await fetch("http://localhost:5000/parse-receipt", {
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
        <Container maxWidth="sm" sx={{ mt: 6, textAlign: "center" }}>
            <Typography variant="h5" gutterBottom>
                Upload Receipt
            </Typography>

            <Button
                variant="contained"
                component="label"
                disabled={loading}
            >
                Upload Photo
                <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={handleFileUpload}
                />
            </Button>

            {loading && (
                <>
                    <CircularProgress sx={{ mt: 3 }} />
                    <Typography sx={{ mt: 2 }}>
                        Reading receipt with AI...
                    </Typography>
                </>
            )}
        </Container>
    );
}

export default UploadPage;
