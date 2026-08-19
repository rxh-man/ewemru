import { HashRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import HRLogin from "./pages/HRLogin";
import Welcome from "./pages/Welcome";
import HRDashboard from "./pages/HRDashboard";
import Admin from "./pages/Admin";
import Surveyor from "./pages/Surveyor";
import FieldTech from "./pages/FieldTech";
import Innovation from "./pages/Innovation";
import UserAdmin from "./pages/UserAdmin";
import FieldRoutes from "./pages/FieldRoutes";
import RmaForms from "./pages/RmaForms";
import NotFound from "./pages/NotFound";
import { R } from "./lib/routes";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<NotFound />} />
        <Route path={R.signin} element={<HRLogin />} />
        <Route path={R.welcome} element={<Welcome />} />
        <Route path={R.hr} element={<HRDashboard />} />
        <Route path={R.mruLogin} element={<Login />} />
        <Route path={R.admin} element={<Admin />} />
        <Route path={R.surveyor} element={<Surveyor />} />
        <Route path={R.ft} element={<FieldTech />} />
        <Route path={R.innovation} element={<Innovation />} />
        <Route path={R.users} element={<UserAdmin />} />
        <Route path={R.routes} element={<FieldRoutes />} />
        <Route path={R.rma} element={<RmaForms />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </HashRouter>
  );
}
