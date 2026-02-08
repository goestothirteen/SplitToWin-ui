import { Box, Container, Button } from "@mui/material";
import { useState } from "react";
import Navbar from "../components/NavBar";
import ReceiptBreakdown from "../components/ReceiptBreakdown";
import PeoplePanel from "../components/PeoplePanel";
import { useNavigate } from "react-router-dom";

function BreakdownPage() {
    const navigate = useNavigate();
    const [receiptImage] = useState(
        "https://via.placeholder.com/300x400.png?text=Receipt+Image"
    );

    const [items] = useState([
        { id: "1", name: "Onigiri", price: 12 },
        { id: "2", name: "Green Tea", price: 1.5 },
        { id: "3", name: "Sushi", price: 33 },
        { id: "4", name: "Ramen", price: 20 },
        { id: "5", name: "Mochi", price: 5 },
    ]);

    const [people, setPeople] = useState([]);

    const proceedToSplit = () => {
        navigate("/split", {
            state: {
                items,
                people,
            },
        });
    };
    return (
        <>
            <Navbar />

            <Container maxWidth={false} sx={{ mt: 4 }}>
                <ReceiptBreakdown receiptImage={receiptImage} items={items} />

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
            </Container>
        </>
    );
}

export default BreakdownPage;
