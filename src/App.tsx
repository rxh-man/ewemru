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
import TcChecklist from "./pages/TcChecklist";
import FuelPortal from "./pages/FuelPortal";
import GeoFix from "./pages/GeoFix";
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
        <Route path="/routes" element={<FieldRoutes />} />
        <Route path="/fvp-1n8s9y" element={<FieldRoutes />} />
        <Route path={R.fuel} element={<FuelPortal />} />
        <Route path={R.rma} element={<RmaForms />} />
        <Route path="/rma" element={<RmaForms />} />
        <Route path="/rmaforms" element={<RmaForms />} />
        <Route path={R.geofix} element={<GeoFix />} />
        <Route path="/GeoFix" element={<GeoFix />} />
        <Route path={R.tc} element={<TcChecklist />} />
        <Route path="/Inspect" element={<TcChecklist />} />
        <Route path="/tc-7h2m5q" element={<TcChecklist />} />
        <Route path="/tc" element={<TcChecklist />} />
        <Route path="/tc-checklist" element={<TcChecklist />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </HashRouter>
  );
}
