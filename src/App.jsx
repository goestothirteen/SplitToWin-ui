import { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import UploadPage from "./pages/UploadPage";
import BreakdownPage from "./pages/BreakdownPage";
import SplitPage from "./pages/Splitpage";

function App() {
  // Shared state: items and people
  const [items, setItems] = useState([]);
  const [people, setPeople] = useState([]);

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={<UploadPage setItems={setItems} />}
        />
        <Route
          path="/breakdown"
          element={
            <BreakdownPage
              items={items}
              setItems={setItems}
              people={people}
              setPeople={setPeople}
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
