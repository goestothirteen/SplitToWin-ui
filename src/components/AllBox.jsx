import { Paper, Typography } from "@mui/material";
import { Droppable } from "@hello-pangea/dnd";
import SplitItem from "./SplitItem";

function AllBox({ allItems }) {
    return (
        <Droppable droppableId="all">
            {(provided) => (
                <Paper
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    sx={{ p: 2, minHeight: 80 }}
                >
                    <Typography variant="subtitle1">All</Typography>
                    {allItems.map((item, index) => (
                        <SplitItem key={item.id} item={item} index={index} />
                    ))}
                    {provided.placeholder}
                </Paper>
            )}
        </Droppable>
    );
}

export default AllBox;
