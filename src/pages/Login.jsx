import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";
import SEO from "../components/SEO";
import { auth } from "../lib/firebase";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState("signin"); // "signin" | "forgot"

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

  const changeMode = (newMode) => {
    setMode(newMode);
    setErrorMsg("");
    setSuccessMsg("");
    setPassword("");
  };

  const handleSignIn = (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!email || !password) {
      setErrorMsg("Please fill in all fields.");
      return;
    }

    signInWithEmailAndPassword(auth, email, password)
      .then(() => {
        localStorage.setItem("ayurkaya_doctor_logged_in", "true");
        setSuccessMsg("Doctor authenticated successfully!");
        setTimeout(() => {
          navigate("/doctor");
        }, 1000);
      })
      .catch((error) => {
        console.error("Firebase sign in error:", error);
        // Show the real Firebase error message in the UI for debugging
        setErrorMsg(error?.message || "Invalid doctor email or password credentials.");
      });
  };

  const handleForgotSubmit = (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!email) {
      setErrorMsg("Please enter your email address.");
      return;
    }

    // Send password reset email directly via Firebase Auth
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
        title="Doctor Portal Access" 
        description="Doctor-only login area for the Ayurkaya Clinical Patient Records System."
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
            Doctor Portal
          </h2>
          <p className="text-xs text-brand-dark/65 mt-1 font-sans">
            Secure Access for Clinical Administration and Patient Records
          </p>
        </div>

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
        {mode === "signin" ? (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="relative">
              <label className="block text-[10px] font-bold text-brand-primary uppercase tracking-wider mb-2">Doctor Email Address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-secondary/70" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="drneha@ayurkaya.com"
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
              Sign In to Doctor Portal
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <h3 className="font-serif text-lg font-bold text-brand-primary border-b border-brand-light/20 pb-1 text-center">
              Password Recovery
            </h3>

            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div className="relative">
                <label className="block text-[10px] font-bold text-brand-primary uppercase tracking-wider mb-2">Enter Doctor Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-secondary/70" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="drneha@ayurkaya.com"
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
