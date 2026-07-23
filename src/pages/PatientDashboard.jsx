import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../lib/firebase";
import { getPatientsByUid, getPatientWithVisits, linkFamilyMemberToUid, linkPatientByFamilyCode, getRotatingHash } from "../lib/patientService";
import { getAllItems, putItem } from "../lib/db";
import { 
  User, Calendar, Shield, LogOut, FileText, ClipboardList, CheckCircle, 
  AlertCircle, Activity, Heart, Clock, Printer, MapPin, Phone, UserPlus, X, ChevronDown, Sparkles,
  Mail, MessageCircle, Send, ArrowLeft
} from "lucide-react";
import SEO from "../components/SEO";
import { 
  subscribeToPatientChat, sendChatMessage, getPrescriptionHistory, markChatReadByPatient 
} from "../lib/chatService";

const clinics = [
  {
    id: "aayushree",
    name: "Aayushree Ayurved Polyclinic and Panchakarma Center",
    address: `Shop No. 1 and 2, Shreeyash Building,\nBehind Link View Hotel,\nPandit Malharrao Kulkarni Road,\nBorivali (West), Mumbai – 400092, Maharashtra`,
    days: "Monday • Wednesday • Friday",
    times: ["19:00", "19:30", "20:00", "20:30"],
    contact: "+91 7021272264"
  },
  {
    id: "aaroyam",
    name: "Aaroyam Panchakarma Centre",
    address: `Shop No. 1, Charkop Vidyut CHS,\nPlot No. 234, Sector 5,\nCharkop, Kandivali (West),\nMumbai – 400067, Maharashtra`,
    days: "Tuesday • Thursday",
    times: ["19:00", "19:30", "20:00", "20:30"],
    contact: "+91 9326973764 | +91 9152569247"
  },
  {
    id: "dubal",
    name: "Dubal's Clinic",
    address: `Plot No. 329, D-42, Ravi Park Co-operative Housing Society,\nNear Sector 3, Charkop,\nR.S.C. Road No. 32, Kandivali (West),\nMumbai – 400067, Maharashtra`,
    days: "Saturday",
    times: ["19:00", "19:30", "20:00", "20:30"],
    contact: "+91 7999253864"
  }
];

