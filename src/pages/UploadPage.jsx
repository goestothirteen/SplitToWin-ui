import { Button, Container, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";

function UploadPage({ setItems }) {
    const navigate = useNavigate();

    const handleUpload = () => {
        // Mock AI output
        const mockItems = [
            { id: "1", name: "Onigiri", price: 180 },
            { id: "2", name: "Green Tea", price: 120 },
            { id: "3", name: "Sushi", price: 300 },
        ];
        setItems(mockItems);

        // Go to split page
        navigate("/breakdown");
    };

    return (
        <Container maxWidth="sm" sx={{ mt: 4, textAlign: "center" }}>
            <Typography variant="h5" gutterBottom>
                Upload Receipt
            </Typography>

            {/* Replace this with actual file input later */}
            <Button variant="contained" onClick={handleUpload}>
                Mock Upload
            </Button>
        </Container>
    );
}

export default UploadPage;
