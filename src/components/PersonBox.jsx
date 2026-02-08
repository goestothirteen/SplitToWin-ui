import { Paper, Typography } from "@mui/material";
import { Droppable } from "@hello-pangea/dnd";
import SplitItem from "./SplitItem";

function PersonBox({ person }) {
    return (
        <Droppable droppableId={person.id}>
            {(provided) => (
                <Paper
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    sx={{ p: 2, mb: 2, minHeight: 80 }}
                >
                    <Typography variant="subtitle1">{person.name}</Typography>
                    {person.items.map((item, index) => (
                        <SplitItem key={item.id} item={item} index={index} />
                    ))}
                    {provided.placeholder}
                </Paper>
            )}
        </Droppable>
    );
}

export default PersonBox;
