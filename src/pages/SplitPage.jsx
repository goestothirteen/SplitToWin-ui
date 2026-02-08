import { useState, useEffect } from "react";
import { Container, Box, Typography } from "@mui/material";
import { DragDropContext } from "@hello-pangea/dnd";
import Navbar from "../components/NavBar";
import PersonBox from "../components/PersonBox";
import { Droppable } from "@hello-pangea/dnd";
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

    // Update totals
    useEffect(() => {
        const newTotals = {};
        people.forEach((p) => {
            let sum = 0;
            p.items.forEach((i) => (sum += i.price));
            newTotals[p.name] = sum;
        });

        const allSum = allItems.reduce((acc, i) => acc + i.price, 0);
        const split = people.length > 0 ? allSum / people.length : 0;
        people.forEach((p) => {
            newTotals[p.name] = (newTotals[p.name] || 0) + split;
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

        // Drag from person back to items or all
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
                        {people.map((p) => (
                            <Typography key={p.id}>
                                {p.name}: ${totals[p.name]?.toFixed(2) || 0}
                            </Typography>
                        ))}
                    </Box>
                </DragDropContext>
            </Container>
        </>
    );
}

export default SplitPage;
