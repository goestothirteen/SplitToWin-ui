import { Paper } from "@mui/material";
import { Draggable } from "@hello-pangea/dnd";

function SplitItem({ item, index }) {
    return (
        <Draggable draggableId={item.id} index={index}>
            {(provided) => (
                <Paper
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    sx={{ p: 1.5, mb: 1, cursor: "grab", backgroundColor: "#f5f5f5" }}
                >
                    {item.name} - ${item.price}
                </Paper>
            )}
        </Draggable>
    );
}

export default SplitItem;