export default function PatientDashboard() {
  const navigate = useNavigate();
  const [patientsList, setPatientsList] = useState([]);
  const [patient, setPatient] = useState(null);
  const [visits, setVisits] = useState([]);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [activeTab, setActiveTab] = useState("timeline"); // "timeline" | "profile" | "labs" | "booking"
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Booking states
  const [bookingReason, setBookingReason] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [bookingStatus, setBookingStatus] = useState(""); // "" | "Booking..." | "success" | error string

  // Add Family Member Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalName, setModalName] = useState("");
  const [modalMobile, setModalMobile] = useState("");
  const [modalDob, setModalDob] = useState("");
  const [modalGender, setModalGender] = useState("Male");
  const [modalRelation, setModalRelation] = useState("Child"); // "Spouse" | "Child" | "Parent" | "Other"
  const [modalError, setModalError] = useState("");
  const [modalSuccess, setModalSuccess] = useState("");
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);

  // Link by Code States
  const [modalTab, setModalTab] = useState("register"); // "register" | "linkcode"
  const [modalLinkCode, setModalLinkCode] = useState("");
  
  // Rotating Code States
  const [rotatingCode, setRotatingCode] = useState("");
  const [countdown, setCountdown] = useState(30);

  // Edit Profile States
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editMobile, setEditMobile] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [contactError, setContactError] = useState("");
  const [contactSuccess, setContactSuccess] = useState("");
  const [contactSubmitting, setContactSubmitting] = useState(false);

  // Chat & Prescription History States
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedDoctorName, setSelectedDoctorName] = useState("Dr. Neha");
  const [availableDoctors, setAvailableDoctors] = useState([
    { id: "dr_neha", name: "Dr. Neha", specialization: "Ayurveda & Panchakarma Specialist" },
    { id: "dr_dubal", name: "Dr. Dubal", specialization: "Ayurvedic Physician" },
    { id: "dr_aayushree", name: "Dr. Aayushree", specialization: "Chief Ayurvedic Consultant" }
  ]);
  const [patientChatMessages, setPatientChatMessages] = useState([]);
  const [patientChatInput, setPatientChatInput] = useState("");
  const [prescriptionHistory, setPrescriptionHistory] = useState([]);
  const [rxSearchTerm, setRxSearchTerm] = useState("");
  const [rxLoading, setRxLoading] = useState(false);
  const patientChatBottomRef = useRef(null);

  // Fetch registered doctors from Firestore database
  useEffect(() => {
    async function loadClinicDoctors() {
      try {
        const docs = await getAllItems("doctors");
        if (docs && docs.length > 0) {
          const formatted = docs.map(d => ({
            id: d.id || d.email,
            name: d.name ? (d.name.toLowerCase().startsWith("dr") ? d.name : `Dr. ${d.name}`) : "Doctor",
            specialization: d.specialization || "Ayurvedic Specialist"
          }));
          setAvailableDoctors(prev => {
            const map = new Map();
            [...prev, ...formatted].forEach(item => map.set(item.name, item));
            return Array.from(map.values());
          });
        }
      } catch (err) {
        console.error("Error fetching doctors:", err);
      }
    }
    loadClinicDoctors();
  }, []);

  // Subscribe to patient chat messages
  useEffect(() => {
    if (!patient?.patientId || (!showChatModal && activeTab !== "chat")) return;
    markChatReadByPatient(patient.patientId);
    const unsub = subscribeToPatientChat(patient.patientId, (msgs) => {
      setPatientChatMessages(msgs);
      // Dynamically add any doctor who messaged the patient
      msgs.forEach(m => {
        if (m.senderRole === "doctor" && m.senderName) {
          setAvailableDoctors(prev => {
            if (!prev.some(d => d.name === m.senderName)) {
              return [...prev, { id: m.senderName, name: m.senderName, specialization: "Consulting Doctor" }];
            }
            return prev;
          });
        }
      });
    });
    return () => unsub();
  }, [patient?.patientId, showChatModal, activeTab]);

  useEffect(() => {
    if ((showChatModal || activeTab === "chat") && patientChatBottomRef.current) {
      patientChatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [patientChatMessages, showChatModal, activeTab]);

  // Load prescription history
  useEffect(() => {
    if (activeTab !== "prescriptions") return;
    async function loadRxHistory() {
      setRxLoading(true);
      try {
        const ids = patientsList.map(p => p.patientId);
        if (ids.length > 0) {
          const list = await getPrescriptionHistory(ids);
          setPrescriptionHistory(list);
        }
      } catch (err) {
        console.error("Error loading prescription history:", err);
      } finally {
        setRxLoading(false);
      }
    }
    loadRxHistory();
  }, [activeTab, patientsList]);

  const loadAllLinkedPatients = async (uid, selectId = null) => {
    try {
      const list = await getPatientsByUid(uid, auth.currentUser?.email);
      setPatientsList(list);
      
      if (list.length > 0) {
        let active = list[0];
        if (selectId) {
          const found = list.find(p => p.patientId === selectId);
          if (found) active = found;
        }
        setPatient(active);
        await loadPatientVisits(active.patientId);
      } else {
        setError("Could not find any patient profiles linked to this account.");
      }
    } catch (err) {
      console.error("Error loading linked profiles:", err);
      setError("Failed to load your patient profile.");
    }
  };

  const loadPatientVisits = async (patientId) => {
    try {
      const record = await getPatientWithVisits(patientId);
      if (record && record.visits) {
        setVisits(record.visits);
        if (record.visits.length > 0) {
          setSelectedVisit(record.visits[0]);
        } else {
          setSelectedVisit(null);
        }
      } else {
        setVisits([]);
        setSelectedVisit(null);
      }
    } catch (err) {
      console.error("Error loading patient visits:", err);
    }
  };

  useEffect(() => {
    const checkAuthAndLoad = async () => {
      const isLoggedIn = localStorage.getItem("ayurkaya_patient_logged_in") === "true";
      if (!isLoggedIn) {
        navigate("/login");
        return;
      }

      auth.onAuthStateChanged(async (user) => {
        if (!user) {
          localStorage.removeItem("ayurkaya_patient_logged_in");
          localStorage.removeItem("ayurkaya_patient_uid");
          navigate("/login");
          return;
        }

        try {
          await loadAllLinkedPatients(user.uid);
        } catch (err) {
          console.error("Initial load error:", err);
          setError("Failed to load records.");
        } finally {
          setLoading(false);
        }
      });
    };

    checkAuthAndLoad();
  }, [navigate]);

  const handleProfileSwitch = async (p) => {
    setPatient(p);
    setIsSwitcherOpen(false);
    setLoading(true);
    await loadPatientVisits(p.patientId);
    setLoading(false);
  };

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

  const handleAddFamilyMember = async (e) => {
    e.preventDefault();
    setModalError("");
    setModalSuccess("");
    setModalSubmitting(true);

    if (!modalName || !modalMobile || !modalDob) {
      setModalError("Please fill in all fields.");
      setModalSubmitting(false);
      return;
    }

    const cleanMobile = modalMobile.replace(/[^0-9]/g, "");
    if (cleanMobile.length !== 10) {
      setModalError("Please enter a valid 10-digit mobile number.");
      setModalSubmitting(false);
      return;
    }

    try {
      const { findDuplicatePatient, getNextPatientId } = await import("../lib/patientService.js");
      const { putItem } = await import("../lib/db.js");

      // 1. Check if they already exist in database (e.g. registered at clinic previously)
      const existing = await findDuplicatePatient(cleanMobile, modalDob);
      const user = auth.currentUser;

      if (!user) {
        setModalError("Session expired. Please sign in again.");
        setModalSubmitting(false);
        return;
      }

      let selectedId = null;

      if (existing) {
        // Link them under same familyId and user UID
        const currentFamilyId = patient?.familyId || "FAMID-" + patient?.patientId?.replace("PAT-", "");
        const { doc, updateDoc } = await import("firebase/firestore");
        const { db: fdb } = await import("../lib/firebase.js");
        const targetRef = doc(fdb, "patients", existing.patientId);
        await updateDoc(targetRef, {
          familyId: currentFamilyId,
          uid: user.uid,
          relation: modalRelation,
          linkedAt: new Date().toISOString()
        });
        setModalSuccess(`Successfully linked ${existing.name}'s existing records to your family account!`);
        selectedId = existing.patientId;
      } else {
        // Create new patient record
        const currentFamilyId = patient?.familyId || "FAMID-" + patient?.patientId?.replace("PAT-", "");
        const nextId = await getNextPatientId();
        const newPatient = {
          patientId: nextId,
          name: modalName,
          mobile: cleanMobile,
          dateOfBirth: modalDob,
          gender: modalGender,
          age: calculateAge(modalDob) || "N/A",
          uid: user.uid,
          familyId: currentFamilyId,
          relation: modalRelation,
          createdAt: new Date().toISOString()
        };
        await putItem("patients", newPatient);
        setModalSuccess(`Successfully registered and added ${modalName} to your family profiles!`);
        selectedId = nextId;
      }

      // Reset form
      setModalName("");
      setModalMobile("");
      setModalDob("");
      setModalGender("Male");
      setModalRelation("Child");

      // Refresh patients list and activate the new member
      await loadAllLinkedPatients(user.uid, selectedId);

      setTimeout(() => {
        setShowAddModal(false);
        setModalSuccess("");
      }, 2000);

    } catch (err) {
      console.error("Add family member error:", err);
      setModalError("Failed to add family member.");
    } finally {
      setModalSubmitting(false);
    }
  };

  useEffect(() => {
    if (patient) {
      setEditMobile(patient.mobile || "");
      setEditEmail(patient.email || "");
      setContactError("");
      setContactSuccess("");
      setIsEditingContact(false);
    }
  }, [patient]);

  useEffect(() => {
    if (!patient || !patient.patientId) return;

    const updateCodeAndCountdown = () => {
      const ms = Date.now();
      const currentBlock = Math.floor(ms / 30000);
      const nextBlockTime = (currentBlock + 1) * 30000;
      const secondsLeft = Math.max(0, Math.round((nextBlockTime - ms) / 1000));
      setCountdown(secondsLeft);

      const formattedCode = `FAM-${patient.patientId.replace("PAT-", "")}-${getRotatingHash(patient.patientId)}`;
      setRotatingCode(formattedCode);
    };

    updateCodeAndCountdown();
    const interval = setInterval(updateCodeAndCountdown, 1000);
    return () => clearInterval(interval);
  }, [patient]);

  const handleUpdateContact = async (e) => {
    e.preventDefault();
    setContactError("");
    setContactSuccess("");
    setContactSubmitting(true);

    const cleanMobile = editMobile.replace(/[^0-9]/g, "");
    if (cleanMobile.length !== 10) {
      setContactError("Please enter a valid 10-digit mobile number.");
      setContactSubmitting(false);
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user) {
        setContactError("Session expired. Please sign in again.");
        setContactSubmitting(false);
        return;
      }

      const updatedPatient = {
        ...patient,
        mobile: cleanMobile,
        email: editEmail.trim(),
        updatedAt: new Date().toISOString()
      };

      await putItem("patients", updatedPatient);
      setContactSuccess("Contact details updated successfully!");
      
      // Refresh patient listing and select current patient to see updates
      await loadAllLinkedPatients(user.uid, patient.patientId);
      
      setTimeout(() => {
        setIsEditingContact(false);
        setContactSuccess("");
      }, 1500);

    } catch (err) {
      console.error("Error updating contact details:", err);
      setContactError("Failed to update contact details. Please try again.");
    } finally {
      setContactSubmitting(false);
    }
  };

  const handleLinkByCode = async (e) => {
    e.preventDefault();
    setModalError("");
    setModalSuccess("");
    setModalSubmitting(true);

    if (!modalLinkCode) {
      setModalError("Please enter a Family Link Code.");
      setModalSubmitting(false);
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user) {
        setModalError("Session expired. Please sign in again.");
        setModalSubmitting(false);
        return;
      }

      const result = await linkPatientByFamilyCode(modalLinkCode, user.uid, modalRelation);
      setModalSuccess(`Successfully linked ${result.name} to your family account!`);
      setModalLinkCode("");
      
      // Reload patients list and select newly linked patient
      await loadAllLinkedPatients(user.uid, result.patientId);

      setTimeout(() => {
        setShowAddModal(false);
        setModalSuccess("");
        setModalTab("register");
      }, 2000);

    } catch (err) {
      console.error("Link by code error:", err);
      setModalError(err.message || "Failed to link profile by code.");
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleDashboardBooking = async () => {
    if (!selectedClinic) {
      setBookingStatus("Please select a clinic.");
      return;
    }
    if (!bookingTime) {
      setBookingStatus("Please select a preferred time slot.");
      return;
    }
    if (!patient) {
      setBookingStatus("No active patient profile found.");
      return;
    }

    setBookingStatus("Booking...");

    const payload = {
      id: "Q-" + Date.now(),
      name: patient.name,
      age: patient.age || "",
      gender: patient.gender || "Male",
      mobile: patient.mobile,
      dateOfBirth: patient.dateOfBirth || "",
      reason: bookingReason.trim() ? `${bookingReason.trim()} (Returning - ${selectedClinic.name})` : `Walk-in - ${selectedClinic.name}`,
      status: "Waiting",
      timestamp: new Date().toISOString(),
      preferredTime: bookingTime,
      clinicId: selectedClinic.id,
      clinicName: selectedClinic.name,
      patientId: patient.patientId, // link profile
      source: "patient_dashboard"
    };

    try {
      await putItem("queue", payload);
      setBookingStatus("success");
      setBookingReason("");
      setBookingTime("");
    } catch (err) {
      console.error("Booking failed:", err);
      setBookingStatus("Failed to book appointment. Please try again.");
    }
  };

  const handlePrintVisit = (visit) => {
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
    <div className="min-h-screen bg-brand-beige flex flex-col font-sans relative">
      <SEO title="My Health Portal" description="Access your patient visit history, prescriptions, and lab results." />

      {/* Header Profile Section */}
      <div className="bg-gradient-to-br from-brand-primary via-brand-secondary to-brand-primary/95 text-brand-beige py-6 shadow-sm shrink-0 print:bg-white print:text-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          
          {/* Profile Details & Switcher */}
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-brand-beige/10 border border-brand-beige/20 flex items-center justify-center text-2xl font-bold text-brand-beige shrink-0 font-serif">
              {(patient?.name || "?")[0].toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-3 relative">
                <h1 className="font-serif text-2xl font-bold">{patient?.name}</h1>
                
                {/* Family Profile Switcher Dropdown */}
                {patientsList.length > 1 && (
                  <div className="relative print:hidden">
                    <button
                      onClick={() => setIsSwitcherOpen(!isSwitcherOpen)}
                      className="flex items-center gap-1 bg-white/15 hover:bg-white/25 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                    >
                      <span>Switch Profile</span>
                      <ChevronDown size={12} />
                    </button>
                    {isSwitcherOpen && (
                      <div className="absolute left-0 mt-1.5 w-48 bg-brand-cream border border-brand-light/75 text-brand-primary rounded-xl shadow-xl py-1.5 z-50">
                        {patientsList.map((p) => (
                          <button
                            key={p.patientId}
                            onClick={() => handleProfileSwitch(p)}
                            className={`w-full text-left px-4 py-2 text-xs font-semibold hover:bg-brand-light transition-colors flex justify-between items-center ${
                              p.patientId === patient?.patientId ? "bg-brand-light/35 font-bold" : ""
                            }`}
                          >
                            <span>{p.name}</span>
                            <span className="text-[9px] opacity-70 bg-brand-primary/10 px-1.5 py-0.5 rounded">
                              {p.relation || "Self"}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-brand-light/80 mt-1 font-medium">
                {patient?.relation ? `${patient.relation} • ` : "Primary Profile • "} 
                {patient?.gender} • {patient?.age} Yrs • DOB: {patient?.dateOfBirth ? patient.dateOfBirth.split("-").reverse().join("-") : "N/A"}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 print:hidden">
            <button
              onClick={() => setShowChatModal(true)}
              className="flex items-center gap-1.5 bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-400/40 text-brand-beige px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm"
            >
              <MessageCircle size={15} /> Chat with Doctor
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 bg-brand-cream/15 hover:bg-brand-cream/25 border border-brand-cream/20 text-brand-beige px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              <UserPlus size={14} /> Add Family Member
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-red-500/30 border border-white/15 text-brand-beige px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row gap-6 min-h-0">
        
        {/* Left Side Tab Navigation */}
        <div className="w-full lg:w-64 shrink-0 flex flex-col gap-3 print:hidden">
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

          <button
            onClick={() => {
              setActiveTab("booking");
              setBookingStatus("");
              setBookingReason("");
              setBookingTime("");
              setSelectedClinic(null);
            }}
            className={`flex items-center gap-3 px-5 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all text-left cursor-pointer ${
              activeTab === "booking"
                ? "bg-brand-primary text-brand-beige shadow-sm"
                : "bg-white border border-brand-light/50 text-brand-primary hover:bg-brand-light/35"
            }`}
          >
            <Calendar size={16} />
            <span>Book Appointment</span>
          </button>

          <button
            onClick={() => setActiveTab("prescriptions")}
            className={`flex items-center gap-3 px-5 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all text-left cursor-pointer ${
              activeTab === "prescriptions"
                ? "bg-brand-primary text-brand-beige shadow-sm"
                : "bg-white border border-brand-light/50 text-brand-primary hover:bg-brand-light/35"
            }`}
          >
            <FileText size={16} />
            <span>Prescription History</span>
          </button>

          <div className="mt-4 p-5 bg-brand-cream/40 border border-brand-light/45 rounded-2xl space-y-3 hidden lg:block">
            <span className="text-[10px] font-bold text-brand-secondary uppercase tracking-widest block">Family Dashboard</span>
            <p className="text-[11px] text-brand-dark/65 leading-relaxed">
              Managing health reports for you and your family. Switch profiles above or register dependents.
            </p>
          </div>
        </div>

        {/* Right Side Content Panel */}
        <div className="flex-grow min-w-0">
          
          {/* TAB 1: TIMELINE */}
          {activeTab === "timeline" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full items-start">
              
              {/* Visits List */}
              <div className="md:col-span-1 bg-white border border-brand-light/50 rounded-2xl p-4 space-y-3 max-h-[600px] overflow-y-auto print:hidden">
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
                <h2 className="font-serif text-xl font-bold text-brand-primary">Clinical History Card</h2>
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

              {/* Contact Information Section */}
              <div className="border-t border-brand-light/35 pt-6 space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-serif font-bold text-base text-brand-primary">Contact & Communication</h3>
                    <p className="text-[11px] text-brand-dark/60 font-sans">Manage your active contact number and portal email registration details.</p>
                  </div>
                  {!isEditingContact && (
                    <button
                      onClick={() => {
                        setEditMobile(patient?.mobile || "");
                        setEditEmail(patient?.email || "");
                        setIsEditingContact(true);
                      }}
                      className="bg-brand-cream/30 hover:bg-brand-light/40 border border-brand-light/65 text-brand-primary px-3.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <User size={12} /> Edit Details
                    </button>
                  )}
                </div>

                {contactSuccess && (
                  <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex items-center gap-2.5 text-xs text-emerald-700 font-semibold max-w-md animate-fadeIn">
                    <CheckCircle size={16} className="shrink-0" />
                    <span>{contactSuccess}</span>
                  </div>
                )}
                {contactError && (
                  <div className="bg-red-50 border border-red-100 p-3 rounded-xl flex items-center gap-2.5 text-xs text-red-700 font-semibold max-w-md animate-fadeIn">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{contactError}</span>
                  </div>
                )}

                {!isEditingContact ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-brand-cream/10 border border-brand-light/30 p-4 rounded-xl flex items-center gap-3">
                      <Phone size={16} className="text-brand-secondary" />
                      <div>
                        <span className="text-[10px] text-brand-dark/50 font-bold uppercase block">Mobile Number</span>
                        <span className="text-xs font-semibold text-brand-primary">{patient?.mobile ? patient.mobile.replace(/(\d{5})(\d{5})/, "$1-$2") : "Not provided"}</span>
                      </div>
                    </div>
                    <div className="bg-brand-cream/10 border border-brand-light/30 p-4 rounded-xl flex items-center gap-3">
                      <Mail size={16} className="text-brand-secondary" />
                      <div>
                        <span className="text-[10px] text-brand-dark/50 font-bold uppercase block">Email Address</span>
                        <span className="text-xs font-semibold text-brand-primary">{patient?.email || "Not linked"}</span>
                      </div>
                    </div>
                    <div className="bg-brand-cream/10 border border-brand-light/30 p-4 rounded-xl flex items-center justify-between sm:col-span-2 flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <UserPlus size={16} className="text-brand-secondary shrink-0" />
                        <div>
                          <span className="text-[10px] text-brand-dark/50 font-bold uppercase block">Rotating Family Link Code</span>
                          <span className="text-sm font-mono font-bold text-brand-primary bg-brand-light/35 px-3 py-1.5 rounded select-all tracking-wider">
                            {rotatingCode || "Generating..."}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-right">
                        <div className="h-6.5 w-6.5 rounded-full border-2 border-brand-secondary/40 flex items-center justify-center text-[10px] font-bold text-brand-secondary font-mono animate-pulse">
                          {countdown}s
                        </div>
                        <span className="text-[9px] text-brand-dark/50 font-bold uppercase tracking-wider block">Expires soon</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleUpdateContact} className="bg-brand-cream/10 border border-brand-light/30 p-6 rounded-2xl space-y-4 max-w-2xl animate-fadeIn">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-brand-primary uppercase tracking-wider">Mobile Number</label>
                        <div className="relative">
                          <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-secondary/60" />
                          <input
                            type="tel"
                            value={editMobile}
                            onChange={(e) => setEditMobile(e.target.value)}
                            placeholder="Enter 10-digit mobile"
                            className="w-full bg-white border border-brand-light/50 pl-10 pr-3 py-2 rounded-xl text-xs focus:outline-none focus:border-brand-secondary"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-brand-primary uppercase tracking-wider">Email Address</label>
                        <div className="relative">
                          <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-secondary/60" />
                          <input
                            type="email"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            placeholder="Enter email address"
                            className="w-full bg-white border border-brand-light/50 pl-10 pr-3 py-2 rounded-xl text-xs focus:outline-none focus:border-brand-secondary"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 pt-1">
                      <button
                        type="submit"
                        disabled={contactSubmitting}
                        className="bg-brand-primary hover:bg-brand-secondary text-brand-beige px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {contactSubmitting ? "Saving..." : "Save Changes"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingContact(false);
                          setContactError("");
                        }}
                        className="bg-white border border-brand-light/50 hover:bg-brand-light/20 text-brand-primary px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
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

          {/* TAB 4: BOOK APPOINTMENT */}
          {activeTab === "booking" && (
            <div className="bg-white border border-brand-light/50 rounded-3xl p-6 md:p-8 space-y-6 shadow-sm">
              <div className="border-b border-brand-light/45 pb-4">
                <h2 className="font-serif text-xl font-bold text-brand-primary">Book Clinic Appointment</h2>
                <p className="text-xs text-brand-dark/65 font-sans mt-1">
                  Select a clinic, choose a preferred time slot, and confirm your slot.
                </p>
                <div className="mt-3 bg-brand-light/15 border border-brand-light/25 rounded-xl p-3 text-xs flex items-center justify-between text-brand-primary">
                  <span>
                    Booking for: <strong>{patient?.name}</strong> {patient?.relation ? `(${patient.relation})` : "(Primary Profile)"}
                  </span>
                  <span className="text-[10px] bg-brand-primary/10 px-2 py-0.5 rounded font-bold uppercase">
                    {patient?.gender} • {patient?.age} Yrs
                  </span>
                </div>
              </div>

              {bookingStatus === "success" ? (
                <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-200 text-center space-y-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-serif font-semibold text-lg text-emerald-800">Booking Confirmed!</h3>
                    <p className="text-xs text-emerald-700 mt-1">
                      Your appointment has been successfully booked for {patient?.name}.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setBookingStatus("");
                      setBookingReason("");
                      setBookingTime("");
                      setSelectedClinic(null);
                    }}
                    className="bg-brand-primary hover:bg-brand-secondary text-brand-beige px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer"
                  >
                    Book Another Appointment
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {bookingStatus && bookingStatus !== "Booking..." && (
                    <div className="bg-red-50 border border-red-100 p-3 rounded-xl flex items-center gap-2.5 text-xs text-red-700 font-semibold">
                      <AlertCircle size={16} className="shrink-0" />
                      <span>{bookingStatus}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-brand-secondary mb-3">1. Select Clinic</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {clinics.map((c) => {
                        const isSelected = selectedClinic?.id === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setSelectedClinic(c);
                              setBookingTime("");
                            }}
                            className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between h-full cursor-pointer ${
                              isSelected
                                ? "border-brand-primary bg-brand-light/20 ring-2 ring-brand-primary/20 shadow-md"
                                : "border-brand-light/50 bg-white hover:bg-brand-light/10 hover:border-brand-light"
                            }`}
                          >
                            <div className="space-y-2">
                              <span className="text-[10px] font-bold text-brand-secondary bg-brand-light px-2 py-0.5 rounded">
                                {c.days}
                              </span>
                              <h4 className="font-serif font-bold text-sm text-brand-primary">{c.name}</h4>
                              <p className="text-[11px] text-brand-dark/70 leading-relaxed line-clamp-3">{c.address}</p>
                            </div>
                            <div className="mt-4 pt-2 border-t border-brand-light/20 w-full flex justify-between items-center text-[10px] text-brand-secondary">
                              <span>7:00 PM – 9:00 PM</span>
                              <span>{c.contact.split("|")[0].trim()}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {selectedClinic && (
                    <div className="space-y-5 animate-fadeIn">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-brand-secondary mb-3">2. Select Preferred Time Slot</label>
                        <div className="flex flex-wrap gap-2.5">
                          {selectedClinic.times.map((t) => {
                            const isTimeSelected = bookingTime === t;
                            return (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setBookingTime(t)}
                                className={`px-4 py-2.5 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
                                  isTimeSelected
                                    ? "bg-brand-primary text-brand-beige shadow-sm"
                                    : "bg-brand-cream/25 border border-brand-light/50 text-brand-primary hover:bg-brand-light/35"
                                }`}
                              >
                                {t}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-bold uppercase tracking-wider text-brand-secondary">3. Reason for Visit (Optional)</label>
                        <textarea
                          rows={3}
                          value={bookingReason}
                          onChange={(e) => setBookingReason(e.target.value)}
                          placeholder="Briefly describe your symptoms or medical concern..."
                          className="w-full bg-brand-cream/5 border border-brand-light/50 rounded-2xl px-4 py-3 text-xs text-brand-dark focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all duration-150"
                        />
                      </div>

                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={handleDashboardBooking}
                          disabled={bookingStatus === "Booking..."}
                          className="w-full bg-brand-primary text-brand-beige py-3.5 rounded-2xl text-xs font-bold uppercase tracking-wider hover:bg-brand-secondary transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          <Sparkles size={14} />
                          {bookingStatus === "Booking..." ? "Booking Slot..." : "Confirm Booking Slot"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: PRESCRIPTION HISTORY */}
          {activeTab === "prescriptions" && (
            <div className="bg-white border border-brand-light/50 rounded-3xl p-6 md:p-8 space-y-6 shadow-sm">
              <div className="border-b border-brand-light/45 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="font-serif text-xl font-bold text-brand-primary flex items-center gap-2">
                    <FileText size={22} className="text-emerald-700" /> Prescriptions & Consultation History
                  </h2>
                  <p className="text-xs text-brand-dark/65 font-sans mt-1">
                    Permanent records of all medications, diagnosis, and advice given by doctors.
                  </p>
                </div>

                {/* Search Bar */}
                <input
                  type="text"
                  placeholder="Search by diagnosis or medicine..."
                  value={rxSearchTerm}
                  onChange={(e) => setRxSearchTerm(e.target.value)}
                  className="bg-brand-cream/10 border border-brand-light px-4 py-2 rounded-xl text-xs w-full md:w-64 focus:outline-none focus:border-brand-primary"
                />
              </div>

              {rxLoading ? (
                <div className="py-16 text-center text-xs text-brand-dark/50 animate-pulse">
                  Loading prescription history...
                </div>
              ) : prescriptionHistory.length === 0 ? (
                <div className="py-16 text-center text-xs text-brand-dark/50 bg-brand-cream/10 rounded-2xl border border-brand-light/30 space-y-2">
                  <FileText size={36} className="mx-auto text-brand-secondary/30" />
                  <p className="font-semibold text-brand-primary">No prescriptions recorded yet.</p>
                  <p className="text-[11px] text-brand-dark/60">When your doctor prescribes medications during consultations or chat, they will appear here permanently.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {prescriptionHistory
                    .filter(rx => {
                      if (!rxSearchTerm.trim()) return true;
                      const term = rxSearchTerm.toLowerCase();
                      return (
                        (rx.diagnosis || "").toLowerCase().includes(term) ||
                        (rx.patientName || "").toLowerCase().includes(term) ||
                        (rx.medicines || []).some(m => (m.name || "").toLowerCase().includes(term))
                      );
                    })
                    .map((rx) => (
                      <div key={rx.id} className="border border-brand-light/50 rounded-3xl overflow-hidden shadow-sm bg-brand-beige/20">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-emerald-900 to-teal-900 text-white p-4.5 flex justify-between items-center flex-wrap gap-2">
                          <div>
                            <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-300 block">
                              Prescribed for: {rx.patientName}
                            </span>
                            <h4 className="font-serif font-bold text-base text-white">
                              {rx.diagnosis ? `Diagnosis: ${rx.diagnosis}` : "General Consultation Rx"}
                            </h4>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-emerald-200 block font-medium">
                              {new Date(rx.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                            </span>
                            <span className="text-[9px] font-mono text-emerald-300/80">{rx.prescriptionId}</span>
                          </div>
                        </div>

                        {/* Body */}
                        <div className="p-5 space-y-4 text-xs">
                          {/* Medicines Table */}
                          <div className="space-y-2">
                            <span className="font-bold text-brand-primary uppercase tracking-wider text-[10px] block">
                              💊 Advised Medications
                            </span>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse bg-white rounded-xl overflow-hidden border border-brand-light/40">
                                <thead>
                                  <tr className="bg-emerald-50 text-emerald-950 font-bold uppercase text-[10px] border-b border-emerald-200">
                                    <th className="py-2.5 px-3">#</th>
                                    <th className="py-2.5 px-3">Medicine Name</th>
                                    <th className="py-2.5 px-3">Dose / Frequency</th>
                                    <th className="py-2.5 px-3">Timing (Kala)</th>
                                    <th className="py-2.5 px-3">Anupana</th>
                                    <th className="py-2.5 px-3 text-right">Duration</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-gray-800">
                                  {rx.medicines && rx.medicines.map((m, idx) => (
                                    <tr key={idx} className="hover:bg-brand-beige/30">
                                      <td className="py-2.5 px-3 font-semibold text-gray-400">{idx + 1}</td>
                                      <td className="py-2.5 px-3 font-bold text-emerald-900">{m.name}</td>
                                      <td className="py-2.5 px-3">{m.dose} • {m.frequency}</td>
                                      <td className="py-2.5 px-3 font-medium">{m.kala || "—"}</td>
                                      <td className="py-2.5 px-3 italic">{m.anupana || "—"}</td>
                                      <td className="py-2.5 px-3 text-right font-bold text-emerald-900">{m.duration || "—"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Notes & Lifestyle */}
                          {rx.notes && (
                            <div className="bg-white p-3.5 rounded-xl border border-brand-light/35 space-y-1">
                              <span className="font-bold text-brand-primary text-[10px] uppercase tracking-wider block">
                                Diet & Lifestyle Instructions (Pathya-Apathya):
                              </span>
                              <p className="text-brand-dark/75 italic">"{rx.notes}"</p>
                            </div>
                          )}

                          <div className="flex justify-between items-center pt-2 text-[10px] text-brand-dark/50 border-t border-brand-light/30">
                            <span>Prescribed by: <strong>{rx.doctorName || "Doctor"}</strong></span>
                            <button
                              onClick={() => window.print()}
                              className="flex items-center gap-1 text-brand-primary hover:text-brand-secondary font-bold uppercase tracking-wider cursor-pointer"
                            >
                              <Printer size={12} /> Print Prescription
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ─── ADD FAMILY MEMBER MODAL ─── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-brand-cream border border-brand-light/75 w-full max-w-md rounded-3xl p-6 md:p-8 space-y-4 shadow-2xl relative">
            <button
              onClick={() => {
                setShowAddModal(false);
                setModalError("");
                setModalSuccess("");
                setModalTab("register");
                setModalLinkCode("");
              }}
              className="absolute right-4 top-4 p-1.5 hover:bg-brand-light/35 rounded-lg text-brand-primary transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="text-center">
              <h3 className="font-serif text-xl font-bold text-brand-primary">Family Settings</h3>
              <p className="text-xs text-brand-dark/65 mt-1 font-sans">
                Register new family members or link existing profiles using their link codes.
              </p>
            </div>

            {/* Tabs Switcher */}
            <div className="flex bg-brand-beige p-1 rounded-xl border border-brand-light/35 gap-1 my-1">
              <button
                type="button"
                onClick={() => {
                  setModalTab("register");
                  setModalError("");
                  setModalSuccess("");
                }}
                className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                  modalTab === "register"
                    ? "bg-brand-primary text-brand-beige shadow-sm"
                    : "text-brand-primary hover:bg-brand-light/30"
                }`}
              >
                Register New
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalTab("linkcode");
                  setModalError("");
                  setModalSuccess("");
                }}
                className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                  modalTab === "linkcode"
                    ? "bg-brand-primary text-brand-beige shadow-sm"
                    : "text-brand-primary hover:bg-brand-light/30"
                }`}
              >
                Link by Code
              </button>
            </div>

            {modalError && (
              <div className="bg-red-50 border border-red-100 p-3 rounded-xl flex items-center gap-2.5 text-xs text-red-700 font-semibold">
                <AlertCircle size={16} className="shrink-0" />
                <span>{modalError}</span>
              </div>
            )}
            {modalSuccess && (
              <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex items-center gap-2.5 text-xs text-emerald-700 font-semibold">
                <CheckCircle size={16} className="shrink-0" />
                <span>{modalSuccess}</span>
              </div>
            )}

            {modalTab === "register" ? (
              <form onSubmit={handleAddFamilyMember} className="space-y-4 pt-1">
                <div>
                  <label className="block text-[10px] font-bold text-brand-primary uppercase tracking-wider mb-2">Dependents Full Name</label>
                  <div className="relative">
                    <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-secondary/70" />
                    <input
                      type="text"
                      value={modalName}
                      onChange={(e) => setModalName(e.target.value)}
                      placeholder="Son's/Wife's Name"
                      className="w-full bg-brand-beige border border-brand-light/50 pl-11 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:border-brand-secondary"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-brand-primary uppercase tracking-wider mb-2">Registered Mobile (e.g. Parent's Mobile)</label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-secondary/70" />
                    <input
                      type="tel"
                      value={modalMobile}
                      onChange={(e) => setModalMobile(e.target.value)}
                      placeholder="Enter phone number"
                      className="w-full bg-brand-beige border border-brand-light/50 pl-11 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:border-brand-secondary"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-brand-primary uppercase tracking-wider mb-2">Date of Birth</label>
                    <div className="relative">
                      <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-secondary/70" />
                      <input
                        type="date"
                        value={modalDob}
                        onChange={(e) => setModalDob(e.target.value)}
                        className="w-full bg-brand-beige border border-brand-light/50 pl-11 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:border-brand-secondary"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-brand-primary uppercase tracking-wider mb-2">Relation</label>
                    <select
                      value={modalRelation}
                      onChange={(e) => setModalRelation(e.target.value)}
                      className="w-full bg-brand-beige border border-brand-light/50 px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-brand-secondary"
                    >
                      <option value="Child">Child</option>
                      <option value="Spouse">Spouse</option>
                      <option value="Parent">Parent</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-brand-primary uppercase tracking-wider mb-2">Gender</label>
                  <select
                    value={modalGender}
                    onChange={(e) => setModalGender(e.target.value)}
                    className="w-full bg-brand-beige border border-brand-light/50 px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-brand-secondary"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="w-full bg-brand-primary text-brand-beige hover:bg-brand-secondary py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-md mt-2 cursor-pointer disabled:opacity-50"
                >
                  {modalSubmitting ? "Processing..." : "Add Family Member"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleLinkByCode} className="space-y-4 pt-1 animate-fadeIn">
                <div>
                  <label className="block text-[10px] font-bold text-brand-primary uppercase tracking-wider mb-2">Enter Family Link Code</label>
                  <div className="relative">
                    <Shield size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-secondary/70" />
                    <input
                      type="text"
                      value={modalLinkCode}
                      onChange={(e) => setModalLinkCode(e.target.value)}
                      placeholder="e.g. FAM-X8D2J5"
                      className="w-full bg-brand-beige border border-brand-light/50 pl-11 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:border-brand-secondary uppercase"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-brand-primary uppercase tracking-wider mb-2">Relation</label>
                  <select
                    value={modalRelation}
                    onChange={(e) => setModalRelation(e.target.value)}
                    className="w-full bg-brand-beige border border-brand-light/50 px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-brand-secondary"
                  >
                    <option value="Child">Child</option>
                    <option value="Spouse">Spouse</option>
                    <option value="Parent">Parent</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="w-full bg-brand-primary text-brand-beige hover:bg-brand-secondary py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-md mt-2 cursor-pointer disabled:opacity-50"
                >
                  {modalSubmitting ? "Linking..." : "Link Profile"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ─── DOCTOR CONSULTATION CHAT MODAL OVERLAY ─── */}
      {showChatModal && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 print:hidden">
          <div className="bg-white border border-brand-light w-full max-w-5xl h-[88vh] rounded-3xl flex flex-col shadow-2xl overflow-hidden animate-scaleUp">
            
            {/* Top Modal Header */}
            <div className="bg-brand-primary text-brand-beige px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowChatModal(false)}
                  className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer text-brand-beige shadow-sm"
                >
                  <ArrowLeft size={16} /> Go Back
                </button>
                <div>
                  <h3 className="font-serif text-lg font-bold flex items-center gap-2">
                    <MessageCircle size={20} className="text-emerald-300" /> Doctor Consultation Chat
                  </h3>
                  <p className="text-[10px] text-brand-beige/80">
                    Messaging as: <strong>{patient?.name}</strong> {patient?.relation ? `(${patient.relation})` : "(Primary Profile)"}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowChatModal(false)}
                className="p-1.5 hover:bg-white/20 rounded-xl text-brand-beige transition-colors cursor-pointer"
                title="Close Chat Box"
              >
                <X size={20} />
              </button>
            </div>

            {/* Main Chat Body: Grid 2 Columns */}
            <div className="flex-grow grid grid-cols-1 md:grid-cols-12 min-h-0">
              
              {/* Left Side: Doctor Switcher / Clinic Doctors Directory */}
              <div className="md:col-span-4 bg-brand-cream/40 border-r border-brand-light/50 p-4 flex flex-col h-full min-h-0">
                <div className="pb-3 border-b border-brand-light/50 shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-brand-secondary block">
                    Clinic Doctors Directory
                  </span>
                  <p className="text-[11px] text-brand-dark/60 font-medium">Select a doctor to start or continue chat</p>
                </div>

                <div className="flex-grow overflow-y-auto pt-3 space-y-2 custom-scrollbar">
                  {availableDoctors.map((doc) => {
                    const isSelected = selectedDoctorName === doc.name;
                    return (
                      <div
                        key={doc.id}
                        onClick={() => setSelectedDoctorName(doc.name)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? "bg-brand-primary text-brand-beige border-brand-primary shadow-sm"
                            : "bg-white border-brand-light/60 text-brand-dark hover:bg-brand-beige/40"
                        }`}
                      >
                        <div>
                          <h4 className="font-serif font-bold text-xs">
                            {doc.name}
                          </h4>
                          <p className={`text-[10px] mt-0.5 ${isSelected ? "text-brand-beige/80" : "text-brand-dark/55"}`}>
                            {doc.specialization}
                          </p>
                        </div>
                        {isSelected && (
                          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" title="Active conversation" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Side: Active Doctor Chat Thread */}
              <div className="md:col-span-8 bg-white p-5 flex flex-col h-full min-h-0">
                
                {/* Active Doctor Info Header */}
                <div className="border-b border-brand-light/40 pb-3 flex justify-between items-center shrink-0">
                  <div>
                    <h4 className="font-serif font-bold text-base text-brand-primary">
                      {selectedDoctorName}
                    </h4>
                    <p className="text-[10px] text-brand-dark/60">
                      {availableDoctors.find(d => d.name === selectedDoctorName)?.specialization || "Ayurvedic Medical Consultant"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Available for Chat</span>
                  </div>
                </div>

                {/* Banner notification about 15-day auto deletion */}
                <div className="bg-emerald-50/80 border border-emerald-200 text-emerald-900 rounded-xl p-2.5 my-2 text-[11px] flex items-center gap-2 shrink-0">
                  <span>ℹ️</span>
                  <span>Regular text chat auto-deletes after 15 days. Prescriptions are saved permanently in database history.</span>
                </div>

                {/* Messages Feed */}
                <div className="flex-grow overflow-y-auto px-2 py-3 space-y-3 custom-scrollbar min-h-0">
                  {patientChatMessages.length === 0 ? (
                    <div className="py-16 text-center space-y-2">
                      <MessageCircle size={36} className="mx-auto text-brand-secondary/30" />
                      <p className="text-xs text-brand-dark/50">No chat history with {selectedDoctorName} yet.</p>
                      <p className="text-[10px] text-brand-dark/40 italic">Type your medical inquiry below to begin consultation.</p>
                    </div>
                  ) : (
                    patientChatMessages.map((msg) => {
                      const isPatient = msg.senderRole === "patient";
                      if (msg.type === "prescription" && msg.prescriptionData) {
                        const rx = msg.prescriptionData;
                        return (
                          <div key={msg.id} className="my-4 mx-auto max-w-lg bg-gradient-to-br from-emerald-900 via-teal-900 to-emerald-950 text-white p-5 rounded-3xl shadow-lg border border-emerald-600 space-y-3">
                            <div className="flex justify-between items-center border-b border-emerald-700/60 pb-2">
                              <div className="flex items-center gap-2">
                                <span className="bg-emerald-500 text-white text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-md tracking-wider">
                                  ✓ Prescribed
                                </span>
                                <span className="font-serif font-bold text-sm text-emerald-100">Official Prescription</span>
                              </div>
                              <span className="text-[10px] text-emerald-300/70 font-mono">{rx.prescriptionId}</span>
                            </div>
                            {rx.diagnosis && (
                              <div className="text-xs text-emerald-100">
                                <span className="font-bold text-emerald-300">Diagnosis: </span>
                                <span>{rx.diagnosis}</span>
                              </div>
                            )}
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 block">Prescribed Medications:</span>
                              <div className="bg-emerald-950/70 rounded-xl p-3 space-y-2 border border-emerald-800/50">
                                {rx.medicines && rx.medicines.map((m, idx) => (
                                  <div key={idx} className="text-xs border-b border-emerald-800/40 pb-2 last:border-0 last:pb-0">
                                    <div className="font-bold text-white flex justify-between">
                                      <span>{idx + 1}. {m.name}</span>
                                      <span className="text-emerald-300 text-[11px]">{m.dose} • {m.frequency}</span>
                                    </div>
                                    <div className="text-[10px] text-emerald-200/80 flex flex-wrap gap-2 mt-0.5">
                                      {m.kala && <span>Kala: {m.kala}</span>}
                                      {m.anupana && <span>Anupana: {m.anupana}</span>}
                                      {m.duration && <span className="font-semibold text-emerald-300">Duration: {m.duration}</span>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            {rx.notes && <p className="text-xs italic text-emerald-200/80">"{rx.notes}"</p>}
                            <div className="text-[10px] text-emerald-300/70 text-right pt-1">
                              Issued by {rx.doctorName || selectedDoctorName} on {new Date(rx.createdAt).toLocaleDateString("en-IN")}
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={msg.id} className={`flex flex-col ${isPatient ? "items-end" : "items-start"}`}>
                          <div
                            className={`max-w-[78%] p-3.5 rounded-2xl text-xs shadow-xs space-y-1 ${
                              isPatient
                                ? "bg-emerald-700 text-white rounded-br-none"
                                : "bg-brand-beige text-brand-dark border border-brand-light/60 rounded-bl-none"
                            }`}
                          >
                            <span className="text-[9px] font-bold block opacity-75">
                              {isPatient ? "You" : (msg.senderName || selectedDoctorName)}
                            </span>
                            <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                          </div>
                          <span className="text-[9px] text-brand-dark/40 mt-1 px-1 font-medium">
                            {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : ""}
                          </span>
                        </div>
                      );
                    })
                  )}
                  <div ref={patientChatBottomRef} />
                </div>

                {/* Send Input Bar */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!patientChatInput.trim() || !patient?.patientId) return;
                    sendChatMessage(
                      patient.patientId,
                      patient.name || "Patient",
                      "patient",
                      patient.name || "Patient",
                      patientChatInput.trim(),
                      { doctorName: selectedDoctorName }
                    );
                    setPatientChatInput("");
                  }}
                  className="flex items-center gap-2 pt-3 border-t border-brand-light/50 shrink-0"
                >
                  <input
                    type="text"
                    placeholder={`Message ${selectedDoctorName} for ${patient?.name}...`}
                    value={patientChatInput}
                    onChange={(e) => setPatientChatInput(e.target.value)}
                    className="flex-grow bg-brand-beige/50 border border-brand-light px-4 py-3 rounded-2xl text-xs focus:outline-none focus:border-brand-primary"
                  />
                  <button
                    type="submit"
                    className="bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  >
                    <Send size={15} /> Send
                  </button>
                </form>

              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
