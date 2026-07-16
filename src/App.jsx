import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import DbmsDashboard from "./pages/DbmsDashboard";
import Login from "./pages/Login";
import PatientDashboard from "./pages/PatientDashboard";
import AdminDashboard from "./pages/AdminDashboard";

// Protected route for Doctors only
function DoctorRoute({ children }) {
  const isDoc = localStorage.getItem("ayurkaya_doctor_logged_in") === "true";
  return isDoc ? children : <Navigate to="/login" replace />;
}

// Protected route for Patients only
function PatientRoute({ children }) {
  const isPatient = localStorage.getItem("ayurkaya_patient_logged_in") === "true";
  return isPatient ? children : <Navigate to="/login" replace />;
}

// Protected route for Admins only
function AdminRoute({ children }) {
  const isAdmin = localStorage.getItem("ayurkaya_admin_logged_in") === "true";
  return isAdmin ? children : <Navigate to="/login" replace />;
}

// Component to scroll to top on route change
function ScrollToTop() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname, search]);
  return null;
}

export default function App() {
  return (
    <Router>
      <ScrollToTop />
      <div className="flex flex-col min-h-screen bg-brand-beige text-brand-dark font-sans selection:bg-brand-light selection:text-brand-primary">
        <div className="print:hidden global-nav-print-hidden">
          <Navbar />
        </div>
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/doctor" element={
              <DoctorRoute>
                <DbmsDashboard />
              </DoctorRoute>
            } />
            <Route path="/patient" element={
              <PatientRoute>
                <PatientDashboard />
              </PatientRoute>
            } />
            <Route path="/admin" element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            } />
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <div className="print:hidden global-nav-print-hidden">
          <Footer />
        </div>
      </div>
    </Router>
  );
}
