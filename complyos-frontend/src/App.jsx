import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { getToken, getRole } from "./utils/helpers";

// ── Pages ─────────────────────────────────────────────────────────────────────
import Landing from "./pages/Landing";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import CalendarPage from "./pages/Calendar";
import DocumentsPage from "./pages/Documents";
import SchemesPage from "./pages/Schemes";
import RegistrationPage from "./pages/Registration";
import CAConnectPage from "./pages/CAConnect";
import LoansPage from "./pages/Loans";
import NoticesPage from "./pages/Notices";
import ProfilePage from "./pages/Profile";
import AriaAkinator from "./pages/AriaAkinator";
import CADashboard from "./pages/ca/CADashboard";
import CAFraudShield from "./pages/ca/CAFraudShield";
import CAApprovalRequests from "./pages/ca/CAApprovalRequests";


// ── Auth guard ────────────────────────────────────────────────────────────────
function ProtectedRoute({ children, caOnly = false, noCA = false }) {
  const token = getToken();
  const role = getRole();
  if (!token) return <Navigate to="/" replace />;
  if (caOnly && role !== "ca") return <Navigate to="/dashboard" replace />;
  if (noCA && role === "ca") return <Navigate to="/ca-dashboard" replace />;
  return children;
}

export default function App() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>

        {/* ── Public ───────────────────────────────────────────────── */}
        <Route path="/" element={<Landing />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/aria" element={<AriaAkinator />} />

        {/* ── Business owner ───────────────────────────────────────── */}
        <Route path="/dashboard" element={<ProtectedRoute noCA><Dashboard /></ProtectedRoute>} />
        <Route path="/calendar" element={<ProtectedRoute noCA><CalendarPage /></ProtectedRoute>} />
        <Route path="/documents" element={<ProtectedRoute noCA><DocumentsPage /></ProtectedRoute>} />
        <Route path="/schemes" element={<ProtectedRoute noCA><SchemesPage /></ProtectedRoute>} />
        <Route path="/registration" element={<ProtectedRoute noCA><RegistrationPage /></ProtectedRoute>} />
        <Route path="/ca-connect" element={<ProtectedRoute noCA><CAConnectPage /></ProtectedRoute>} />
        <Route path="/loans" element={<ProtectedRoute noCA><LoansPage /></ProtectedRoute>} />
        <Route path="/notices" element={<ProtectedRoute noCA><NoticesPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/ca/approval-requests" element={<CAApprovalRequests />} />

        {/* ── CA — flat paths, both aliases work ───────────────────── */}
        <Route path="/ca-dashboard" element={<ProtectedRoute caOnly><CADashboard /></ProtectedRoute>} />
        <Route path="/ca/dashboard" element={<ProtectedRoute caOnly><CADashboard /></ProtectedRoute>} />
        <Route path="/ca-fraud-shield" element={<ProtectedRoute caOnly><CAFraudShield /></ProtectedRoute>} />
        <Route path="/ca/fraud-shield" element={<ProtectedRoute caOnly><CAFraudShield /></ProtectedRoute>} />

        {/* ── Fallback ─────────────────────────────────────────────── */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </AnimatePresence>
  );
}