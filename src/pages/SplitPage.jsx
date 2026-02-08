import { useState, useEffect } from "react";
import { Container, Box, Typography } from "@mui/material";
import { DragDropContext, Droppable } from "@hello-pangea/dnd";
import Navbar from "../components/NavBar";
import PersonBox from "../components/PersonBox";
import AllBox from "../components/AllBox";
import { useLocation } from "react-router-dom";
import SplitItem from "../components/SplitItem";

function SplitPage() {
    const location = useLocation();
    const { items: initialItems = [], people: initialPeople = [] } = location.state || {};

    const [items, setItems] = useState(initialItems);
    const [people, setPeople] = useState(
        initialPeople.map((p) => ({ ...p, items: [] }))
    );
    const [allItems, setAllItems] = useState([]);
    const [totals, setTotals] = useState({});

    // Calculate totals per individual
    useEffect(() => {
        // Flatten all members for unique individuals
        const allMembers = Array.from(
            new Set(people.flatMap((p) => p.members))
        );

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
                            {people.map((p) => (
                                <PersonBox key={p.id} person={p} />
                            ))}
                            <AllBox allItems={allItems} />
                        </Box>
                    </Box>

                    {/* Bill Summary */}
                    <Box sx={{ mt: 4 }}>
                        <Typography variant="h6">Bill's Split</Typography>
                        {Object.entries(totals).map(([member, amount]) => (
                            <Typography key={member}>
                                {member}: ${amount.toFixed(2)}
                            </Typography>
                        ))}
                    </Box>
                </DragDropContext>
            </Container>
        </>
    );
}

export default SplitPage;
