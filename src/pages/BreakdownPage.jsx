import { Box, Container, Button } from "@mui/material";
import { useState } from "react";
import Navbar from "../components/NavBar";
import ReceiptBreakdown from "../components/ReceiptBreakdown";
import PeoplePanel from "../components/PeoplePanel";
import { useNavigate, useLocation } from "react-router-dom";
import test1 from "../assets/test1.jpg";

function BreakdownPage({ items }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { receiptImage = null } = location.state || {};



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
