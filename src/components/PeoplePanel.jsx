import { Box, Typography, TextField, Button, List, ListItem } from "@mui/material";
import { useState } from "react";

function PeoplePanel({ people, setPeople }) {
    const [name, setName] = useState("");

    const addPerson = () => {
        if (!name) return;
        setPeople([...people, { id: name.toLowerCase(), name }]);
        setName("");
    };

    const deletePerson = (id) => {
        setPeople(people.filter((p) => p.id !== id));
    };

    return (
        <Box sx={{ mt: 4 }}>
            <Typography variant="h6" gutterBottom>
                People
            </Typography>

            <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
                <TextField
                    size="small"
                    label="Add Person"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
                <Button variant="contained" onClick={addPerson}>
                    Add
                </Button>
            </Box>

            <List>
                {people.map((p) => (
                    <ListItem key={p.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {p.name}
                        <Button variant="outlined" color="error" size="small" onClick={() => deletePerson(p.id)}>
                            Delete
                        </Button>
                    </ListItem>
                ))}
            </List>
        </Box>
    );
}

export default PeoplePanel;
