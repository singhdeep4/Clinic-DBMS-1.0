import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, CheckCircle, AlertCircle, User, Calendar, Phone } from "lucide-react";
import SEO from "../components/SEO";
import { auth } from "../lib/firebase";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";

export default function Login() {
  const navigate = useNavigate();

  const [role, setRole] = useState("patient"); // "doctor" | "patient"
  const [mode, setMode] = useState("signin"); // "signin" | "signup" | "forgot"

  // Login / Signup fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("Male");
  const [age, setAge] = useState("");
  
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Seed Doctor Account if not present
  useEffect(() => {
    const docAccount = localStorage.getItem("ayurkaya_doctor_account");
    if (!docAccount) {
      localStorage.setItem(
        "ayurkaya_doctor_account",
        JSON.stringify({
          email: "drneha@ayurkaya.com",
          password: "DrNehaAyurkaya1@",
          name: "Dr. Neha",
          passcode: "1008"
        })
      );
    }
  }, []);

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

  const changeMode = (newMode) => {
    setMode(newMode);
    setErrorMsg("");
    setSuccessMsg("");
    setPassword("");
    setName("");
    setMobile("");
    setDob("");
    setAge("");
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!email || !password) {
      setErrorMsg("Please fill in all fields.");
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (role === "doctor") {
        const allowedDoctors = ["drneha@ayurkaya.com", "deep2006deep@gmail.com"];
        if (!allowedDoctors.includes(email.toLowerCase())) {
          setErrorMsg("Access Denied: This account is not authorized as a doctor.");
          await auth.signOut();
          return;
        }
        localStorage.setItem("ayurkaya_doctor_logged_in", "true");
        setSuccessMsg("Doctor authenticated successfully!");
        setTimeout(() => {
          navigate("/doctor");
        }, 1000);
      } else {
        const { getPatientByUid } = await import("../lib/patientService.js");
        const patient = await getPatientByUid(user.uid);
        if (!patient) {
          setErrorMsg("Access Denied: No patient profile linked to this account. Please register first.");
          await auth.signOut();
          return;
        }
        localStorage.setItem("ayurkaya_patient_logged_in", "true");
        localStorage.setItem("ayurkaya_patient_uid", user.uid);
        setSuccessMsg(`Welcome back, ${patient.name || "Patient"}!`);
        setTimeout(() => {
          navigate("/patient");
        }, 1000);
      }
    } catch (error) {
      console.error("Firebase sign in error:", error);
      setErrorMsg(error?.message || "Invalid email or password credentials.");
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!email || !password || !name || !mobile || !dob) {
      setErrorMsg("Please fill in all fields.");
      return;
    }

    const cleanMobile = mobile.replace(/[^0-9]/g, "");
    if (cleanMobile.length !== 10) {
      setErrorMsg("Please enter a valid 10-digit mobile number.");
      return;
    }

    try {
      const { createUserWithEmailAndPassword } = await import("firebase/auth");
      const { findDuplicatePatient, linkPatientToUid, getNextPatientId } = await import("../lib/patientService.js");
      const { putItem } = await import("../lib/db.js");

      // 1. Check if patient already exists by phone + dob
      const existingPatient = await findDuplicatePatient(cleanMobile, dob);

      // 2. Create user account in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (existingPatient) {
        // Link existing patient doc
        await linkPatientToUid(existingPatient.patientId, user.uid, email);
        setSuccessMsg("Account created and linked to your existing clinical profile successfully!");
      } else {
        // Create new patient doc
        const nextId = await getNextPatientId();
        const newPatient = {
          patientId: nextId,
          name: name,
          mobile: cleanMobile,
          dateOfBirth: dob,
          gender: gender,
          age: age || calculateAge(dob) || "N/A",
          uid: user.uid,
          email: email,
          createdAt: new Date().toISOString()
        };
        await putItem("patients", newPatient);
        setSuccessMsg("Your patient account was registered successfully!");
      }

      localStorage.setItem("ayurkaya_patient_logged_in", "true");
      localStorage.setItem("ayurkaya_patient_uid", user.uid);
      
      setTimeout(() => {
        navigate("/patient");
      }, 1500);

    } catch (error) {
      console.error("Sign up error:", error);
      setErrorMsg(error?.message || "Registration failed. Try a different email address.");
    }
  };

  const handleForgotSubmit = (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!email) {
      setErrorMsg("Please enter your email address.");
      return;
    }

    sendPasswordResetEmail(auth, email)
      .then(() => {
        setSuccessMsg("Password reset email sent! Check your inbox (and spam folder) for the reset link.");
      })
      .catch((error) => {
        console.error("Firebase password reset error:", error);
        setErrorMsg(error?.message || "Failed to send password reset email. Ensure the email is registered.");
      });
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center bg-brand-cream/30 px-4 py-12 font-sans relative">
      <SEO 
        title={mode === "signup" ? "Patient Sign Up" : "Secure Portal Access"} 
        description="Login area for the Ayurkaya Clinical Patient Records System."
      />
      
      {/* Grid Pattern Background */}
      <div className="absolute inset-0 bg-[radial-gradient(#e8f5e9_1px,transparent_1px)] [background-size:20px_20px] opacity-40 pointer-events-none" />

      {/* Main card panel */}
      <div className="bg-brand-cream border border-brand-light/70 w-full max-w-md rounded-3xl p-6 md:p-10 shadow-lg relative z-10 space-y-6">
        
        {/* Logo Section */}
        <div className="text-center">
          <span className="text-[10px] text-brand-secondary font-bold uppercase tracking-widest block">
            Ayurkaya Clinic
          </span>
          <h2 className="font-serif text-3xl font-bold text-brand-primary mt-1">
            {role === "doctor" ? "Doctor Portal" : "Patient Portal"}
          </h2>
          <p className="text-xs text-brand-dark/65 mt-1 font-sans">
            {role === "doctor" ? "Secure Access for Clinical Administration" : "Access your clinical records, prescriptions & lab results"}
          </p>
        </div>

        {/* Role Switcher tabs (Only show when not in forgot password mode) */}
        {mode !== "forgot" && (
          <div className="flex bg-brand-beige p-1 rounded-xl border border-brand-light/35">
            <button
              onClick={() => {
                setRole("patient");
                changeMode("signin");
              }}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                role === "patient"
                  ? "bg-brand-primary text-brand-beige shadow-sm"
                  : "text-brand-primary hover:bg-brand-light/30"
              }`}
            >
              Patient Portal
            </button>
            <button
              onClick={() => {
                setRole("doctor");
                changeMode("signin");
              }}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                role === "doctor"
                  ? "bg-brand-primary text-brand-beige shadow-sm"
                  : "text-brand-primary hover:bg-brand-light/30"
              }`}
            >
              Doctor Access
            </button>
          </div>
        )}

        {/* Errors and Success alerts */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-100 p-3 rounded-xl flex items-center gap-2.5 text-xs text-red-700 font-semibold">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex items-center gap-2.5 text-xs text-emerald-700 font-semibold">
            <CheckCircle size={16} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* forms */}
        {mode === "signin" && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="relative">
              <label className="block text-[10px] font-bold text-brand-primary uppercase tracking-wider mb-2">Email Address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-secondary/70" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={role === "doctor" ? "drneha@ayurkaya.com" : "patient@example.com"}
                  className="w-full bg-brand-beige border border-brand-light/50 pl-11 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:border-brand-secondary transition-all"
                  required
                />
              </div>
            </div>

            <div className="relative">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-[10px] font-bold text-brand-primary uppercase tracking-wider">Password</label>
                <button
                  type="button"
                  onClick={() => changeMode("forgot")}
                  className="text-[10px] font-bold text-brand-secondary hover:text-brand-primary uppercase tracking-wider"
                >
                  Forgot?
                </button>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-secondary/70" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-brand-beige border border-brand-light/50 pl-11 pr-10 py-3 rounded-xl text-sm focus:outline-none focus:border-brand-secondary transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-brand-secondary/60 hover:text-brand-primary"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-brand-primary text-brand-beige hover:bg-brand-secondary py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-md mt-2 cursor-pointer"
            >
              Sign In
            </button>

            {role === "patient" && (
              <div className="text-center pt-2 text-xs font-medium text-brand-secondary">
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => changeMode("signup")}
                  className="text-brand-primary font-bold hover:underline"
                >
                  Sign Up / Register
                </button>
              </div>
            )}
          </form>
        )}

        {mode === "signup" && role === "patient" && (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-brand-primary uppercase tracking-wider mb-2">Full Name</label>
                <div className="relative">
                  <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-secondary/70" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full bg-brand-beige border border-brand-light/50 pl-11 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:border-brand-secondary"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-brand-primary uppercase tracking-wider mb-2">Mobile Number</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-secondary/70" />
                  <input
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="10-digit mobile"
                    className="w-full bg-brand-beige border border-brand-light/50 pl-11 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:border-brand-secondary"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-brand-primary uppercase tracking-wider mb-2">Date of Birth</label>
                <div className="relative">
                  <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-secondary/70" />
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => {
                      setDob(e.target.value);
                      setAge(calculateAge(e.target.value));
                    }}
                    className="w-full bg-brand-beige border border-brand-light/50 pl-11 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:border-brand-secondary"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-brand-primary uppercase tracking-wider mb-2">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full bg-brand-beige border border-brand-light/50 px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-brand-secondary"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="relative">
              <label className="block text-[10px] font-bold text-brand-primary uppercase tracking-wider mb-2">Email Address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-secondary/70" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="patient@example.com"
                  className="w-full bg-brand-beige border border-brand-light/50 pl-11 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:border-brand-secondary"
                  required
                />
              </div>
            </div>

            <div className="relative">
              <label className="block text-[10px] font-bold text-brand-primary uppercase tracking-wider mb-2">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-secondary/70" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-brand-beige border border-brand-light/50 pl-11 pr-10 py-3 rounded-xl text-sm focus:outline-none focus:border-brand-secondary"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-brand-secondary/60"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-brand-primary text-brand-beige hover:bg-brand-secondary py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-md mt-2 cursor-pointer"
            >
              Register & Sign Up
            </button>

            <div className="text-center pt-2 text-xs font-medium text-brand-secondary">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => changeMode("signin")}
                className="text-brand-primary font-bold hover:underline"
              >
                Sign In
              </button>
            </div>
          </form>
        )}

        {mode === "forgot" && (
          <div className="space-y-4">
            <h3 className="font-serif text-lg font-bold text-brand-primary border-b border-brand-light/20 pb-1 text-center">
              Password Recovery
            </h3>

            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div className="relative">
                <label className="block text-[10px] font-bold text-brand-primary uppercase tracking-wider mb-2">Enter Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-secondary/70" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter registered email"
                    className="w-full bg-brand-beige border border-brand-light/50 pl-11 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:border-brand-secondary"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-brand-primary text-brand-beige hover:bg-brand-secondary py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer"
              >
                Send Password Reset Email
              </button>
            </form>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => changeMode("signin")}
                className="text-xs text-brand-secondary hover:text-brand-primary underline font-medium"
              >
                Back to Sign In
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
