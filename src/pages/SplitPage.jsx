import { useState, useEffect } from "react";
import {
    Container,
    Box,
    Typography,
    Button,
    Card,
    CardContent,
    Divider,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormGroup,
    FormControlLabel,
    Checkbox,
} from "@mui/material";
import { DragDropContext, Droppable } from "@hello-pangea/dnd";
import Navbar from "../components/NavBar";
import PersonBox from "../components/PersonBox";
import AllBox from "../components/AllBox";
import { useLocation } from "react-router-dom";
import SplitItem from "../components/SplitItem";

function SplitPage({ items: propItems = [], people: propPeople = [] }) {
    const location = useLocation();
    const { items: stateItems = [], people: statePeople = [] } = location.state || {};
    const initialItems = stateItems.length ? stateItems : propItems;
    const initialPeople = statePeople.length ? statePeople : propPeople;

    const [items, setItems] = useState(initialItems);
    const [people, setPeople] = useState(
        initialPeople.map((p) => ({ ...p, items: [] }))
    );
    const [allItems, setAllItems] = useState([]);
    const [totals, setTotals] = useState({});
    const [subgroupOpen, setSubgroupOpen] = useState(false);
    const [selectedMembers, setSelectedMembers] = useState([]);

    const allMembers = Array.from(
        new Set(people.flatMap((p) => p.members))
    );

    const memberDisplayName = (memberId) => {
        const individual = people.find(
            (p) => p.members.length === 1 && p.members[0] === memberId
        );
        return individual ? individual.name : memberId;
    };

    const toggleMember = (memberId) => {
        setSelectedMembers((prev) =>
            prev.includes(memberId)
                ? prev.filter((m) => m !== memberId)
                : [...prev, memberId]
        );
    };

    const addSubgroup = () => {
        if (selectedMembers.length < 2) return;

        const membersSorted = [...selectedMembers].sort();
        const id = `subgroup-${membersSorted.join("-")}`;

        const alreadyExists = people.some((p) => {
            if (p.members.length !== membersSorted.length) return false;
            const sorted = [...p.members].sort();
            return sorted.every((m, i) => m === membersSorted[i]);
        });

        if (alreadyExists) {
            setSubgroupOpen(false);
            setSelectedMembers([]);
            return;
        }

        const name = membersSorted.map(memberDisplayName).join(" & ");
        setPeople((prev) => [
            ...prev,
            { id, name, members: membersSorted, items: [] },
        ]);
        setSubgroupOpen(false);
        setSelectedMembers([]);
    };

    // Calculate totals per individual
    useEffect(() => {
        // Flatten all members for unique individuals

        const newTotals = {};
        allMembers.forEach((member) => {
            newTotals[member] = 0;
        });

        // Add items assigned to people/groups
        people.forEach((p) => {
            p.items.forEach((item) => {
                const splitAmount = item.price / p.members.length;
                p.members.forEach((member) => {
                    newTotals[member] += splitAmount;
                });
            });
        });

        // Add items in "All" bucket, split among unique individuals
        allItems.forEach((item) => {
            const splitAmount = item.price / allMembers.length;
            allMembers.forEach((member) => {
                newTotals[member] += splitAmount;
            });
        });

        setTotals(newTotals);
    }, [people, allItems]);

    const onDragEnd = (result) => {
        const { source, destination } = result;
        if (!destination) return;

        // Drag from items list
        if (source.droppableId === "items") {
            const draggedItem = items[source.index];
            if (destination.droppableId === "all") {
                setAllItems([...allItems, draggedItem]);
            } else {
                setPeople((prev) =>
                    prev.map((p) =>
                        p.id === destination.droppableId
                            ? { ...p, items: [...p.items, draggedItem] }
                            : p
                    )
                );
            }
            setItems(items.filter((i) => i.id !== draggedItem.id));
        }

        // Drag from All
        if (source.droppableId === "all") {
            const draggedItem = allItems[source.index];
            if (destination.droppableId === "items") {
                setItems([...items, draggedItem]);
            } else {
                setPeople((prev) =>
                    prev.map((p) =>
                        p.id === destination.droppableId
                            ? { ...p, items: [...p.items, draggedItem] }
                            : p
                    )
                );
            }
            setAllItems(allItems.filter((i) => i.id !== draggedItem.id));
        }

        // Drag from person/group back to items or All or another person/group
        people.forEach((p) => {
            if (source.droppableId === p.id) {
                const draggedItem = p.items[source.index];

                if (destination.droppableId === "items") {
                    setItems([...items, draggedItem]);
                } else if (destination.droppableId === "all") {
                    setAllItems([...allItems, draggedItem]);
                } else {
                    setPeople((prev) =>
                        prev.map((person) =>
                            person.id === destination.droppableId
                                ? { ...person, items: [...person.items, draggedItem] }
                                : person
                        )
                    );
                }

                // Remove from original person/group
                setPeople((prev) =>
                    prev.map((person) =>
                        person.id === p.id
                            ? { ...person, items: person.items.filter((i) => i.id !== draggedItem.id) }
                            : person
                    )
                );
            }
        });
    };

    return (
        <>
            <Navbar />
            <Container maxWidth={false} sx={{ mt: 4 }}>
                <DragDropContext onDragEnd={onDragEnd}>
                    <Box sx={{ display: "flex", gap: 4 }}>
                        {/* Items */}
                        <Box sx={{ flex: 1, minWidth: 200 }}>
                            <Typography variant="h6" gutterBottom>
                                Items
                            </Typography>
                            <Droppable droppableId="items">
                                {(provided) => (
                                    <Box ref={provided.innerRef} {...provided.droppableProps}>
                                        {items.map((item, index) => (
                                            <SplitItem key={item.id} item={item} index={index} />
                                        ))}
                                        {provided.placeholder}
                                    </Box>
                                )}
                            </Droppable>
                        </Box>

                        {/* People & All */}
                        <Box sx={{ flex: 1, minWidth: 200 }}>
                            <Typography variant="h6" gutterBottom>
                                People
                            </Typography>
                            <Button
                                variant="outlined"
                                size="small"
                                sx={{ mb: 2 }}
                                onClick={() => setSubgroupOpen(true)}
                            >
                                Add Subgroup
                            </Button>
                            {people.map((p) => (
                                <PersonBox key={p.id} person={p} />
                            ))}
                            <AllBox allItems={allItems} />
                        </Box>
                    </Box>

                    {/* Bill Summary */}
                    <Box sx={{ mt: 4 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
                            <Typography variant="h6">Bill's Split</Typography>
                            <Chip size="small" label={`${allMembers.length} people`} />
                        </Box>
                        <Divider sx={{ mb: 2 }} />
                        <Box
                            sx={{
                                display: "grid",
                                gap: 2,
                                gridTemplateColumns: {
                                    xs: "1fr",
                                    sm: "repeat(2, minmax(0, 1fr))",
                                    md: "repeat(3, minmax(0, 1fr))",
                                },
                            }}
                        >
                            {Object.entries(totals).map(([member, amount]) => (
                                <Card key={member} variant="outlined" sx={{ borderRadius: 2 }}>
                                    <CardContent>
                                        <Typography variant="subtitle2" color="text.secondary">
                                            {memberDisplayName(member)}
                                        </Typography>
                                        <Typography variant="h5" sx={{ mt: 0.5 }}>
                                            ${amount.toFixed(2)}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            ))}
                        </Box>
                    </Box>
                </DragDropContext>
            </Container>

            <Dialog open={subgroupOpen} onClose={() => setSubgroupOpen(false)}>
                <DialogTitle>Add Subgroup</DialogTitle>
                <DialogContent>
                    <FormGroup>
                        {allMembers.map((memberId) => (
                            <FormControlLabel
                                key={memberId}
                                control={
                                    <Checkbox
                                        checked={selectedMembers.includes(memberId)}
                                        onChange={() => toggleMember(memberId)}
                                    />
                                }
                                label={memberDisplayName(memberId)}
                            />
                        ))}
                    </FormGroup>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSubgroupOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={addSubgroup}
                        disabled={selectedMembers.length < 2}
                    >
                        Create
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}

export default SplitPage;
