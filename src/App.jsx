import { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import BreakdownPage from "./pages/BreakdownPage";
import SplitPage from "./pages/Splitpage";

function App() {
  // Shared state: items and people
  const [items, setItems] = useState([]);
  const [people, setPeople] = useState([]);
  const [receiptImage, setReceiptImage] = useState(null);

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <BreakdownPage
              items={items}
              setItems={setItems}
              people={people}
              setPeople={setPeople}
              receiptImage={receiptImage}
              setReceiptImage={setReceiptImage}
            />
          }
        />
        <Route
          path="/split"
          element={
            <SplitPage
              items={items}
              people={people}
            />
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
