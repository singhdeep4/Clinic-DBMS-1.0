import React, { useState, useEffect } from "react";
import { putItem } from "../lib/db.js";
import { findDuplicatePatient } from "../lib/patientService.js";
import { motion, AnimatePresence } from "framer-motion";
import { 
  User, Phone, Calendar, ClipboardList, CheckCircle2, 
  AlertCircle, ShieldCheck, Heart, Sparkles, Clock, PhoneCall
} from "lucide-react";

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

const calculateAge = (dobString) => {
  if (!dobString) return "";
  const birthDate = new Date(dobString);
  if (isNaN(birthDate.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 0 ? age.toString() : "";
};

export default function PatientHome() {
  const [openClinic, setOpenClinic] = useState(null);
  
  // Form type: 'first' (New Patient) or 'returning' (Registered)
  const [visitType, setVisitType] = useState("first");

  // Booking fields
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("Male");
  const [mobile, setMobile] = useState("");
  const [dob, setDob] = useState("");
  const [reason, setReason] = useState("");
  const [time, setTime] = useState("");
  const [status, setStatus] = useState("");

  // Verification states for returning patients
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const [verifiedPatient, setVerifiedPatient] = useState(null);

  // Contact popup state and helpers
  const [activeNumberMenu, setActiveNumberMenu] = useState(null);
  const cleanTel = (num) => num.replace(/[^0-9+]/g, "");
  const cleanWA = (num) => num.replace(/[^0-9]/g, "");

  useEffect(() => {
    const handleGlobalClick = () => {
      setActiveNumberMenu(null);
    };
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, []);

  const openForm = (clinicId) => {
    setOpenClinic(clinicId);
    setVisitType("first");
    setName("");
    setAge("");
    setGender("Male");
    setMobile("");
    setDob("");
    setReason("");
    setTime("");
    setStatus("");
    setVerifiedPatient(null);
    setVerificationError("");
    setIsVerifying(false);
  };

  const handleVerify = async () => {
    if (!mobile.trim()) {
      setVerificationError("Please enter your registered mobile number.");
      return;
    }
    if (!dob) {
      setVerificationError("Please select your date of birth.");
      return;
    }

    setIsVerifying(true);
    setVerificationError("");
    setVerifiedPatient(null);

    try {
      const match = await findDuplicatePatient(mobile.trim(), dob);
      if (match) {
        setVerifiedPatient(match);
        setVerificationError("");
      } else {
        setVerificationError("Profile not found. Please verify details, or select 'First Time Visit' if you haven't registered before.");
      }
    } catch (err) {
      console.error("Verification error:", err);
      setVerificationError("Verification failed due to a server error. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const submitBooking = async (clinic) => {
    setStatus("");

    // Time validation
    if (!time) {
      setStatus("Please select a time slot.");
      return;
    }

    let payload = null;

    if (visitType === "first") {
      // New Patient validations
      if (!name.trim()) return setStatus("Please enter your name.");
      if (!dob) return setStatus("Please select your date of birth.");
      if (!age || isNaN(age) || parseInt(age, 10) <= 0) return setStatus("Please enter a valid date of birth.");
      if (!gender) return setStatus("Please select your gender.");
      if (!mobile.trim() || mobile.replace(/[^0-9]/g, "").length < 10) return setStatus("Please enter a valid 10-digit mobile number.");

      setStatus("Checking registrations...");
      // Check if they are actually a returning patient trying to register again
      try {
        const existing = await findDuplicatePatient(mobile.trim(), dob);
        if (existing) {
          setStatus("");
          setVerificationError("You are already registered in our system! Please select 'Returning Patient' and enter your details to book directly.");
          setVerifiedPatient(existing);
          setVisitType("returning");
          return;
        }
      } catch (err) {
        console.warn("Could not run pre-registration duplicate check:", err);
      }

      setStatus("Booking...");
      payload = {
        id: "Q-" + Date.now(),
        name: name.trim(),
        age: age.trim(),
        gender,
        mobile: mobile.replace(/[^0-9]/g, ""),
        dateOfBirth: dob,
        reason: reason.trim() ? `${reason.trim()} (New - ${clinic.name})` : `Walk-in - ${clinic.name}`,
        status: "Waiting",
        timestamp: new Date().toISOString(),
        preferredTime: time,
        clinicId: clinic.id,
        clinicName: clinic.name,
        source: "patient_home"
      };

    } else {
      // Returning Patient validations
      if (!verifiedPatient) {
        // Attempt verification if not done yet
        await handleVerify();
        return;
      }

      setStatus("Booking...");
      payload = {
        id: "Q-" + Date.now(),
        name: verifiedPatient.name,
        age: verifiedPatient.age || "",
        gender: verifiedPatient.gender || "Male",
        mobile: verifiedPatient.mobile,
        dateOfBirth: verifiedPatient.dateOfBirth || dob,
        reason: reason.trim() ? `${reason.trim()} (Returning - ${clinic.name})` : `Walk-in - ${clinic.name}`,
        status: "Waiting",
        timestamp: new Date().toISOString(),
        preferredTime: time,
        clinicId: clinic.id,
        clinicName: clinic.name,
        patientId: verifiedPatient.patientId, // link profile
        source: "patient_home"
      };
    }

    try {
      await putItem("queue", payload);
      setStatus("success");
      // Reset form fields
      setName("");
      setAge("");
      setMobile("");
      setDob("");
      setReason("");
      setTime("");
      setVerifiedPatient(null);
    } catch (err) {
      console.error("Booking failed:", err);
      setStatus("Failed to book appointment. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-brand-cream/35 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-light/60 text-brand-primary text-sm font-semibold tracking-wide mb-4"
          >
            <Sparkles className="w-4 h-4 text-brand-accent animate-pulse" />
            <span>Ayurvedic Holistic Care</span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="text-4xl font-serif font-bold text-brand-dark tracking-tight sm:text-5xl"
          >
            Book a Walk-in / Appointment
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mt-3 text-lg text-brand-secondary/85 max-w-xl mx-auto"
          >
            Choose a clinic convenient to you, enter your details, and book your slot. No complex logins required.
          </motion.p>
        </div>

        <div className="space-y-8">
          {clinics.map((c, index) => (
            <motion.div 
              key={c.id} 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index, duration: 0.5 }}
              className="p-6 md:p-8 border border-brand-primary/10 rounded-2xl bg-white shadow-md hover:shadow-lg transition-all duration-300 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-light/10 rounded-full translate-x-12 -translate-y-12 pointer-events-none" />
              
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                <div className="space-y-3 max-w-xl">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-light text-brand-primary text-xs font-semibold">
                    <Calendar className="w-3.5 h-3.5 text-brand-accent shrink-0" />
                    <span>Clinic Days: {c.days}</span>
                  </div>
                  <h2 className="font-serif font-semibold text-2xl text-brand-dark">{c.name}</h2>
                  <p className="text-sm leading-relaxed whitespace-pre-line text-brand-secondary/90">{c.address}</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-sm text-brand-secondary">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-brand-accent shrink-0" />
                      <span>7:00 PM – 9:00 PM IST</span>
                    </div>
                    <div className="flex items-start gap-2 relative">
                      <PhoneCall className="w-4 h-4 text-brand-accent shrink-0 mt-0.5" />
                      <div className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm">
                        {c.contact.split("|").map((num, idx, arr) => {
                          const trimmedNum = num.trim();
                          const isMenuOpen = activeNumberMenu === trimmedNum;
                          return (
                            <React.Fragment key={trimmedNum}>
                              <div className="relative inline-block">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveNumberMenu(isMenuOpen ? null : trimmedNum);
                                  }}
                                  className="hover:text-brand-primary font-semibold underline decoration-dotted transition-colors cursor-pointer text-left text-[13px] md:text-sm"
                                >
                                  {trimmedNum}
                                </button>
                                
                                <AnimatePresence>
                                  {isMenuOpen && (
                                    <motion.div
                                      initial={{ opacity: 0, y: -5, scale: 0.95 }}
                                      animate={{ opacity: 1, y: 0, scale: 1 }}
                                      exit={{ opacity: 0, y: -5, scale: 0.95 }}
                                      transition={{ duration: 0.15 }}
                                      className="absolute left-0 bottom-full mb-2 w-48 bg-white border border-brand-primary/10 rounded-xl shadow-xl py-2 z-50 overflow-hidden text-brand-dark"
                                    >
                                      <div className="px-3 py-1 text-[9px] uppercase font-bold text-brand-secondary border-b border-brand-light/20 bg-brand-cream/35">
                                        Choose Option
                                      </div>
                                      <a
                                        href={`tel:${cleanTel(trimmedNum)}`}
                                        onClick={() => setActiveNumberMenu(null)}
                                        className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold hover:bg-brand-light transition-colors text-brand-primary"
                                      >
                                        <Phone className="w-3.5 h-3.5 text-brand-accent shrink-0" />
                                        <span>Normal Phone Call</span>
                                      </a>
                                      <a
                                        href={`https://wa.me/${cleanWA(trimmedNum)}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={() => setActiveNumberMenu(null)}
                                        className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold hover:bg-brand-light transition-colors text-emerald-700"
                                      >
                                        <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24">
                                          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.725 1.45 5.489 0 9.952-4.466 9.955-9.956.002-2.661-1.033-5.163-2.909-7.04C16.545 1.732 14.047.697 11.385.697c-5.495 0-9.96 4.46-9.963 9.95-.001 1.637.43 3.238 1.248 4.647L1.64 21.397l6.236-1.637.77.44c1 .58 2 .87 3.3.87zM17.487 14.39c-.3-.15-1.774-.875-2.046-.975-.273-.1-.472-.15-.672.15-.2.3-.775.975-.95 1.175-.175.2-.35.225-.65.075-.3-.15-1.265-.467-2.41-1.485-.89-.795-1.49-1.77-1.665-2.07-.175-.3-.02-.463.13-.613.135-.135.3-.35.45-.525.15-.175.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.672-1.62-.92-2.22-.24-.58-.487-.5-.672-.51-.175-.007-.375-.01-.575-.01-.2 0-.525.075-.8.375-.275.3-1.05 1.025-1.05 2.5s1.075 2.9 1.225 3.1c.15.2 2.11 3.224 5.112 4.52.714.308 1.272.493 1.707.63.714.227 1.365.195 1.88.118.574-.085 1.774-.725 2.023-1.425.249-.7.249-1.3.175-1.425-.075-.125-.275-.2-.575-.35z" />
                                        </svg>
                                        <span>WhatsApp Chat</span>
                                      </a>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                              {idx < arr.length - 1 && <span className="text-brand-secondary/30 select-none">|</span>}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="w-full md:w-auto shrink-0 pt-4 md:pt-0">
                  <button 
                    onClick={() => openForm(openClinic === c.id ? null : c.id)}
                    className="w-full md:w-auto bg-brand-primary text-brand-beige hover:bg-brand-secondary active:scale-[0.98] px-6 py-3.5 rounded-xl font-semibold shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer text-center"
                  >
                    {openClinic === c.id ? "Close Form" : "Book Appointment"}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {openClinic === c.id && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0, overflow: "hidden" }}
                    animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }}
                    exit={{ height: 0, opacity: 0, overflow: "hidden" }}
                    transition={{ duration: 0.35, ease: "easeInOut" }}
                    className="border-t border-brand-primary/10 mt-6 pt-6 relative z-10"
                  >
                    {status === "success" ? (
                      <motion.div 
                        initial={{ scale: 0.95 }}
                        animate={{ scale: 1 }}
                        className="p-6 bg-emerald-50 rounded-xl border border-emerald-200 text-center space-y-4"
                      >
                        <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                          <h3 className="font-serif font-semibold text-xl text-emerald-800">Booking Confirmed!</h3>
                          <p className="text-sm text-emerald-700 mt-1">You have been added to the walk-in list for {c.name}.</p>
                        </div>
                        <button 
                          onClick={() => openForm(c.id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm cursor-pointer"
                        >
                          Book Another Appointment
                        </button>
                      </motion.div>
                    ) : (
                      <div className="space-y-6 max-w-2xl">
                        {/* Tab Selector */}
                        <div className="flex bg-brand-light/40 p-1.5 rounded-xl border border-brand-primary/5">
                          <button
                            type="button"
                            onClick={() => {
                              setVisitType("first");
                              setVerifiedPatient(null);
                              setVerificationError("");
                            }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer ${
                              visitType === "first" 
                                ? "bg-white text-brand-primary shadow-sm" 
                                : "text-brand-secondary hover:text-brand-primary"
                            }`}
                          >
                            <Heart className="w-4 h-4 shrink-0 text-brand-accent" />
                            First Time Visit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setVisitType("returning");
                              setVerifiedPatient(null);
                              setVerificationError("");
                            }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer ${
                              visitType === "returning" 
                                ? "bg-white text-brand-primary shadow-sm" 
                                : "text-brand-secondary hover:text-brand-primary"
                            }`}
                          >
                            <ShieldCheck className="w-4 h-4 shrink-0 text-brand-accent" />
                            Returning Patient
                          </button>
                        </div>

                        {/* First Time Visit Form */}
                        <AnimatePresence mode="wait">
                          {visitType === "first" ? (
                            <motion.div 
                              key="first-form"
                              initial={{ opacity: 0, x: -15 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 15 }}
                              transition={{ duration: 0.2 }}
                              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                            >
                              <div className="sm:col-span-2">
                                <label className="block text-sm font-semibold text-brand-dark mb-1.5 flex items-center gap-1.5">
                                  <User className="w-4 h-4 text-brand-accent" /> Full Name
                                </label>
                                <input 
                                  className="w-full bg-brand-cream/15 border border-brand-primary/15 rounded-xl px-4 py-3 text-brand-dark focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all duration-150"
                                  value={name} 
                                  onChange={e => setName(e.target.value)} 
                                  placeholder="Full name" 
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-semibold text-brand-dark mb-1.5">Gender</label>
                                <select 
                                  className="w-full bg-brand-cream/15 border border-brand-primary/15 rounded-xl px-4 py-3 text-brand-dark focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all duration-150"
                                  value={gender} 
                                  onChange={e => setGender(e.target.value)}
                                >
                                  <option value="Male">Male</option>
                                  <option value="Female">Female</option>
                                  <option value="Other">Other</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-sm font-semibold text-brand-dark mb-1.5 flex items-center gap-1.5">
                                  <Calendar className="w-4 h-4 text-brand-accent" /> Date of Birth
                                </label>
                                <input 
                                  type="date"
                                  className="w-full bg-brand-cream/15 border border-brand-primary/15 rounded-xl px-4 py-3 text-brand-dark focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all duration-150"
                                  value={dob} 
                                  onChange={e => {
                                    const val = e.target.value;
                                    setDob(val);
                                    setAge(calculateAge(val));
                                  }} 
                                />
                              </div>

                              <div className="sm:col-span-2">
                                <label className="block text-sm font-semibold text-brand-dark mb-1.5 flex items-center gap-1.5">
                                  <Phone className="w-4 h-4 text-brand-accent" /> Mobile Number
                                </label>
                                <input 
                                  type="tel"
                                  className="w-full bg-brand-cream/15 border border-brand-primary/15 rounded-xl px-4 py-3 text-brand-dark focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all duration-150"
                                  value={mobile} 
                                  onChange={e => setMobile(e.target.value)} 
                                  placeholder="10-digit mobile" 
                                />
                              </div>
                            </motion.div>
                          ) : (
                            /* Returning Patient Form */
                            <motion.div 
                              key="returning-form"
                              initial={{ opacity: 0, x: -15 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 15 }}
                              transition={{ duration: 0.2 }}
                              className="space-y-4"
                            >
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-semibold text-brand-dark mb-1.5 flex items-center gap-1.5">
                                    <Phone className="w-4 h-4 text-brand-accent" /> Registered Mobile
                                  </label>
                                  <input 
                                    type="tel"
                                    disabled={!!verifiedPatient}
                                    className="w-full bg-brand-cream/15 disabled:bg-gray-100 border border-brand-primary/15 rounded-xl px-4 py-3 text-brand-dark focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all duration-150"
                                    value={mobile} 
                                    onChange={e => setMobile(e.target.value)} 
                                    placeholder="Enter mobile number" 
                                  />
                                </div>

                                <div>
                                  <label className="block text-sm font-semibold text-brand-dark mb-1.5 flex items-center gap-1.5">
                                    <Calendar className="w-4 h-4 text-brand-accent" /> Date of Birth
                                  </label>
                                  <input 
                                    type="date"
                                    disabled={!!verifiedPatient}
                                    className="w-full bg-brand-cream/15 disabled:bg-gray-100 border border-brand-primary/15 rounded-xl px-4 py-3 text-brand-dark focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all duration-150"
                                    value={dob} 
                                    onChange={e => setDob(e.target.value)} 
                                  />
                                </div>
                              </div>

                              {!verifiedPatient && (
                                <button
                                  type="button"
                                  onClick={handleVerify}
                                  disabled={isVerifying}
                                  className="w-full py-3 bg-brand-secondary hover:bg-brand-primary text-brand-beige rounded-xl font-semibold shadow transition-colors duration-150 cursor-pointer disabled:opacity-50"
                                >
                                  {isVerifying ? "Verifying..." : "Verify Details"}
                                </button>
                              )}

                              {verifiedPatient && (
                                <motion.div 
                                  initial={{ opacity: 0, scale: 0.98 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="p-4 bg-emerald-50/70 border border-emerald-200/60 rounded-xl flex items-start gap-3"
                                >
                                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                                  <div className="text-sm text-emerald-800">
                                    <span className="font-bold">Identity Verified!</span>
                                    <div className="mt-1">
                                      Welcome back, <strong className="text-brand-dark">{verifiedPatient.name}</strong> ({verifiedPatient.gender}, {verifiedPatient.age} yrs).
                                    </div>
                                    <button 
                                      type="button" 
                                      className="text-xs text-brand-accent underline font-semibold mt-1 cursor-pointer" 
                                      onClick={() => {
                                        setVerifiedPatient(null);
                                        setMobile("");
                                        setDob("");
                                      }}
                                    >
                                      Use a different account
                                    </button>
                                  </div>
                                </motion.div>
                              )}

                              {verificationError && (
                                <motion.div 
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3"
                                >
                                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                  <p className="text-sm text-red-800">{verificationError}</p>
                                </motion.div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Common Booking Details */}
                        {(visitType === "first" || verifiedPatient) && (
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="space-y-4 pt-4 border-t border-brand-primary/10"
                          >
                            <div>
                              <label className="block text-sm font-semibold text-brand-dark mb-1.5 flex items-center gap-1.5">
                                <ClipboardList className="w-4 h-4 text-brand-accent" /> Reason for Visit (Optional)
                              </label>
                              <textarea 
                                className="w-full bg-brand-cream/15 border border-brand-primary/15 rounded-xl px-4 py-3 text-brand-dark focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all duration-150 h-20"
                                value={reason} 
                                onChange={e => setReason(e.target.value)} 
                                placeholder="E.g., consultation, follow-up, panchakarma therapy" 
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-semibold text-brand-dark mb-1.5 flex items-center gap-1.5">
                                  <Clock className="w-4 h-4 text-brand-accent" /> Select Time Slot
                                </label>
                                <select 
                                  className="w-full bg-brand-cream/15 border border-brand-primary/15 rounded-xl px-4 py-3 text-brand-dark focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all duration-150 font-semibold"
                                  value={time} 
                                  onChange={e => setTime(e.target.value)}
                                >
                                  <option value="">-- Choose slot --</option>
                                  {c.times.map(t => (
                                    <option key={t} value={t}>{t} PM</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 pt-4">
                              <button 
                                onClick={() => submitBooking(c)}
                                disabled={status === "Booking..."}
                                className="flex-1 bg-brand-primary hover:bg-brand-secondary text-brand-beige py-3.5 rounded-xl font-semibold shadow-md hover:shadow-lg transition-all duration-150 cursor-pointer disabled:opacity-50 text-center"
                              >
                                {status === "Booking..." ? "Booking Slot..." : "Confirm and Add to Walk-in List"}
                              </button>
                              <button 
                                className="text-sm font-semibold text-brand-secondary hover:text-brand-primary px-3 py-2 transition-colors cursor-pointer" 
                                onClick={() => openForm(null)}
                              >
                                Cancel
                              </button>
                            </div>
                            
                            {status && status !== "success" && status !== "Booking..." && (
                              <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-sm text-amber-800"
                              >
                                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                <span>{status}</span>
                              </motion.div>
                            )}
                          </motion.div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
