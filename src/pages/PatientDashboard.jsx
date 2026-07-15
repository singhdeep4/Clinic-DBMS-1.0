import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../lib/firebase";
import { getPatientByUid, getPatientWithVisits } from "../lib/patientService";
import { 
  User, Calendar, Shield, LogOut, FileText, ClipboardList, CheckCircle, 
  AlertCircle, Activity, Heart, Clock, Printer, MapPin, Phone
} from "lucide-react";
import SEO from "../components/SEO";

export default function PatientDashboard() {
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [visits, setVisits] = useState([]);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [activeTab, setActiveTab] = useState("timeline"); // "timeline" | "profile" | "labs"
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const checkAuthAndLoad = async () => {
      // Check auth from local storage first for fast response
      const isLoggedIn = localStorage.getItem("ayurkaya_patient_logged_in") === "true";
      if (!isLoggedIn) {
        navigate("/login");
        return;
      }

      // Wait for Firebase Auth state to resolve
      auth.onAuthStateChanged(async (user) => {
        if (!user) {
          localStorage.removeItem("ayurkaya_patient_logged_in");
          localStorage.removeItem("ayurkaya_patient_uid");
          navigate("/login");
          return;
        }

        try {
          const patientData = await getPatientByUid(user.uid);
          if (!patientData) {
            setError("Could not find a patient profile linked to this account.");
            setLoading(false);
            return;
          }

          setPatient(patientData);

          const record = await getPatientWithVisits(patientData.patientId);
          if (record && record.visits) {
            setVisits(record.visits);
            if (record.visits.length > 0) {
              setSelectedVisit(record.visits[0]);
            }
          }
        } catch (err) {
          console.error("Error loading patient records:", err);
          setError("Failed to load your patient history.");
        } finally {
          setLoading(false);
        }
      });
    };

    checkAuthAndLoad();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      localStorage.removeItem("ayurkaya_patient_logged_in");
      localStorage.removeItem("ayurkaya_patient_uid");
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const handlePrintVisit = async (visit) => {
    if (!visit) return;
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-cream/10">
        <div className="animate-pulse flex items-center gap-3">
          <Activity size={24} className="text-brand-primary animate-spin" />
          <span className="text-brand-secondary font-semibold text-sm">
            Loading your health records...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-cream/10 p-4">
        <div className="bg-brand-cream border border-brand-light/70 rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-lg">
          <AlertCircle size={48} className="text-red-500 mx-auto" />
          <h2 className="font-serif text-2xl font-bold text-brand-primary">Authentication Issue</h2>
          <p className="text-sm text-brand-dark/75 leading-relaxed">{error}</p>
          <button
            onClick={handleLogout}
            className="w-full bg-brand-primary text-brand-beige py-3 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-brand-secondary transition-colors cursor-pointer"
          >
            Go Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-beige flex flex-col font-sans">
      <SEO title="My Health Portal" description="Access your patient visit history, prescriptions, and lab results." />

      {/* Header Profile Section */}
      <div className="bg-gradient-to-br from-brand-primary via-brand-secondary to-brand-primary/95 text-brand-beige py-6 shadow-sm shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-brand-beige/10 border border-brand-beige/20 flex items-center justify-center text-2xl font-bold text-brand-beige shrink-0 font-serif">
              {(patient?.name || "?")[0].toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif text-2xl font-bold">{patient?.name}</h1>
                <span className="text-[10px] font-mono font-bold bg-white/15 px-2 py-0.5 rounded shrink-0">
                  {patient?.patientId}
                </span>
              </div>
              <p className="text-xs text-brand-light/80 mt-1 font-medium">
                {patient?.gender} • {patient?.age} Yrs • DOB: {patient?.dateOfBirth ? patient.dateOfBirth.split("-").reverse().join("-") : "N/A"}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-red-500/30 border border-white/15 text-brand-beige px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row gap-6 min-h-0">
        
        {/* Left Side Tab Navigation */}
        <div className="w-full lg:w-64 shrink-0 flex flex-col gap-3">
          <button
            onClick={() => setActiveTab("timeline")}
            className={`flex items-center gap-3 px-5 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all text-left cursor-pointer ${
              activeTab === "timeline"
                ? "bg-brand-primary text-brand-beige shadow-sm"
                : "bg-white border border-brand-light/50 text-brand-primary hover:bg-brand-light/35"
            }`}
          >
            <ClipboardList size={16} />
            <span>Consultation Timeline</span>
          </button>

          <button
            onClick={() => setActiveTab("profile")}
            className={`flex items-center gap-3 px-5 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all text-left cursor-pointer ${
              activeTab === "profile"
                ? "bg-brand-primary text-brand-beige shadow-sm"
                : "bg-white border border-brand-light/50 text-brand-primary hover:bg-brand-light/35"
            }`}
          >
            <User size={16} />
            <span>Clinical Profile</span>
          </button>

          <button
            onClick={() => setActiveTab("labs")}
            className={`flex items-center gap-3 px-5 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all text-left cursor-pointer ${
              activeTab === "labs"
                ? "bg-brand-primary text-brand-beige shadow-sm"
                : "bg-white border border-brand-light/50 text-brand-primary hover:bg-brand-light/35"
            }`}
          >
            <Activity size={16} />
            <span>Lab Reports & Vitals</span>
          </button>

          <div className="mt-4 p-5 bg-brand-cream/40 border border-brand-light/45 rounded-2xl space-y-3 hidden lg:block">
            <span className="text-[10px] font-bold text-brand-secondary uppercase tracking-widest block">Secure Patient Space</span>
            <p className="text-[11px] text-brand-dark/65 leading-relaxed">
              Your medical history is fully encrypted and private. If you notice any discrepancy, please contact Dr. Neha's team.
            </p>
          </div>
        </div>

        {/* Right Side Content Panel */}
        <div className="flex-grow min-w-0">
          
          {/* TAB 1: CONSULTATION TIMELINE */}
          {activeTab === "timeline" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full items-start">
              
              {/* Visits List */}
              <div className="md:col-span-1 bg-white border border-brand-light/50 rounded-2xl p-4 space-y-3 max-h-[600px] overflow-y-auto">
                <h3 className="font-serif font-bold text-base text-brand-primary pb-2 border-b border-brand-light/20">
                  Visits Log ({visits.length})
                </h3>
                {visits.length === 0 ? (
                  <p className="text-xs text-brand-dark/50 italic py-6 text-center">No consultation records on file.</p>
                ) : (
                  <div className="space-y-2">
                    {visits.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVisit(v)}
                        className={`w-full p-4 rounded-xl border text-left transition-all ${
                          selectedVisit?.id === v.id
                            ? "bg-brand-primary/5 border-brand-primary/45 shadow-xs"
                            : "border-brand-light/35 hover:bg-brand-beige/20"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-brand-primary">
                            {new Date(v.visitDate).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric"
                            })}
                          </span>
                          <span className="text-[9px] font-bold uppercase text-brand-secondary bg-brand-light/20 px-2 py-0.5 rounded">
                            {v.status || "Completed"}
                          </span>
                        </div>
                        <p className="text-[11px] text-brand-dark/70 font-medium mt-1.5 truncate">
                          🩺 {v.chiefComplaints?.[0]?.text || v.surgicalHistory || "Routine Visit"}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Visit Detail Panel */}
              <div className="md:col-span-2 bg-white border border-brand-light/50 rounded-3xl p-6 md:p-8 space-y-6 print:p-0 print:border-none print:shadow-none shadow-sm min-h-[500px]">
                {selectedVisit ? (
                  <div className="space-y-6">
                    <div className="flex justify-between items-start border-b border-brand-light/45 pb-4 flex-wrap gap-3">
                      <div>
                        <span className="text-[10px] font-bold text-brand-secondary uppercase tracking-wider block">Consultation Case Sheet</span>
                        <h2 className="font-serif text-xl font-bold text-brand-primary">
                          Visit on {new Date(selectedVisit.visitDate).toLocaleDateString("en-IN", {
                            weekday: "long",
                            day: "2-digit",
                            month: "long",
                            year: "numeric"
                          })}
                        </h2>
                      </div>
                      <button
                        onClick={() => handlePrintVisit(selectedVisit)}
                        className="flex items-center gap-1.5 bg-brand-primary text-brand-beige hover:bg-brand-secondary px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer print:hidden"
                      >
                        <Printer size={14} /> Print Case / Rx
                      </button>
                    </div>

                    {/* Vitals Summary Card */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-brand-cream/20 border border-brand-light/35 p-4 rounded-2xl">
                      <div className="text-center">
                        <span className="text-[10px] text-brand-dark/50 font-bold uppercase block">Blood Pressure</span>
                        <span className="text-sm font-mono font-bold text-brand-primary">
                          {selectedVisit.vitals?.bloodPressure || "—"}
                        </span>
                      </div>
                      <div className="text-center">
                        <span className="text-[10px] text-brand-dark/50 font-bold uppercase block">Pulse Rate</span>
                        <span className="text-sm font-mono font-bold text-brand-primary">
                          {selectedVisit.vitals?.pulse || "—"} bpm
                        </span>
                      </div>
                      <div className="text-center">
                        <span className="text-[10px] text-brand-dark/50 font-bold uppercase block">Weight</span>
                        <span className="text-sm font-mono font-bold text-brand-primary">
                          {selectedVisit.vitals?.weight || "—"} kg
                        </span>
                      </div>
                      <div className="text-center">
                        <span className="text-[10px] text-brand-dark/50 font-bold uppercase block">Temperature</span>
                        <span className="text-sm font-mono font-bold text-brand-primary">
                          {selectedVisit.vitals?.temperature || "—"} °F
                        </span>
                      </div>
                    </div>

                    {/* Complaints */}
                    <div className="space-y-2">
                      <h4 className="font-serif font-bold text-sm text-brand-primary border-b border-brand-light/10 pb-1">Chief Complaints</h4>
                      <p className="text-xs text-brand-dark/80 leading-relaxed font-sans font-medium">
                        {selectedVisit.chiefComplaints?.map((comp, idx) => (
                          <span key={idx} className="block">• {comp.text} (Duration: {comp.duration || "N/A"})</span>
                        )) || "No primary complaints listed."}
                      </p>
                    </div>

                    {/* Diagnosis / Ayurvedic Analysis */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <h4 className="font-serif font-bold text-sm text-brand-primary border-b border-brand-light/10 pb-1">Diagnosis (Nidana)</h4>
                        <p className="text-xs text-brand-dark/85 leading-relaxed font-medium">
                          {selectedVisit.diagnosis || "No primary diagnosis reported."}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-serif font-bold text-sm text-brand-primary border-b border-brand-light/10 pb-1">Nadi Analysis</h4>
                        <p className="text-xs text-brand-dark/85 leading-relaxed font-mono">
                          Vata: {selectedVisit.nadiPariksha?.vata || "—"} | Pitta: {selectedVisit.nadiPariksha?.pitta || "—"} | Kapha: {selectedVisit.nadiPariksha?.kapha || "—"}
                        </p>
                      </div>
                    </div>

                    {/* Prescription (Rx) */}
                    <div className="space-y-3">
                      <h4 className="font-serif font-bold text-sm text-brand-primary border-b border-brand-light/15 pb-1 flex items-center gap-1.5">
                        <FileText size={16} /> Prescription Details (Rx)
                      </h4>
                      {selectedVisit.prescription && selectedVisit.prescription.length > 0 ? (
                        <div className="border border-brand-light/40 rounded-2xl overflow-hidden divide-y divide-brand-light/20">
                          {selectedVisit.prescription.map((item, idx) => (
                            <div key={idx} className="p-4 bg-brand-cream/5 flex justify-between items-start flex-wrap gap-2 text-xs">
                              <div>
                                <span className="font-bold text-brand-primary">{item.medicineName}</span>
                                <span className="text-[10px] bg-brand-light/35 px-2 py-0.5 rounded text-brand-secondary ml-2 font-bold uppercase tracking-wider">{item.type}</span>
                                <p className="text-[10px] text-brand-dark/60 mt-1">Dosage: {item.dosage} • Frequency: {item.frequency}</p>
                              </div>
                              {item.instructions && (
                                <div className="text-[10px] text-brand-secondary italic font-medium bg-brand-light/10 px-3 py-1.5 rounded-lg border border-brand-light/25">
                                  Note: {item.instructions}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-brand-dark/50 italic font-sans">No medicinal prescriptions issued for this visit.</p>
                      )}
                    </div>

                    {/* Doctor Advice / Diet Recommendations */}
                    {selectedVisit.dietAdvice && (
                      <div className="space-y-2 bg-brand-light/15 border border-brand-light/30 p-4.5 rounded-2xl">
                        <h4 className="font-serif font-bold text-xs text-brand-primary uppercase tracking-wider">Lifestyle & Pathya Advice</h4>
                        <p className="text-xs text-brand-dark/75 leading-relaxed font-sans whitespace-pre-wrap">{selectedVisit.dietAdvice}</p>
                      </div>
                    )}

                    {/* Next Follow Up */}
                    {selectedVisit.nextFollowUp && (
                      <div className="bg-amber-50/40 border border-amber-200/50 p-4 rounded-xl flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Clock className="text-amber-700" size={16} />
                          <span className="text-amber-900 font-semibold">Scheduled Follow-up Review Due:</span>
                        </div>
                        <span className="font-bold text-brand-primary text-sm font-mono">
                          {new Date(selectedVisit.nextFollowUp).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric"
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-20">
                    <ClipboardList size={40} className="text-brand-secondary/30 mx-auto mb-3" />
                    <p className="text-sm text-brand-secondary/60 font-semibold">Select a visit log from the sidebar to inspect records.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: CLINICAL PROFILE */}
          {activeTab === "profile" && (
            <div className="bg-white border border-brand-light/50 rounded-3xl p-6 md:p-8 space-y-8 shadow-sm">
              <div className="border-b border-brand-light/45 pb-4">
                <h2 className="font-serif text-xl font-bold text-brand-primary">My Clinical History Card</h2>
                <p className="text-xs text-brand-dark/65 font-sans mt-1">Information on file detailing chronic status, history, and active restrictions.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Past History */}
                <div className="bg-brand-cream/10 border border-brand-light/40 p-5 rounded-2xl space-y-3">
                  <h3 className="font-serif font-bold text-sm text-brand-primary border-b border-brand-light/20 pb-1">Past History & Medical Conditions</h3>
                  <div className="text-xs text-brand-dark/85 leading-relaxed space-y-1.5">
                    <p><strong>Hypertension:</strong> {patient?.pastHistory?.hypertension ? "Yes" : "No"}</p>
                    <p><strong>Diabetes:</strong> {patient?.pastHistory?.diabetes ? "Yes" : "No"}</p>
                    <p><strong>Thyroid:</strong> {patient?.pastHistory?.thyroid ? "Yes" : "No"}</p>
                    <p><strong>Asthma:</strong> {patient?.pastHistory?.asthma ? "Yes" : "No"}</p>
                    {patient?.pastHistory?.anyOther && <p><strong>Other Conditions:</strong> {patient.pastHistory.anyOther}</p>}
                  </div>
                </div>

                {/* Drug History & Allergies */}
                <div className="bg-brand-cream/10 border border-brand-light/40 p-5 rounded-2xl space-y-3">
                  <h3 className="font-serif font-bold text-sm text-brand-primary border-b border-brand-light/20 pb-1">Drug Allergies & Addictions</h3>
                  <div className="text-xs text-brand-dark/85 leading-relaxed space-y-2">
                    <div>
                      <strong>Allergies:</strong>
                      <p className="mt-1 text-red-700 bg-red-50/50 border border-red-100 rounded-lg p-2 font-medium">
                        {patient?.drugAllergy || "None recorded"}
                      </p>
                    </div>
                    <div>
                      <strong>Addictions / Habits:</strong>
                      <p className="mt-1 text-amber-900 bg-amber-50/50 border border-amber-100 rounded-lg p-2 font-medium">
                        {patient?.addiction || "None"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Family History */}
                <div className="bg-brand-cream/10 border border-brand-light/40 p-5 rounded-2xl space-y-3">
                  <h3 className="font-serif font-bold text-sm text-brand-primary border-b border-brand-light/20 pb-1">Family Medical History</h3>
                  <div className="text-xs text-brand-dark/85 leading-relaxed space-y-1.5">
                    <p><strong>Hypertension:</strong> {patient?.familyHistory?.hypertension ? "Yes" : "No"}</p>
                    <p><strong>Diabetes:</strong> {patient?.familyHistory?.diabetes ? "Yes" : "No"}</p>
                    <p><strong>Thyroid:</strong> {patient?.familyHistory?.thyroid ? "Yes" : "No"}</p>
                    <p><strong>Asthma:</strong> {patient?.familyHistory?.asthma ? "Yes" : "No"}</p>
                  </div>
                </div>

                {/* Surgical History & Others */}
                <div className="bg-brand-cream/10 border border-brand-light/40 p-5 rounded-2xl space-y-3">
                  <h3 className="font-serif font-bold text-sm text-brand-primary border-b border-brand-light/20 pb-1">Surgical / Hospitalization History</h3>
                  <p className="text-xs text-brand-dark/80 leading-relaxed font-sans whitespace-pre-wrap">
                    {patient?.surgicalHistory || "No historical surgical procedures recorded on file."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LAB REPORTS & VITALS */}
          {activeTab === "labs" && (
            <div className="bg-white border border-brand-light/50 rounded-3xl p-6 md:p-8 space-y-8 shadow-sm">
              <div className="border-b border-brand-light/45 pb-4">
                <h2 className="font-serif text-xl font-bold text-brand-primary">Lab Results & Clinical Chemistry</h2>
                <p className="text-xs text-brand-dark/65 font-sans mt-1">Vitals, metrics, and chemistry panels logged across all consultation periods.</p>
              </div>

              {visits.some(v => v.labInvestigations && Object.keys(v.labInvestigations).length > 0) ? (
                <div className="space-y-6">
                  {visits.filter(v => v.labInvestigations && Object.keys(v.labInvestigations).length > 0).map((v) => (
                    <div key={v.id} className="border border-brand-light/30 rounded-2xl overflow-hidden shadow-xs">
                      <div className="bg-brand-beige/40 px-5 py-3 border-b border-brand-light/35 flex justify-between items-center">
                        <span className="text-xs font-bold text-brand-primary">
                          Report Date: {new Date(v.visitDate).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric"
                          })}
                        </span>
                      </div>
                      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {Object.entries(v.labInvestigations).map(([key, val]) => (
                          <div key={key} className="bg-brand-cream/15 p-3.5 border border-brand-light/20 rounded-xl space-y-1">
                            <span className="text-[10px] text-brand-dark/50 font-bold uppercase tracking-wider block">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                            <span className="text-xs font-bold text-brand-secondary">{val || "—"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 bg-brand-cream/5 border border-brand-light/25 rounded-2xl">
                  <Activity size={32} className="text-brand-secondary/30 mx-auto mb-3 animate-pulse" />
                  <p className="text-sm text-brand-secondary/60 font-semibold">No lab chemistry or blood reports found on file.</p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
