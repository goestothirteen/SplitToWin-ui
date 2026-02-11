import { Box, Typography, TextField, Button, List, ListItem } from "@mui/material";
import { useState } from "react";

function PeoplePanel({ people, setPeople }) {
    const [input, setInput] = useState("");

    const addPersonOrGroup = () => {
        if (!input) return;

        // Split by comma for group
        const names = input.split(",").map((n) => n.trim()).filter(Boolean);
        if (names.length === 0) return;

        if (names.length === 1) {
            // Single person
            const id = names[0].toLowerCase();
            setPeople([...people, { id, name: names[0], members: [id] }]);
        } else {
            // Group
            const members = names.map((n) => n.toLowerCase());
            const id = "group-" + members.join("-");
            setPeople([...people, { id, name: names.join(" & "), members }]);
        }

        setInput("");
    };

    const deletePersonOrGroup = (id) => {
        setPeople(people.filter((p) => p.id !== id));
    };

    return (
        <Box sx={{ mt: 4 }}>
            <Typography variant="h6" gutterBottom>
                People / Groups
            </Typography>

            <Box
                sx={{
                    display: "flex",
                    gap: 2,
                    mb: 2,
                    flexDirection: { xs: "column", sm: "row" },
                    alignItems: { xs: "stretch", sm: "center" },
                }}
            >
                <TextField
                    fullWidth
                    size="small"
                    label="Add Person or Group (comma-separated)"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                />
                <Button variant="contained" onClick={addPersonOrGroup} sx={{ width: { xs: "100%", sm: "auto" } }}>
                    Add
                </Button>
            </Box>

            <List>
                {people.map((p) => (
                    <ListItem
                        key={p.id}
                        sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    >
                        {p.name}
                        <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            onClick={() => deletePersonOrGroup(p.id)}
                        >
                            Delete
                        </Button>
                    </ListItem>
                ))}
            </List>
        </Box>
    );
}

export default PeoplePanel;
