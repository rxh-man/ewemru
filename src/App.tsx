import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import HRLogin from "./pages/HRLogin";
import HRDashboard from "./pages/HRDashboard";
import Admin from "./pages/Admin";
import Surveyor from "./pages/Surveyor";
import FieldTech from "./pages/FieldTech";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HRLogin />} />
        <Route path="/hr-login" element={<Navigate to="/" replace />} />
        <Route path="/hr" element={<HRDashboard />} />
        <Route path="/mru-login" element={<Login />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/surveyor" element={<Surveyor />} />
        <Route path="/ft" element={<FieldTech />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
