import React, { useState } from "react";
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
    name: "Aayushree Ayurved Polyclinic & Panchakarma Center",
    address: `Shop No. 1 & 2, Shreeyash Building,\nBehind Link View Hotel,\nPandit Malharrao Kulkarni Road,\nBorivali (West), Mumbai – 400092, Maharashtra`,
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
      if (!age || isNaN(age) || parseInt(age, 10) <= 0) return setStatus("Please enter a valid age.");
      if (!gender) return setStatus("Please select your gender.");
      if (!mobile.trim() || mobile.replace(/[^0-9]/g, "").length < 10) return setStatus("Please enter a valid 10-digit mobile number.");
      if (!dob) return setStatus("Please select your date of birth.");

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
                  <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded bg-brand-light text-brand-primary text-xs font-semibold">
                    🌿 {c.days}
                  </div>
                  <h2 className="font-serif font-semibold text-2xl text-brand-dark">{c.name}</h2>
                  <p className="text-sm leading-relaxed whitespace-pre-line text-brand-secondary/90">{c.address}</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-sm text-brand-secondary">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-brand-accent shrink-0" />
                      <span>7:00 PM – 9:00 PM IST</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <PhoneCall className="w-4 h-4 text-brand-accent shrink-0" />
                      <span className="hover:text-brand-primary transition-colors">{c.contact}</span>
                    </div>
                  </div>
                </div>

                <div className="w-full md:w-auto shrink-0 pt-4 md:pt-0">
                  <button 
                    onClick={() => openForm(c.id)}
                    className="w-full md:w-auto bg-brand-primary text-brand-beige hover:bg-brand-secondary active:scale-[0.98] px-6 py-3.5 rounded-xl font-semibold shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer text-center"
                  >
                    {openClinic === c.id ? "Close Form" : "Book Appointment"}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {openClinic === c.id && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.35, ease: "easeInOut" }}
                    className="overflow-hidden border-t border-brand-primary/10 mt-6 pt-6 relative z-10"
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
                                <label className="block text-sm font-semibold text-brand-dark mb-1.5">Age</label>
                                <input 
                                  type="number"
                                  className="w-full bg-brand-cream/15 border border-brand-primary/15 rounded-xl px-4 py-3 text-brand-dark focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all duration-150"
                                  value={age} 
                                  onChange={e => setAge(e.target.value)} 
                                  placeholder="Years" 
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

                              <div>
                                <label className="block text-sm font-semibold text-brand-dark mb-1.5 flex items-center gap-1.5">
                                  <Calendar className="w-4 h-4 text-brand-accent" /> Date of Birth
                                </label>
                                <input 
                                  type="date"
                                  className="w-full bg-brand-cream/15 border border-brand-primary/15 rounded-xl px-4 py-3 text-brand-dark focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all duration-150"
                                  value={dob} 
                                  onChange={e => setDob(e.target.value)} 
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
                                {status === "Booking..." ? "Booking Slot..." : "Confirm & Add to Walk-in List"}
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
