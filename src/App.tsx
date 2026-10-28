import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Docs from "@/pages/Docs";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/docs" replace />} />
        <Route path="/docs/*" element={<Docs source="docs" />} />
        <Route path="/local/:directoryId/*" element={<Docs source="local" />} />
        <Route path="*" element={<Navigate to="/docs" replace />} />
      </Routes>
    </Router>
  );
}
