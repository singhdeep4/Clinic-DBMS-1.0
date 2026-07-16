import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../lib/firebase";
import { getAllItems, putItem, deleteItem } from "../lib/db";
import { 
  User, Shield, LogOut, CheckCircle, AlertCircle, Trash2, Search, 
  UserPlus, Mail, Plus, Activity, Calendar, Phone, Sparkles
} from "lucide-react";
import SEO from "../components/SEO";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("doctors"); // "doctors" | "patients"
  const [loading, setLoading] = useState(true);

  // Lists
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);

  // Search/Filters
  const [patientSearch, setPatientSearch] = useState("");

  // Doctor Form States
  const [docEmail, setDocEmail] = useState("");
  const [docName, setDocName] = useState("");
  const [docStatusMsg, setDocStatusMsg] = useState({ type: "", text: "" });

  // Patient Form States
  const [patName, setPatName] = useState("");
  const [patMobile, setPatMobile] = useState("");
  const [patDob, setPatDob] = useState("");
  const [patGender, setPatGender] = useState("Male");
  const [patAge, setPatAge] = useState("");
  const [patStatusMsg, setPatStatusMsg] = useState({ type: "", text: "" });

  const loadData = async () => {
    setLoading(true);
    try {
      const docList = await getAllItems("doctors");
      const patList = await getAllItems("patients");
      setDoctors(docList);
      setPatients(patList);
    } catch (err) {
      console.error("Error loading admin dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkAdmin = () => {
      const isAdmin = localStorage.getItem("ayurkaya_admin_logged_in") === "true";
      if (!isAdmin) {
        navigate("/login");
        return;
      }
      loadData();
    };

    checkAdmin();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      localStorage.removeItem("ayurkaya_admin_logged_in");
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const handleAddDoctor = async (e) => {
    e.preventDefault();
    setDocStatusMsg({ type: "", text: "" });

    if (!docEmail.trim()) {
      setDocStatusMsg({ type: "error", text: "Please enter a doctor's email." });
      return;
    }

    const cleanEmail = docEmail.toLowerCase().trim();

    try {
      // Add to Firestore doctors collection
      await putItem("doctors", {
        id: cleanEmail,
        email: cleanEmail,
        name: docName.trim() || "Doctor Account",
        role: "doctor",
        createdAt: new Date().toISOString()
      });

      setDocStatusMsg({ type: "success", text: `Doctor ${cleanEmail} authorized successfully!` });
      setDocEmail("");
      setDocName("");
      // Refresh list
      const updatedDocs = await getAllItems("doctors");
      setDoctors(updatedDocs);
    } catch (err) {
      console.error("Failed to add doctor:", err);
      setDocStatusMsg({ type: "error", text: "Failed to authorize doctor. Please try again." });
    }
  };

  const handleRemoveDoctor = async (email) => {
    if (!window.confirm(`Are you sure you want to revoke authorization for ${email}?`)) {
      return;
    }

    try {
      await deleteItem("doctors", email);
      // Refresh list
      const updatedDocs = await getAllItems("doctors");
      setDoctors(updatedDocs);
    } catch (err) {
      console.error("Failed to delete doctor:", err);
      alert("Failed to delete doctor account.");
    }
  };

  const calculateAge = (dobString) => {
    if (!dobString) return "";
    const birthDate = new Date(dobString);
    if (isNaN(birthDate.getTime())) return "";
    const today = new Date();
    let calculatedAge = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      calculatedAge--;
    }
    return calculatedAge >= 0 ? calculatedAge.toString() : "";
  };

  const handleAddPatient = async (e) => {
    e.preventDefault();
    setPatStatusMsg({ type: "", text: "" });

    if (!patName.trim() || !patMobile.trim() || !patDob) {
      setPatStatusMsg({ type: "error", text: "Please fill in Name, Mobile, and Date of Birth." });
      return;
    }

    const cleanMobile = patMobile.replace(/[^0-9]/g, "");
    if (cleanMobile.length !== 10) {
      setPatStatusMsg({ type: "error", text: "Please enter a valid 10-digit mobile number." });
      return;
    }

    try {
      const { getNextPatientId } = await import("../lib/patientService.js");
      const nextId = await getNextPatientId();

      const newPatient = {
        patientId: nextId,
        name: patName.trim(),
        mobile: cleanMobile,
        dateOfBirth: patDob,
        gender: patGender,
        age: patAge.trim() || calculateAge(patDob) || "N/A",
        createdAt: new Date().toISOString()
      };

      await putItem("patients", newPatient);

      setPatStatusMsg({ type: "success", text: `Patient profile for ${patName} created successfully!` });
      setPatName("");
      setPatMobile("");
      setPatDob("");
      setPatGender("Male");
      setPatAge("");
      // Refresh list
      const updatedPats = await getAllItems("patients");
      setPatients(updatedPats);
    } catch (err) {
      console.error("Failed to add patient:", err);
      setPatStatusMsg({ type: "error", text: "Failed to create patient profile. Please try again." });
    }
  };

  const handleRemovePatient = async (patientId, patientName) => {
    if (!window.confirm(`Are you absolutely sure you want to permanently delete the profile card and visit history for ${patientName}? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteItem("patients", patientId);
      // Refresh list
      const updatedPats = await getAllItems("patients");
      setPatients(updatedPats);
    } catch (err) {
      console.error("Failed to delete patient:", err);
      alert("Failed to delete patient profile.");
    }
  };

  const filteredPatients = patients.filter((p) => {
    const query = patientSearch.toLowerCase().trim();
    if (!query) return true;
    return (
      (p.name && p.name.toLowerCase().includes(query)) ||
      (p.mobile && p.mobile.includes(query)) ||
      (p.patientId && p.patientId.toLowerCase().includes(query))
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-beige">
        <div className="animate-pulse flex items-center gap-3">
          <Activity size={24} className="text-brand-primary animate-spin" />
          <span className="text-brand-secondary font-semibold text-sm">
            Loading Admin Control Room...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-beige flex flex-col font-sans relative">
      <SEO title="Admin Control Room" description="Manage clinical doctor authorizations and patient accounts." />

      {/* Header Profile Section */}
      <div className="bg-gradient-to-br from-brand-primary via-brand-secondary to-brand-primary/95 text-brand-beige py-6 shadow-sm shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-brand-beige/10 border border-brand-beige/20 flex items-center justify-center text-2xl font-bold text-brand-beige shrink-0 font-serif">
              A
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-serif text-2xl font-bold">Admin Control Room</h1>
                <span className="bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-lg flex items-center gap-1">
                  <Shield size={10} /> System Administrator
                </span>
              </div>
              <p className="text-xs text-brand-light/80 mt-1 font-medium">
                Clinic Master Dashboard • Configure Authorized Accounts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-red-500/30 border border-white/15 text-brand-beige px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              <LogOut size={14} /> Log Out Admin
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row gap-6 min-h-0">
        
        {/* Left Side Tab Navigation */}
        <div className="w-full lg:w-64 shrink-0 flex flex-col gap-3">
          <button
            onClick={() => setActiveTab("doctors")}
            className={`flex items-center gap-3 px-5 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all text-left cursor-pointer ${
              activeTab === "doctors"
                ? "bg-brand-primary text-brand-beige shadow-sm"
                : "bg-white border border-brand-light/50 text-brand-primary hover:bg-brand-light/35"
            }`}
          >
            <Shield size={16} />
            <span>Doctor Registry</span>
          </button>

          <button
            onClick={() => setActiveTab("patients")}
            className={`flex items-center gap-3 px-5 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all text-left cursor-pointer ${
              activeTab === "patients"
                ? "bg-brand-primary text-brand-beige shadow-sm"
                : "bg-white border border-brand-light/50 text-brand-primary hover:bg-brand-light/35"
            }`}
          >
            <User size={16} />
            <span>Patient Accounts</span>
          </button>

          <div className="mt-4 p-5 bg-brand-cream/40 border border-brand-light/45 rounded-2xl space-y-3 hidden lg:block">
            <span className="text-[10px] font-bold text-brand-secondary uppercase tracking-widest block">System Diagnostics</span>
            <div className="text-[11px] text-brand-dark/65 space-y-1">
              <p>• Authorized Doctors: <strong>{doctors.length}</strong></p>
              <p>• Registered Patients: <strong>{patients.length}</strong></p>
            </div>
          </div>
        </div>

        {/* Right Side Content Panel */}
        <div className="flex-grow min-w-0">
          
          {/* TAB 1: DOCTORS REGISTRY */}
          {activeTab === "doctors" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              
              {/* Doctor Form Panel */}
              <div className="lg:col-span-1 bg-white border border-brand-light/50 rounded-3xl p-6 space-y-5 shadow-xs">
                <div className="border-b border-brand-light/20 pb-3">
                  <h3 className="font-serif font-bold text-base text-brand-primary">Authorize Doctor</h3>
                  <p className="text-[11px] text-brand-dark/60">Whitelist email addresses for logging in as a Doctor.</p>
                </div>

                {docStatusMsg.text && (
                  <div className={`p-3 rounded-xl flex items-center gap-2 text-xs font-semibold ${
                    docStatusMsg.type === "success" 
                      ? "bg-emerald-50 border border-emerald-100 text-emerald-700" 
                      : "bg-red-50 border border-red-100 text-red-700"
                  }`}>
                    {docStatusMsg.type === "success" ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
                    <span>{docStatusMsg.text}</span>
                  </div>
                )}

                <form onSubmit={handleAddDoctor} className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-brand-primary uppercase tracking-wider">Doctor Email</label>
                    <div className="relative">
                      <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-secondary/60" />
                      <input
                        type="email"
                        value={docEmail}
                        onChange={(e) => setDocEmail(e.target.value)}
                        placeholder="doctor@ayurkaya.com"
                        className="w-full bg-brand-cream/5 border border-brand-light/50 pl-10 pr-4 py-2.5 rounded-xl text-xs text-brand-dark focus:ring-2 focus:ring-brand-primary outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-brand-primary uppercase tracking-wider">Doctor Name / Title</label>
                    <div className="relative">
                      <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-secondary/60" />
                      <input
                        type="text"
                        value={docName}
                        onChange={(e) => setDocName(e.target.value)}
                        placeholder="Dr. Firstname Lastname"
                        className="w-full bg-brand-cream/5 border border-brand-light/50 pl-10 pr-4 py-2.5 rounded-xl text-xs text-brand-dark focus:ring-2 focus:ring-brand-primary outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-brand-primary text-brand-beige hover:bg-brand-secondary py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus size={14} /> Authorize Doctor Account
                  </button>
                </form>
              </div>

              {/* Doctor List Panel */}
              <div className="lg:col-span-2 bg-white border border-brand-light/50 rounded-3xl p-6 space-y-4 shadow-xs">
                <h3 className="font-serif font-bold text-base text-brand-primary border-b border-brand-light/20 pb-3 flex justify-between items-center">
                  <span>Authorized Doctors ({doctors.length})</span>
                </h3>

                {doctors.length === 0 ? (
                  <p className="text-xs text-brand-dark/50 italic py-10 text-center bg-brand-cream/5 rounded-2xl border border-dashed border-brand-light/50">
                    No doctor profiles found. Authorize a doctor above.
                  </p>
                ) : (
                  <div className="divide-y divide-brand-light/20 max-h-[500px] overflow-y-auto pr-1">
                    {doctors.map((doc) => (
                      <div key={doc.id || doc.email} className="py-3 flex justify-between items-center gap-4 hover:bg-brand-cream/10 px-2 rounded-xl transition-all">
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-brand-primary truncate">{doc.name || "Doctor"}</h4>
                          <p className="text-[10px] text-brand-dark/60 font-mono truncate">{doc.email}</p>
                        </div>
                        <button
                          onClick={() => handleRemoveDoctor(doc.id || doc.email)}
                          className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors border border-transparent hover:border-red-100 cursor-pointer shrink-0"
                          title="Revoke Authorization"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PATIENT ACCOUNTS */}
          {activeTab === "patients" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              
              {/* Patient Form Panel */}
              <div className="lg:col-span-1 bg-white border border-brand-light/50 rounded-3xl p-6 space-y-5 shadow-xs">
                <div className="border-b border-brand-light/20 pb-3">
                  <h3 className="font-serif font-bold text-base text-brand-primary">Create Patient Profile</h3>
                  <p className="text-[11px] text-brand-dark/60">Create a clinical profile card for a new patient manually.</p>
                </div>

                {patStatusMsg.text && (
                  <div className={`p-3 rounded-xl flex items-center gap-2 text-xs font-semibold ${
                    patStatusMsg.type === "success" 
                      ? "bg-emerald-50 border border-emerald-100 text-emerald-700" 
                      : "bg-red-50 border border-red-100 text-red-700"
                  }`}>
                    {patStatusMsg.type === "success" ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
                    <span>{patStatusMsg.text}</span>
                  </div>
                )}

                <form onSubmit={handleAddPatient} className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-brand-primary uppercase tracking-wider">Patient Full Name</label>
                    <div className="relative">
                      <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-secondary/60" />
                      <input
                        type="text"
                        value={patName}
                        onChange={(e) => setPatName(e.target.value)}
                        placeholder="Firstname Lastname"
                        className="w-full bg-brand-cream/5 border border-brand-light/50 pl-10 pr-4 py-2.5 rounded-xl text-xs text-brand-dark focus:ring-2 focus:ring-brand-primary outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-brand-primary uppercase tracking-wider">Gender</label>
                      <select
                        value={patGender}
                        onChange={(e) => setPatGender(e.target.value)}
                        className="w-full bg-brand-cream/5 border border-brand-light/50 px-3 py-2.5 rounded-xl text-xs text-brand-dark focus:ring-2 focus:ring-brand-primary outline-none"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-brand-primary uppercase tracking-wider">Age (Optional)</label>
                      <input
                        type="number"
                        value={patAge}
                        onChange={(e) => setPatAge(e.target.value)}
                        placeholder="Age"
                        className="w-full bg-brand-cream/5 border border-brand-light/50 px-3 py-2.5 rounded-xl text-xs text-brand-dark focus:ring-2 focus:ring-brand-primary outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-brand-primary uppercase tracking-wider">Mobile Number</label>
                    <div className="relative">
                      <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-secondary/60" />
                      <input
                        type="tel"
                        value={patMobile}
                        onChange={(e) => setPatMobile(e.target.value)}
                        placeholder="10-digit mobile"
                        className="w-full bg-brand-cream/5 border border-brand-light/50 pl-10 pr-4 py-2.5 rounded-xl text-xs text-brand-dark focus:ring-2 focus:ring-brand-primary outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-brand-primary uppercase tracking-wider">Date of Birth</label>
                    <div className="relative">
                      <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-secondary/60" />
                      <input
                        type="date"
                        value={patDob}
                        onChange={(e) => setPatDob(e.target.value)}
                        className="w-full bg-brand-cream/5 border border-brand-light/50 pl-10 pr-4 py-2.5 rounded-xl text-xs text-brand-dark focus:ring-2 focus:ring-brand-primary outline-none"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-brand-primary text-brand-beige hover:bg-brand-secondary py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <UserPlus size={14} /> Create Patient Profile
                  </button>
                </form>
              </div>

              {/* Patient List Panel */}
              <div className="lg:col-span-2 bg-white border border-brand-light/50 rounded-3xl p-6 space-y-4 shadow-xs">
                <div className="border-b border-brand-light/20 pb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <h3 className="font-serif font-bold text-base text-brand-primary">
                    Registered Patients ({filteredPatients.length})
                  </h3>
                  <div className="relative w-full sm:w-60">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-secondary/60" />
                    <input
                      type="text"
                      placeholder="Search name, mobile or ID..."
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                      className="w-full bg-brand-cream/5 border border-brand-light/50 pl-9 pr-4 py-1.5 rounded-xl text-xs text-brand-dark focus:ring-2 focus:ring-brand-primary outline-none"
                    />
                  </div>
                </div>

                {filteredPatients.length === 0 ? (
                  <p className="text-xs text-brand-dark/50 italic py-10 text-center bg-brand-cream/5 rounded-2xl border border-dashed border-brand-light/50">
                    No matching patient profiles found.
                  </p>
                ) : (
                  <div className="divide-y divide-brand-light/20 max-h-[500px] overflow-y-auto pr-1">
                    {filteredPatients.map((pat) => (
                      <div key={pat.id || pat.patientId} className="py-3 flex justify-between items-center gap-4 hover:bg-brand-cream/10 px-2 rounded-xl transition-all">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-brand-primary truncate">{pat.name}</h4>
                            <span className="text-[9px] bg-brand-light/40 text-brand-secondary px-1.5 py-0.5 rounded font-bold uppercase shrink-0">
                              {pat.patientId}
                            </span>
                          </div>
                          <p className="text-[10px] text-brand-dark/60 mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                            <span>Phone: <strong>{pat.mobile}</strong></span>
                            <span>•</span>
                            <span>DOB: {pat.dateOfBirth ? pat.dateOfBirth.split("-").reverse().join("-") : "N/A"}</span>
                            <span>•</span>
                            <span>Gender: {pat.gender}</span>
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemovePatient(pat.id || pat.patientId, pat.name)}
                          className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors border border-transparent hover:border-red-100 cursor-pointer shrink-0"
                          title="Delete Patient Card"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
