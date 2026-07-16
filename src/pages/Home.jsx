import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  UserPlus, Search, FileText, Clock, Users,
  CalendarDays, Stethoscope, ArrowRight, Leaf, LogOut,
  ClipboardList, TrendingUp, CheckCircle2
} from "lucide-react";
import SEO from "../components/SEO";
import { getAllItems, syncFromCloud } from "../lib/db";
import PatientHome from "./PatientHome";

// Greeting based on time of day
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
};

// Format date nicely
const formatDate = (date) => {
  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatTime = (date) => {
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

const quickActions = [
  {
    icon: UserPlus,
    title: "New Consultation",
    desc: "Register a new patient and begin clinical assessment",
    color: "from-emerald-600 to-emerald-700",
    hoverColor: "group-hover:from-emerald-700 group-hover:to-emerald-800",
    iconBg: "bg-emerald-500/20",
    link: "/doctor",
  },
  {
    icon: Search,
    title: "Patient Search",
    desc: "Find existing patient records by name or mobile number",
    color: "from-brand-primary to-brand-secondary",
    hoverColor: "group-hover:from-brand-secondary group-hover:to-brand-primary",
    iconBg: "bg-brand-light/30",
    link: "/doctor",
  },
  {
    icon: FileText,
    title: "Follow-Up Review",
    desc: "Continue treatment and track patient progress over visits",
    color: "from-amber-600 to-amber-700",
    hoverColor: "group-hover:from-amber-700 group-hover:to-amber-800",
    iconBg: "bg-amber-500/20",
    link: "/doctor",
  },
  {
    icon: ClipboardList,
    title: "Today's Queue",
    desc: "Manage walk-in appointments and consultation order",
    color: "from-sky-600 to-sky-700",
    hoverColor: "group-hover:from-sky-700 group-hover:to-sky-800",
    iconBg: "bg-sky-500/20",
    link: "/doctor",
  },
];

export default function Home() {
  const navigate = useNavigate();
  const isAuthenticated = localStorage.getItem("ayurkaya_doctor_logged_in") === "true";
  const isLoading = false;
  const [currentTime, setCurrentTime] = useState(new Date());
  const [doctorName, setDoctorName] = useState(() => {
    return localStorage.getItem("ayurkaya_doctor_name") || "";
  });

  useEffect(() => {
    let unsubscribe = () => {};
    if (isAuthenticated) {
      async function loadDoctorProfile() {
        try {
          const { auth } = await import("../lib/firebase.js");
          unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (user && user.email) {
              const { isDoctorAuthorized } = await import("../lib/patientService.js");
              const profile = await isDoctorAuthorized(user.email);
              if (profile && profile.name) {
                setDoctorName(profile.name);
                localStorage.setItem("ayurkaya_doctor_name", profile.name);
              } else {
                setDoctorName(user.email);
                localStorage.setItem("ayurkaya_doctor_name", user.email);
              }
            }
          });
        } catch (err) {
          console.error("Error loading doctor profile in Home:", err);
        }
      }
      loadDoctorProfile();
    }
    return () => unsubscribe();
  }, [isAuthenticated]);

  const getFormattedDocName = () => {
    if (!doctorName) return "";
    if (doctorName.toLowerCase().startsWith("dr")) return doctorName;
    return `Dr. ${doctorName}`;
  };

  // Dashboard data
  const [totalPatients, setTotalPatients] = useState(0);
  const [todayQueueCount, setTodayQueueCount] = useState(0);
  const [revisitPendingPatients, setRevisitPendingPatients] = useState([]);
  const [revisitSearchTerm, setRevisitSearchTerm] = useState("");
  const [liveQueue, setLiveQueue] = useState([]);
  const [pendingFollowUps, setPendingFollowUps] = useState(0);

  // Auth check is now initialized synchronously in state

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Load dashboard data
  useEffect(() => {
    if (!isAuthenticated) return;

    async function loadDashboardData() {
      try {
        // Sync latest records from Firebase cloud database
        await syncFromCloud();
        // Load patients
        const patients = await getAllItems("patients");
        setTotalPatients(patients.length);

        // Build latest visit map
        const visits = await getAllItems("visits");
        const patientVisitsMap = {};
        visits.forEach((v) => {
          if (
            !patientVisitsMap[v.patientId] ||
            new Date(v.visitDate) >
              new Date(patientVisitsMap[v.patientId].visitDate)
          ) {
            patientVisitsMap[v.patientId] = v;
          }
        });

        const enrichedPatients = patients.map((p) => {
          const latestVisit = patientVisitsMap[p.patientId];
          let rating = latestVisit?.wellnessRating;
          if (rating === undefined || rating === null) {
            // fallback mapping from outcomeScore
            const outcomeStr = (latestVisit?.outcomeScore || "No Improvement").toLowerCase();
            rating = 1;
            if (outcomeStr.includes("marked")) rating = 5;
            else if (outcomeStr.includes("moderate")) rating = 4;
            else if (outcomeStr.includes("mild")) rating = 3;
            else if (outcomeStr.includes("minimal")) rating = 2;
            else if (outcomeStr.includes("no improvement") || outcomeStr.includes("worsened")) rating = 1;
          }

          return {
            ...p,
            visitDate: latestVisit
              ? latestVisit.visitDate
              : p.createdAt || p.updatedAt,
            wellnessRating: rating,
            nextFollowUp: latestVisit?.nextFollowUp || null,
            chiefComplaint: latestVisit?.chiefComplaints?.[0]?.text || p.reason || "Routine Consultation"
          };
        });

        // Calculate Revisit Pending patients (rating < 5 AND last visit <= 14 days ago)
        const now = new Date();
        const pending = enrichedPatients.filter((p) => {
          if (!p.visitDate) return false;
          const visitDate = new Date(p.visitDate);
          const diffTime = now.getTime() - visitDate.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          return p.wellnessRating < 5 && diffDays <= 14;
        });

        // Sort by wellnessRating ascending (most severe first) then by date descending
        pending.sort((a, b) => a.wellnessRating - b.wellnessRating || new Date(b.visitDate) - new Date(a.visitDate));
        
        setRevisitPendingPatients(pending);
        setPendingFollowUps(pending.length);

        // Load queue
        const queue = await getAllItems("queue");
        setLiveQueue(queue);

        // Count today's queue items
        const today = new Date().toDateString();
        const todayItems = queue.filter((q) => {
          const qDate = new Date(q.timestamp || q.createdAt);
          return qDate.toDateString() === today;
        });
        setTodayQueueCount(todayItems.length);
      } catch (err) {
        console.error("Error loading dashboard data:", err);
      }
    }
    loadDashboardData();
  }, [isAuthenticated]);

  // Auto-refresh queue every 15s
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(async () => {
      const queue = await getAllItems("queue");
      setLiveQueue(queue);
      const today = new Date().toDateString();
      const todayItems = queue.filter((q) => {
        const qDate = new Date(q.timestamp || q.createdAt);
        return qDate.toDateString() === today;
      });
      setTodayQueueCount(todayItems.length);
    }, 15000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const handleLogout = () => {
    localStorage.removeItem("ayurkaya_doctor_logged_in");
    navigate("/login");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-beige">
        <div className="animate-pulse flex items-center gap-3">
          <Leaf size={24} className="text-brand-primary animate-spin" />
          <span className="text-brand-secondary font-semibold text-sm">
            Loading Dashboard...
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <PatientHome />;
  }

  const statusBadge = (status) => {
    const styles = {
      Waiting:
        "bg-amber-100 text-amber-800 border-amber-200",
      "In-Progress":
        "bg-sky-100 text-sky-800 border-sky-200",
      Completed:
        "bg-emerald-100 text-emerald-800 border-emerald-200",
      Cancelled:
        "bg-red-100 text-red-800 border-red-200",
    };
    return (
      <span
        className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
          styles[status] || "bg-gray-100 text-gray-700 border-gray-200"
        }`}
      >
        {status}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-brand-beige pb-16">
      <SEO
        title="Dashboard"
        description="Ayurkaya Clinical Dashboard — Manage patients, appointments, and consultations."
      />

      {/* ─── Header Section ─── */}
      <div className="bg-gradient-to-br from-brand-primary via-brand-secondary to-brand-primary/90 text-brand-beige">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-light/80">
                  Clinical Dashboard
                </span>
              </div>
              <h1 className="font-serif text-3xl md:text-4xl font-bold leading-tight">
                {getGreeting()}, {getFormattedDocName()}
              </h1>
              <p className="text-sm text-brand-light/75 mt-1.5 font-sans flex items-center gap-2">
                <CalendarDays size={14} />
                {formatDate(currentTime)} · {formatTime(currentTime)}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="flex items-center gap-3"
            >
              <Link
                to="/doctor"
                className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm hover:bg-white/25 border border-white/20 text-brand-beige px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
              >
                <Stethoscope size={14} />
                Open Doctor Portal
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-red-500/30 border border-white/15 text-brand-beige px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                <LogOut size={14} />
                Sign Out
              </button>
            </motion.div>
          </div>
        </div>
      </div>

      {/* ─── Stats Row ─── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          {/* Total Patients */}
          <motion.div
            variants={itemVariants}
            className="bg-white border border-brand-light/50 rounded-2xl p-5 shadow-sm flex items-center gap-4"
          >
            <div className="h-12 w-12 rounded-xl bg-brand-light flex items-center justify-center shrink-0">
              <Users size={22} className="text-brand-primary" />
            </div>
            <div>
              <p className="text-2xl font-serif font-bold text-brand-primary">
                {totalPatients}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-secondary/70">
                Total Patients
              </p>
            </div>
          </motion.div>

          {/* Today's Queue */}
          <motion.div
            variants={itemVariants}
            className="bg-white border border-brand-light/50 rounded-2xl p-5 shadow-sm flex items-center gap-4"
          >
            <div className="h-12 w-12 rounded-xl bg-sky-100 flex items-center justify-center shrink-0">
              <Clock size={22} className="text-sky-600" />
            </div>
            <div>
              <p className="text-2xl font-serif font-bold text-brand-primary">
                {todayQueueCount}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-secondary/70">
                In Queue Today
              </p>
            </div>
          </motion.div>

          {/* Pending Follow-ups */}
          <motion.div
            variants={itemVariants}
            className="bg-white border border-brand-light/50 rounded-2xl p-5 shadow-sm flex items-center gap-4"
          >
            <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <TrendingUp size={22} className="text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-serif font-bold text-brand-primary">
                {pendingFollowUps}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-secondary/70">
                Revisits Pending
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* ─── Quick Actions ─── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-serif text-xl font-bold text-brand-primary">
            Quick Actions
          </h2>
          <span className="text-[10px] font-bold text-brand-secondary/50 uppercase tracking-widest">
            Clinical Workflow
          </span>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {quickActions.map((action, idx) => (
            <motion.div key={idx} variants={itemVariants}>
              <Link
                to={action.link}
                className="group block relative overflow-hidden rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300"
              >
                <div
                  className={`bg-gradient-to-br ${action.color} ${action.hoverColor} p-6 transition-all duration-300 h-full`}
                >
                  <div
                    className={`h-11 w-11 rounded-xl ${action.iconBg} flex items-center justify-center mb-4`}
                  >
                    <action.icon size={22} className="text-white" />
                  </div>
                  <h3 className="font-serif text-lg font-bold text-white mb-1.5">
                    {action.title}
                  </h3>
                  <p className="text-[11px] text-white/75 leading-relaxed font-sans">
                    {action.desc}
                  </p>
                  <div className="flex items-center gap-1 mt-4 text-white/60 group-hover:text-white/90 transition-colors text-[10px] font-bold uppercase tracking-wider">
                    Open <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* ─── Two-Column: Queue & Recent Patients ─── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's Queue Panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="bg-white border border-brand-light/50 rounded-2xl shadow-sm overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-brand-light/30 bg-brand-beige/50">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-sky-100 flex items-center justify-center">
                  <Clock size={16} className="text-sky-600" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-bold text-brand-primary leading-tight">
                    Today's Queue
                  </h3>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-brand-secondary/50">
                    Live · Auto-refreshes
                  </p>
                </div>
              </div>
              <Link
                to="/doctor"
                className="text-[10px] font-bold text-brand-primary hover:text-brand-secondary uppercase tracking-wider flex items-center gap-1 transition-colors"
              >
                Manage <ArrowRight size={10} />
              </Link>
            </div>

            <div className="divide-y divide-brand-light/20 max-h-[210px] overflow-y-auto scrollbar-none">
              {liveQueue.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <div className="h-12 w-12 rounded-full bg-brand-light/50 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 size={20} className="text-brand-secondary/50" />
                  </div>
                  <p className="text-sm text-brand-secondary/60 font-semibold">
                    No patients in queue
                  </p>
                  <p className="text-[10px] text-brand-dark/40 mt-1">
                    New walk-ins will appear here automatically
                  </p>
                </div>
              ) : (
                liveQueue.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="px-6 py-3.5 flex items-center justify-between hover:bg-brand-beige/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-brand-light flex items-center justify-center text-brand-primary font-bold text-xs shrink-0">
                        {(item.name || "?")[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-brand-primary leading-tight">
                          {item.name || "Unknown"}
                        </p>
                        <p className="text-[10px] text-brand-dark/50">
                          {item.mobile || item.reason || "Walk-in"}
                        </p>
                      </div>
                    </div>
                    {statusBadge(item.status || "Waiting")}
                  </div>
                ))
              )}
            </div>
          </motion.div>

          {/* Revisit Pending Patients Panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="bg-white border border-brand-light/50 rounded-2xl shadow-sm overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-brand-light/30 bg-brand-beige/50 flex-wrap gap-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center">
                  <TrendingUp size={16} className="text-amber-600" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-bold text-brand-primary leading-tight">
                    Revisit Pending
                  </h3>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-brand-secondary/50">
                    Cured/Removed after 2 weeks
                  </p>
                </div>
              </div>
              
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-secondary/50 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search name or phone..."
                  value={revisitSearchTerm}
                  onChange={(e) => setRevisitSearchTerm(e.target.value)}
                  className="bg-brand-beige border border-brand-light/60 pl-7 pr-3 py-1.5 rounded-lg text-[10px] focus:outline-none w-44 font-medium"
                />
              </div>
            </div>

            <div className="divide-y divide-brand-light/20 max-h-[246px] overflow-y-auto scrollbar-none">
              {(() => {
                const filteredRevisits = revisitPendingPatients.filter(
                  (p) =>
                    (p.name || "").toLowerCase().includes(revisitSearchTerm.toLowerCase()) ||
                    (p.mobile || "").includes(revisitSearchTerm)
                );

                if (filteredRevisits.length === 0) {
                  return (
                    <div className="px-6 py-10 text-center">
                      <div className="h-12 w-12 rounded-full bg-brand-light/50 flex items-center justify-center mx-auto mb-3">
                        <CheckCircle2 size={20} className="text-brand-secondary/50" />
                      </div>
                      <p className="text-sm text-brand-secondary/60 font-semibold">
                        No pending revisits
                      </p>
                      <p className="text-[10px] text-brand-dark/40 mt-1">
                        Active patients without a 5/5 wellness score will show here
                      </p>
                    </div>
                  );
                }

                return filteredRevisits.map((patient, idx) => {
                  const badges = {
                    1: "bg-red-50 text-red-700 border-red-200",
                    2: "bg-orange-50 text-orange-700 border-orange-200",
                    3: "bg-yellow-50 text-yellow-800 border-yellow-250",
                    4: "bg-lime-50 text-lime-700 border-lime-200",
                  };
                  const labels = {
                    1: "1/5 Severe",
                    2: "2/5 Mild",
                    3: "3/5 Moderate",
                    4: "4/5 Better",
                  };
                  
                  return (
                    <Link
                      to={`/doctor?patientId=${patient.patientId}&activeTab=labs`}
                      key={patient.patientId || idx}
                      className="px-6 py-3.5 flex items-center justify-between hover:bg-brand-beige/50 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center text-brand-beige font-bold text-xs shrink-0">
                          {(patient.name || "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-brand-primary leading-tight group-hover:text-brand-secondary transition-colors">
                            {patient.name || "Unknown"}
                          </p>
                          <p className="text-[10px] text-brand-dark/50">
                            {patient.patientId}
                            {patient.age ? ` · ${patient.age} yrs` : ""}
                            {patient.gender ? ` · ${patient.gender}` : ""}
                          </p>
                          {patient.chiefComplaint && (
                            <p className="text-[10px] text-brand-secondary/80 font-medium mt-0.5 line-clamp-1">
                              <strong>Problem:</strong> {patient.chiefComplaint}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full border ${badges[patient.wellnessRating] || "bg-gray-100 text-gray-700 border-gray-250"}`}>
                          {labels[patient.wellnessRating] || `${patient.wellnessRating}/5`}
                        </span>
                        <p className="text-[10px] text-brand-dark/40">
                          Last visit: {patient.visitDate
                            ? new Date(patient.visitDate).toLocaleDateString(
                                "en-IN",
                                { day: "numeric", month: "short" }
                              )
                            : "—"}
                        </p>
                      </div>
                    </Link>
                  );
                });
              })()}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ─── Bottom Help Strip ─── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10"
      >
        <div className="bg-brand-cream border border-brand-light/50 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-brand-primary flex items-center justify-center shrink-0">
              <Leaf size={18} className="text-brand-light fill-brand-light" />
            </div>
            <div>
              <p className="text-sm font-semibold text-brand-primary">
                Need the full clinical interface?
              </p>
              <p className="text-[10px] text-brand-dark/50">
                Open the Doctor Dashboard for detailed patient records, case
                sheets, prescriptions, lab tests, and analytics.
              </p>
            </div>
          </div>
          <Link
            to="/doctor"
            className="flex items-center gap-1.5 bg-brand-primary text-brand-beige hover:bg-brand-secondary px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-sm shrink-0"
          >
            <Stethoscope size={14} />
            Open Full Dashboard
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
