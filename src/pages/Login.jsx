import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, CheckCircle, AlertCircle, User, Calendar, Phone } from "lucide-react";
import SEO from "../components/SEO";
import { auth } from "../lib/firebase";
import { 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail, 
  createUserWithEmailAndPassword, 
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";

export default function Login() {
  const navigate = useNavigate();

  const [role, setRole] = useState("patient"); // "doctor" | "patient"
  const [mode, setMode] = useState("signin"); // "signin" | "signup" | "forgot" | "linkprofile"

  // Login / Signup fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("Male");
  const [age, setAge] = useState("");
  
  // Google Linking State
  const [googleUserToLink, setGoogleUserToLink] = useState(null);

  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Seed Doctor Account if not present
  useEffect(() => {
    const seed = async () => {
      try {
        const { seedDoctorsIfEmpty } = await import("../lib/patientService.js");
        await seedDoctorsIfEmpty();
      } catch (err) {
        console.error("Failed to seed doctors list:", err);
      }
    };
    seed();

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
    setGoogleUserToLink(null);
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!email || !password) {
      setErrorMsg("Please fill in all fields.");
      return;
    }

    if (email.toLowerCase().trim() === "admin@ayurkaya.com") {
      if (password === "admin123") {
        localStorage.setItem("ayurkaya_admin_logged_in", "true");
        setSuccessMsg("Admin authenticated successfully!");
        setTimeout(() => {
          navigate("/admin");
        }, 1000);
      } else {
        setErrorMsg("Invalid Admin password.");
      }
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (role === "doctor") {
        const { isDoctorAuthorized } = await import("../lib/patientService.js");
        const authorized = await isDoctorAuthorized(email);
        if (!authorized) {
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
        // Enforce Email Verification for Patient logins (except if signed in with Google)
        if (!user.emailVerified) {
          setErrorMsg("Please verify your email address before logging in. Check your inbox for the link we sent.");
          await auth.signOut();
          return;
        }

        const { getPatientsByUid } = await import("../lib/patientService.js");
        const patients = await getPatientsByUid(user.uid);
        if (patients.length === 0) {
          setErrorMsg("Access Denied: No patient profile linked to this account. Please register first.");
          await auth.signOut();
          return;
        }
        localStorage.setItem("ayurkaya_patient_logged_in", "true");
        localStorage.setItem("ayurkaya_patient_uid", user.uid);
        setSuccessMsg(`Welcome back, ${patients[0].name || "Patient"}!`);
        setTimeout(() => {
          navigate("/patient");
        }, 1000);
      }
    } catch (error) {
      console.error("Firebase sign in error:", error);
      setErrorMsg(error?.message || "Invalid email or password credentials.");
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (user.email && user.email.toLowerCase().trim() === "admin@ayurkaya.com") {
        localStorage.setItem("ayurkaya_admin_logged_in", "true");
        setSuccessMsg("Logged in successfully as Admin!");
        setTimeout(() => navigate("/admin"), 1000);
        return;
      }

      const { isDoctorAuthorized, getPatientsByUid } = await import("../lib/patientService.js");
      const isDoc = await isDoctorAuthorized(user.email);
      
      if (isDoc) {
        localStorage.setItem("ayurkaya_doctor_logged_in", "true");
        setSuccessMsg("Logged in successfully as Doctor!");
        setTimeout(() => navigate("/doctor"), 1000);
      } else {
        const patients = await getPatientsByUid(user.uid);
        if (patients.length > 0) {
          localStorage.setItem("ayurkaya_patient_logged_in", "true");
          localStorage.setItem("ayurkaya_patient_uid", user.uid);
          setSuccessMsg(`Welcome back, ${patients[0].name || "Patient"}!`);
          setTimeout(() => navigate("/patient"), 1000);
        } else {
          // Trigger profile linker view
          setGoogleUserToLink({ uid: user.uid, email: user.email });
          setRole("patient");
          setMode("linkprofile");
          setSuccessMsg("Google authenticated! Please enter your details below to link your clinical record.");
        }
      }
    } catch (error) {
      console.error("Google Sign-In Error:", error);
      setErrorMsg(error?.message || "Google Sign-In failed.");
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (role === "doctor") {
      if (!email || !password || !name) {
        setErrorMsg("Please fill in all fields.");
        return;
      }

      try {
        const { isDoctorAuthorized } = await import("../lib/patientService.js");
        const { putItem } = await import("../lib/db.js");

        const authorized = await isDoctorAuthorized(email);
        if (!authorized) {
          setErrorMsg("Access Denied: This email address is not whitelisted as a doctor. Please contact the Admin.");
          return;
        }

        // Register account in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Send Verification Email
        await sendEmailVerification(user);

        // Update the doctor's document in Firestore with their name/UID
        await putItem("doctors", {
          id: email.toLowerCase().trim(),
          email: email.toLowerCase().trim(),
          name: name.trim(),
          uid: user.uid,
          role: "doctor",
          updatedAt: new Date().toISOString()
        });

        // Log out immediately so they must verify
        await auth.signOut();
        setSuccessMsg("Doctor account registered! A verification link was sent to your email. Please verify, then sign in.");
        
        setTimeout(() => {
          changeMode("signin");
        }, 3500);

      } catch (error) {
        console.error("Doctor signup error:", error);
        setErrorMsg(error?.message || "Registration failed.");
      }
      return;
    }

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
      const { findDuplicatePatient, linkPatientToUid, getNextPatientId } = await import("../lib/patientService.js");
      const { putItem } = await import("../lib/db.js");

      // 1. Check duplicate patient
      const existingPatient = await findDuplicatePatient(cleanMobile, dob);

      // 2. Register account in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 3. Send Verification Email
      await sendEmailVerification(user);

      // 4. Link or create Firestore document
      if (existingPatient) {
        await linkPatientToUid(existingPatient.patientId, user.uid, email);
      } else {
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
      }

      // Log out immediately so they must verify and log in
      await auth.signOut();
      setSuccessMsg("Account registered! A verification link was sent to your email. Please verify, then sign in.");
      
      setTimeout(() => {
        changeMode("signin");
      }, 3500);

    } catch (error) {
      console.error("Sign up error:", error);
      setErrorMsg(error?.message || "Registration failed.");
    }
  };

  const handleLinkProfile = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!name || !mobile || !dob || !googleUserToLink) {
      setErrorMsg("Please fill in all fields.");
      return;
    }

    const cleanMobile = mobile.replace(/[^0-9]/g, "");
    if (cleanMobile.length !== 10) {
      setErrorMsg("Please enter a valid 10-digit mobile number.");
      return;
    }

    try {
      const { findDuplicatePatient, linkPatientToUid, getNextPatientId } = await import("../lib/patientService.js");
      const { putItem } = await import("../lib/db.js");

      const existingPatient = await findDuplicatePatient(cleanMobile, dob);

      if (existingPatient) {
        await linkPatientToUid(existingPatient.patientId, googleUserToLink.uid, googleUserToLink.email);
        setSuccessMsg("Account linked to your existing clinical profile successfully!");
      } else {
        const nextId = await getNextPatientId();
        const newPatient = {
          patientId: nextId,
          name: name,
          mobile: cleanMobile,
          dateOfBirth: dob,
          gender: gender,
          age: age || calculateAge(dob) || "N/A",
          uid: googleUserToLink.uid,
          email: googleUserToLink.email,
          createdAt: new Date().toISOString()
        };
        await putItem("patients", newPatient);
        setSuccessMsg("Profile registered and linked to your Google login!");
      }

      localStorage.setItem("ayurkaya_patient_logged_in", "true");
      localStorage.setItem("ayurkaya_patient_uid", googleUserToLink.uid);
      
      setTimeout(() => {
        navigate("/patient");
      }, 1500);

    } catch (err) {
      console.error("Profile linking error:", err);
      setErrorMsg("Failed to link profile to your Google account.");
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
        setSuccessMsg("Password reset email sent! Check your inbox.");
      })
      .catch((error) => {
        console.error("Firebase password reset error:", error);
        setErrorMsg(error?.message || "Failed to send password reset email.");
      });
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center bg-brand-cream/30 px-4 py-12 font-sans relative">
      <SEO 
        title={mode === "signup" ? "Patient Sign Up" : "Secure Portal Access"} 
        description="Login area for the Ayurkaya Clinical Patient Records System."
      />
      
      <div className="absolute inset-0 bg-[radial-gradient(#e8f5e9_1px,transparent_1px)] [background-size:20px_20px] opacity-40 pointer-events-none" />

      <div className="bg-brand-cream border border-brand-light/70 w-full max-w-md rounded-3xl p-6 md:p-10 shadow-lg relative z-10 space-y-6">
        
        {/* Logo Section */}
        <div className="text-center">
          <span className="text-[10px] text-brand-secondary font-bold uppercase tracking-widest block">
            Ayurkaya Clinic
          </span>
          <h2 className="font-serif text-3xl font-bold text-brand-primary mt-1">
            {role === "doctor" ? "Doctor Portal" : role === "admin" ? "Admin Portal" : "Patient Portal"}
          </h2>
          <p className="text-xs text-brand-dark/65 mt-1 font-sans">
            {role === "doctor" ? "Secure Access for Clinical Administration" : role === "admin" ? "Configure Doctor & Patient Registry" : "Access your clinical records, prescriptions & lab results"}
          </p>
        </div>

        {/* Role Switcher tabs */}
        {mode !== "forgot" && mode !== "linkprofile" && (
          <div className="flex bg-brand-beige p-1 rounded-xl border border-brand-light/35 flex-wrap gap-1">
            <button
              onClick={() => {
                setRole("patient");
                changeMode("signin");
              }}
              className={`flex-1 min-w-[80px] py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                role === "patient"
                  ? "bg-brand-primary text-brand-beige shadow-sm"
                  : "text-brand-primary hover:bg-brand-light/30"
              }`}
            >
              Patient
            </button>
            <button
              onClick={() => {
                setRole("doctor");
                changeMode("signin");
              }}
              className={`flex-1 min-w-[80px] py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                role === "doctor"
                  ? "bg-brand-primary text-brand-beige shadow-sm"
                  : "text-brand-primary hover:bg-brand-light/30"
              }`}
            >
              Doctor
            </button>
            <button
              onClick={() => {
                setRole("admin");
                changeMode("signin");
              }}
              className={`flex-1 min-w-[80px] py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                role === "admin"
                  ? "bg-brand-primary text-brand-beige shadow-sm"
                  : "text-brand-primary hover:bg-brand-light/30"
              }`}
            >
              Admin
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
          <div className="space-y-4">
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="relative">
                <label className="block text-[10px] font-bold text-brand-primary uppercase tracking-wider mb-2">Email Address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-secondary/70" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={role === "doctor" ? "drneha@ayurkaya.com" : role === "admin" ? "admin@ayurkaya.com" : "patient@example.com"}
                    className="w-full bg-brand-beige border border-brand-light/50 pl-11 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:border-brand-secondary transition-all"
                    required
                  />
                </div>
              </div>

              <div className="relative">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-[10px] font-bold text-brand-primary uppercase tracking-wider">Password</label>
                  {role !== "admin" && (
                    <button
                      type="button"
                      onClick={() => changeMode("forgot")}
                      className="text-[10px] font-bold text-brand-secondary hover:text-brand-primary uppercase tracking-wider"
                    >
                      Forgot?
                    </button>
                  )}
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
            </form>

            {role !== "admin" && (
              <>
                {/* Google Sign In Divider & Button */}
                <div className="relative flex items-center justify-center my-4">
                  <div className="absolute w-full border-t border-brand-light/45" />
                  <span className="relative bg-brand-cream px-3 text-[10px] font-bold text-brand-secondary uppercase tracking-widest">or login with</span>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="w-full bg-white border border-brand-light hover:bg-brand-light/20 text-brand-primary py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.2-5.177 4.2-3.414 0-6.182-2.768-6.182-6.182s2.768-6.182 6.182-6.182c1.488 0 2.852.531 3.921 1.405l3.125-3.125C18.91 1.942 15.772 1 12.24 1 5.673 1 .327 6.346.327 12.913S5.673 24.825 12.24 24.825c6.262 0 11.233-5.064 11.233-11.233 0-.663-.08-1.295-.224-1.907l-11.009-.4z"/>
                  </svg>
                  Google Account
                </button>
              </>
            )}

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
          </div>
        )}

        {mode === "signup" && (role === "patient" || role === "doctor") && (
          <form onSubmit={handleSignUp} className="space-y-4">
            {role === "patient" ? (
              <>
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
              </>
            ) : (
              <div>
                <label className="block text-[10px] font-bold text-brand-primary uppercase tracking-wider mb-2">Full Name</label>
                <div className="relative">
                  <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-secondary/70" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Dr. Firstname Lastname"
                    className="w-full bg-brand-beige border border-brand-light/50 pl-11 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:border-brand-secondary"
                    required
                  />
                </div>
              </div>
            )}

            <div className="relative">
              <label className="block text-[10px] font-bold text-brand-primary uppercase tracking-wider mb-2">Email Address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-secondary/70" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={role === "doctor" ? "drneha@ayurkaya.com" : "patient@example.com"}
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

        {mode === "linkprofile" && (
          <form onSubmit={handleLinkProfile} className="space-y-4">
            <h3 className="font-serif text-lg font-bold text-brand-primary border-b border-brand-light/20 pb-1 text-center">
              Complete Your Registration
            </h3>
            <p className="text-[10px] text-brand-secondary/80 text-center font-medium leading-relaxed">
              Verify your Mobile & DOB to fetch your medical files or create a new profile.
            </p>

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

            <button
              type="submit"
              className="w-full bg-brand-primary text-brand-beige hover:bg-brand-secondary py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-md mt-2 cursor-pointer"
            >
              Verify & Link Record
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => changeMode("signin")}
                className="text-xs text-brand-secondary hover:text-brand-primary underline font-medium"
              >
                Cancel and Go Back
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
