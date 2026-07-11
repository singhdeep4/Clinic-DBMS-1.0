import { startRealtimeListeners } from "../lib/realtime.js";
import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  User, Plus, Trash2, History,
  Search, Printer, Save, RefreshCw, LogOut, Check, PlusCircle, ArrowLeft, ArrowRight,
  Database, BarChart3, Bell, Shield, Download, Upload, AlertTriangle, Calendar, MessageCircle, Menu, X
} from "lucide-react";
import SEO from "../components/SEO";
import { 
  getAllItems, putItem, deleteItem, clearStore, syncFromCloud
} from "../lib/db";

// Helper to calculate duration from onset date
const getDurationString = (dateStr) => {
  if (!dateStr) return "";
  const onset = new Date(dateStr);
  const now = new Date();
  if (isNaN(onset.getTime())) return "";
  
  onset.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  
  const diffTime = now.getTime() - onset.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return "Future date";
  if (diffDays === 0) return "Starts today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 30) return `${diffDays} days ago`;
  
  const diffMonths = Math.floor(diffDays / 30.4);
  if (diffMonths < 12) {
    return `${diffMonths} month${diffMonths > 1 ? "s" : ""} ago`;
  }
  
  const diffYears = Math.floor(diffMonths / 12);
  const remainingMonths = diffMonths % 12;
  if (remainingMonths === 0) {
    return `${diffYears} year${diffYears > 1 ? "s" : ""} ago`;
  }
  return `${diffYears} year${diffYears > 1 ? "s" : ""} and ${remainingMonths} month${remainingMonths > 1 ? "s" : ""} ago`;
};

const formatOnsetDateTime = (dateStr) => {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  
  const datePart = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  if (dateStr.includes("T") || dateStr.includes(":") || dateStr.includes(" ")) {
    const timePart = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    return `${datePart} ${timePart}`;
  }
  return datePart;
};

const normalizeComplaints = (complaintsArray) => {
  if (!Array.isArray(complaintsArray) || complaintsArray.length === 0) {
    return [{ text: "", onsetDate: new Date().toISOString() }];
  }
  return complaintsArray.map(c => {
      if (typeof c === "string") {
        return { text: c, onsetDate: new Date().toISOString() };
      }
      if (c && typeof c === "object") {
        return {
          text: c.text || "",
          onsetDate: c.onsetDate || new Date().toISOString()
        };
      }
      return { text: "", onsetDate: new Date().toISOString() };
  });
};

// Merge loaded patient data with DEFAULT_STATE to fill any missing fields
const mergeWithDefaults = (data) => ({
  ...DEFAULT_STATE,
  ...data,
  pastHistory: { ...DEFAULT_STATE.pastHistory, ...(data.pastHistory || {}) },
  drugHistory: { ...DEFAULT_STATE.drugHistory, ...(data.drugHistory || {}) },
  familyHistory: { ...DEFAULT_STATE.familyHistory, ...(data.familyHistory || {}) },
  complaints: normalizeComplaints(data.chiefComplaints || data.complaints),
});

// Ayurvedic presets for rapid entry
const MEDICINE_PRESETS = [
  "Triphala Churna", "Chandraprabha Vati", "Gandharvahastadi Kashayam", 
  "Arogyavardhini Vati", "Mahanarayan Tailam", "Ashwagandhadi Churna", 
  "Kanchanar Guggulu", "Kaishore Guggulu", "Shatavari Ghrita", 
  "Dashmoolarishta", "Trikatu Churna", "Avipattikar Churna"
];

const LAB_PANELS = {
  Glycemic: [
    { testName: "Fasting Blood Sugar (FBS)", value: "", range: "70-100", unit: "mg/dL" },
    { testName: "Post-Prandial Blood Sugar (PPBS)", value: "", range: "< 140", unit: "mg/dL" },
    { testName: "HbA1c (Glycated Hemoglobin)", value: "", range: "4.0-5.6", unit: "%" }
  ],
  Lipid: [
    { testName: "Total Cholesterol", value: "", range: "125-200", unit: "mg/dL" },
    { testName: "Triglycerides", value: "", range: "< 150", unit: "mg/dL" },
    { testName: "HDL (Good Cholesterol)", value: "", range: "> 40", unit: "mg/dL" },
    { testName: "LDL (Bad Cholesterol)", value: "", range: "< 100", unit: "mg/dL" }
  ],
  LFT: [
    { testName: "SGOT (AST)", value: "", range: "5-40", unit: "U/L" },
    { testName: "SGPT (ALT)", value: "", range: "7-56", unit: "U/L" },
    { testName: "Total Bilirubin", value: "", range: "0.1-1.2", unit: "mg/dL" },
    { testName: "Alkaline Phosphatase (ALP)", value: "", range: "44-147", unit: "U/L" }
  ],
  KFT: [
    { testName: "Serum Creatinine", value: "", range: "0.5-1.2", unit: "mg/dL" },
    { testName: "Blood Urea Nitrogen (BUN)", value: "", range: "7-20", unit: "mg/dL" },
    { testName: "Uric Acid", value: "", range: "2.4-6.0", unit: "mg/dL" }
  ]
};

const generateVisitId = () => {
  return "VIS-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
};

const DEFAULT_STATE = {
  patientId: "",
  name: "",
  age: "",
  gender: "Male",
  mobile: "",
  occupation: "",
  
  // Chief Complaints (Multiple items)
  complaints: [{ text: "", onsetDate: new Date().toISOString() }],
  
  // Ayurvedic Core (Appetite, bowel, sleep)
  kshudha: "Sama",
  mutra: "Normal",
  mala: "Regular",
  koshtha: "Madhya",
  nidra: "Sound Sleep",
  avastha: "Sama",
  
  // Clinical Info
  surgicalHistory: "",
  drugAllergy: "",
  anyOther: "",
  pastHistory: { diabetes: false, htn: false, thyroid: false, asthma: false, obesity: false, gut: false, others: "" },
  drugHistory: { hasHistory: "No", details: "" },
  familyHistory: { diabetes: false, htn: false, thyroid: false, others: "" },
  addiction: "None",
  vegaDharana: { mutra: false, mala: false, nidra: false, others: "" },
  workType: "Mixed",
  stressLevel: "Moderate",
  
  // Ayurvedic Diagnosis
  prakriti: "Vata-Pitta",
  vikriti: "Vata",
  doshajaVikriti: "Vataja",
  dhatugataVikriti: [],
  dosha: { vata: true, pitta: false, kapha: false },
  dushya: { rasa: true, rakta: false, mamsa: false, meda: false, asthi: false, majja: false, shukra: false },
  srotas: { annavaha: true, pranavaha: false, rasavaha: false, raktavaha: false, medovaha: false, mutravaha: false, purishavaha: false },
  agni: "Sama",
  samprapti: "",
  sampraptiCustom: "",
  ayurvedicDiagnosis: "",
  modernDiagnosis: "",
  
  // Lifestyle
  diet: "Vegetarian",
  mealPattern: "Regular",
  waterIntake: "1–2 L/day",
  viruddhaAhara: "Never",
  teaCoffee: "None",
  activity: "Sedentary",
  exercise: "None",
  divaswap: "Never",
  screenTime: "<2 hrs",
  
  // Treatments
  medicines: [{ name: "", dose: "", frequency: "", kala: "", anupana: "", duration: "" }],
  panchakarma: [],
  
  // Follow Up
  visitNumber: "",
  followUpSymptoms: "Same",
  followUpAgni: "Same",
  followUpTreatment: "Continued",
  outcomeScore: "No Improvement", 
  wellnessRating: 1,
  nextPlan: "Continue Same Treatment",
  nextFollowUp: "15 Days",
  doctorsNotes: "",
  
  // Labs
  labTests: [],
  notes: "",
  visitDate: "",
  visits: [],
  dateOfBirth: "" // Add dateOfBirth to DEFAULT_STATE
};

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

const toDisplayDate = (isoString) => {
  if (!isoString) return "";
  const parts = isoString.split("-");
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return isoString;
};

const toIsoDate = (displayString) => {
  if (!displayString) return "";
  const parts = displayString.split("-");
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return "";
};

export default function DbmsDashboard() {
  const navigate = useNavigate();
  const isAuthenticated = localStorage.getItem("ayurkaya_doctor_logged_in") === "true";
  const dobPickerRef = useRef(null);
  
  // Main view navigation: "clinical" | "analytics" | "followups" | "utilities"
  const [viewMode, setViewModeState] = useState(() => {
    return sessionStorage.getItem("ayurkaya_view_mode") || "clinical";
  });
  const setViewMode = (mode) => {
    sessionStorage.setItem("ayurkaya_view_mode", mode);
    setViewModeState(mode);
  };
  
  const [activeTab, setActiveTabState] = useState(() => {
    return sessionStorage.getItem("ayurkaya_active_tab") || "profile";
  });
  const setActiveTab = (tab) => {
    sessionStorage.setItem("ayurkaya_active_tab", tab);
    setActiveTabState(tab);
  };

  const [completedTabs, setCompletedTabs] = useState({});
  const [dbVisits, setDbVisits] = useState([]);
  const [dbPatients, setDbPatients] = useState([]);

  const allVisitsCases = useMemo(() => {
    const visitsMapped = dbVisits.map(v => {
      const patient = dbPatients.find(p => p.patientId === v.patientId) || {};
      return {
        entryId: `${v.patientId}_${v.visitId}`,
        patientId: v.patientId,
        visitId: v.visitId,
        visitDate: v.visitDate,
        status: v.status || "active",
        complaints: v.chiefComplaints || v.complaints || [],
        name: patient.name || "Unknown Patient",
        age: patient.age || "",
        gender: patient.gender || "Male",
        mobile: patient.mobile || ""
      };
    });

    // Filter out active follow-up drafts and deduplicate exact same visit times for the same patient
    return visitsMapped.filter((v, idx, self) => {
      if (v.status === "active") {
        const hasCompletedSibling = self.some(other => 
          other.patientId === v.patientId && 
          other.status === "completed" && 
          Math.abs(new Date(other.visitDate) - new Date(v.visitDate)) < 5 * 60 * 1000
        );
        if (hasCompletedSibling) return false;
      }
      const firstIdx = self.findIndex(other => 
        other.patientId === v.patientId && 
        other.visitDate === v.visitDate
      );
      if (firstIdx !== idx) return false;
      return true;
    }).sort((a, b) => new Date(b.visitDate || 0) - new Date(a.visitDate || 0));
  }, [dbVisits, dbPatients]);
  const [savedCases, setSavedCases] = useState([]);
  const [matchingPatients, setMatchingPatients] = useState([]);
  const [duplicatePatientFound, setDuplicatePatientFound] = useState(null);
  const [storageMetrics, setStorageMetrics] = useState(null);
  
  const [currentCase, setCurrentCaseState] = useState(() => {
    try {
      const saved = sessionStorage.getItem("ayurkaya_current_case");
      return saved ? JSON.parse(saved) : { ...DEFAULT_STATE };
    } catch {
      return { ...DEFAULT_STATE };
    }
  });
  const setCurrentCase = (val) => {
    if (typeof val === "function") {
      setCurrentCaseState(prev => {
        const next = val(prev);
        sessionStorage.setItem("ayurkaya_current_case", JSON.stringify(next));
        return next;
      });
    } else {
      sessionStorage.setItem("ayurkaya_current_case", JSON.stringify(val));
      setCurrentCaseState(val);
    }
  };

  const [searchTerm, setSearchTerm] = useState("");
  
  const [isPrintMode, setIsPrintModeState] = useState(() => {
    return sessionStorage.getItem("ayurkaya_is_print_mode") === "true";
  });
  const setIsPrintMode = (val) => {
    sessionStorage.setItem("ayurkaya_is_print_mode", String(val));
    setIsPrintModeState(val);
  };

  const [printReferrer, setPrintReferrerState] = useState(() => {
    return sessionStorage.getItem("ayurkaya_print_referrer") || "clinical";
  });
  const setPrintReferrer = (ref) => {
    sessionStorage.setItem("ayurkaya_print_referrer", ref);
    setPrintReferrerState(ref);
  };
  const [notification, setNotification] = useState("");
  const [showSidebar, setShowSidebar] = useState(window.innerWidth >= 1024);

  // Recent cases directory filter state
  const [recentSearch, setRecentSearch] = useState("");
  const [recentMonthFilter, setRecentMonthFilter] = useState("");
  const [recentYearFilter, setRecentYearFilter] = useState("");

  // Local state for DOB text input masking/writing
  const [dobInput, setDobInput] = useState("");
  const [prevDob, setPrevDob] = useState(null);
  if (currentCase.dateOfBirth !== prevDob) {
    setPrevDob(currentCase.dateOfBirth);
    setDobInput(toDisplayDate(currentCase.dateOfBirth || ""));
  }

  // Local state for cloud database plan
  const [cloudPlan, setCloudPlan] = useState(() => localStorage.getItem("ayurkaya_cloud_plan") || "spark");
  const [customLimitGB, setCustomLimitGB] = useState(() => parseFloat(localStorage.getItem("ayurkaya_custom_limit_gb")) || 5);

  // Stepper horizontal mouse drag-to-scroll refs and logic
  const stepperRef = useRef(null);
  const isMouseDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  const handleStepperMouseDown = (e) => {
    if (!stepperRef.current) return;
    isMouseDownRef.current = true;
    startXRef.current = e.pageX - stepperRef.current.offsetLeft;
    scrollLeftRef.current = stepperRef.current.scrollLeft;
  };

  const handleStepperMouseLeaveOrUp = () => {
    isMouseDownRef.current = false;
  };

  const handleStepperMouseMove = (e) => {
    if (!isMouseDownRef.current || !stepperRef.current) return;
    e.preventDefault();
    const x = e.pageX - stepperRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.5; // scrolling speed
    stepperRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  // Auto-scroll the active step into view when activeTab changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (stepperRef.current) {
        const activeEl = stepperRef.current.querySelector(".active-step-button");
        if (activeEl) {
          const container = stepperRef.current;
          const containerRect = container.getBoundingClientRect();
          const activeRect = activeEl.getBoundingClientRect();
          
          const scrollDelta = (activeRect.left + activeRect.width / 2) - (containerRect.left + containerRect.width / 2);
          container.scrollBy({
            left: scrollDelta,
            behavior: "smooth"
          });
        }
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [activeTab]);

  // Toggle body class for print mode active state to hide global headers/footers on screen
  useEffect(() => {
    if (isPrintMode) {
      document.body.classList.add("print-mode-active");
    } else {
      document.body.classList.remove("print-mode-active");
    }
    return () => {
      document.body.classList.remove("print-mode-active");
    };
  }, [isPrintMode]);

  const handlePlanChange = (plan) => {
    setCloudPlan(plan);
    localStorage.setItem("ayurkaya_cloud_plan", plan);
  };

  // State for historical visit purging threshold (1m, 3m, 6m, 9m, 1y)
  const [cleanupThreshold, setCleanupThreshold] = useState("6m");

  // Inactive patient profile purging states (6m, 9m, 1y, 2y)
  const [inactiveFilter, setInactiveFilter] = useState("6m");
  const [selectedInactiveIds, setSelectedInactiveIds] = useState([]);

  // Calculate duration of patient inactivity based on selected filter threshold
  const getInactivePatients = () => {
    const threshold = new Date();
    if (inactiveFilter === "6m") {
      threshold.setDate(threshold.getDate() - 180);
    } else if (inactiveFilter === "9m") {
      threshold.setDate(threshold.getDate() - 270);
    } else if (inactiveFilter === "1y") {
      threshold.setFullYear(threshold.getFullYear() - 1);
    } else if (inactiveFilter === "2y") {
      threshold.setFullYear(threshold.getFullYear() - 2);
    }
    return savedCases.filter(c => c.visitDate && new Date(c.visitDate) < threshold);
  };

  const deleteInactivePatients = async (patientIdsToPurge) => {
    if (patientIdsToPurge.length === 0) return;
    const count = patientIdsToPurge.length;
    if (!window.confirm(`Are you absolutely sure you want to permanently delete the profile card and all visit logs for these ${count} patient(s)?\n\nThis will permanently wipe their basic details, booking registry, and all clinical records from the cloud. This action cannot be undone.`)) {
      return;
    }
    try {
      const { collection, getDocs, query, where } = await import("firebase/firestore");
      const { db: fdb } = await import("../lib/firebase.js");
      for (const id of patientIdsToPurge) {
        await deleteItem("patients", id);
        await deleteItem("registry", id);
        const visitsQuery = query(collection(fdb, "visits"), where("patientId", "==", id));
        const visitsSnapshot = await getDocs(visitsQuery);
        const deleteVisitsPromises = visitsSnapshot.docs.map(doc => deleteItem("visits", doc.id));
        await Promise.all(deleteVisitsPromises);
        const queueQuery = query(collection(fdb, "queue"), where("patientId", "==", id));
        const queueSnapshot = await getDocs(queueQuery);
        const deleteQueuePromises = queueSnapshot.docs.map(doc => deleteItem("queue", doc.id));
        await Promise.all(deleteQueuePromises);
        const archivesQuery = query(collection(fdb, "archived_records"), where("patientId", "==", id));
        const archivesSnapshot = await getDocs(archivesQuery);
        const deleteArchivedPromises = archivesSnapshot.docs.map(doc => deleteItem("archived_records", doc.id));
        await Promise.all(deleteArchivedPromises);
      }
      triggerNotification(`Successfully deleted ${count} patient profile(s) and all their medical records.`);
      setSelectedInactiveIds([]);
      const { getStorageMetrics } = await import("../lib/archiveService.js");
      const m = await getStorageMetrics();
      setStorageMetrics(m);
      const patientsListUpdated = await getAllItems("patients");
      const visitsUpdated = await getAllItems("visits");
      const patientVisitsMap = {};
      visitsUpdated.forEach(v => {
        if (!patientVisitsMap[v.patientId] || new Date(v.visitDate) > new Date(patientVisitsMap[v.patientId].visitDate)) {
          patientVisitsMap[v.patientId] = v;
        }
      });
      const combinedPatients = patientsListUpdated.map(p => {
        const latestVisit = patientVisitsMap[p.patientId];
        if (latestVisit) {
          return {
            ...p,
            visitDate: latestVisit.visitDate,
            complaints: latestVisit.chiefComplaints || latestVisit.complaints || [],
            labTests: latestVisit.labTests || [],
            outcomeScore: latestVisit.outcomeScore || "No Improvement",
            prakriti: latestVisit.prakriti || p.prakriti || "Vata-Pitta",
            agni: latestVisit.agni || "Sama",
            mala: latestVisit.mala || "Regular",
            medicines: latestVisit.medicines || [],
            nextFollowUp: latestVisit.nextFollowUp || "15 Days"
          };
        }
        return {
          ...p,
          visitDate: p.createdAt || p.updatedAt
        };
      });
      combinedPatients.sort((a, b) => new Date(b.visitDate || 0) - new Date(a.visitDate || 0));
      setSavedCases(combinedPatients);
      if (patientIdsToPurge.includes(currentCase.patientId)) {
        setCurrentCase({ ...DEFAULT_STATE });
        setCompletedTabs({});
      }
    } catch (err) {
      console.error("Purging inactive patients failed:", err);
      triggerNotification("Failed to delete inactive patients.");
    }
  };

  const handleCustomLimitChange = (val) => {
    if (val === "") {
      setCustomLimitGB("");
      return;
    }
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      setCustomLimitGB(num);
      localStorage.setItem("ayurkaya_custom_limit_gb", num);
    }
  };

  const closeSidebarOnMobile = () => {
    if (window.innerWidth < 1024) {
      setShowSidebar(false);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setShowSidebar(true);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Live queue state (kept empty/unused)
  const [liveQueue, setLiveQueue] = useState([]);
  const [queueName, setQueueName] = useState("");
  const [queueAge, setQueueAge] = useState("");
  const [queueGender, setQueueGender] = useState("Male");
  const [queueMobile, setQueueMobile] = useState("");
  const [queueReason, setQueueReason] = useState("");

  // Check doctor authentication session
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  // Handle auto-loading a patient from URL parameters (e.g. from follow-up/revisit links)
  useEffect(() => {
    if (!isAuthenticated) return;
    const params = new URLSearchParams(window.location.search);
    const urlPatientId = params.get("patientId");
    const urlActiveTab = params.get("activeTab");
    if (urlPatientId) {
      // Clear parameter from URL so it doesn't reload on refreshes
      window.history.replaceState(null, "", window.location.pathname);
      // Load the patient with the specified tab (defaults to profile)
      selectCase({ patientId: urlPatientId }, urlActiveTab || "profile");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Load cases, queue, and start realtime listeners once on mount
  useEffect(() => {
    if (!isAuthenticated) return;
    console.log("[Dashboard] Mount: Starting data load & realtime listeners");

    let unsubscribeRealtime = null;

    async function refreshAll() {
      console.log("[Dashboard] Refreshing all data from Firestore...");
      try {
        await syncFromCloud();

        const patientsList = await getAllItems("patients");
        const visits = await getAllItems("visits");
        console.log(`[Dashboard] Loaded ${patientsList.length} patients, ${visits.length} visits`);
        
        setDbPatients(patientsList);
        setDbVisits(visits);
        
        const patientVisitsMap = {};

        visits.forEach(v => {
          if (!patientVisitsMap[v.patientId] || new Date(v.visitDate) > new Date(patientVisitsMap[v.patientId].visitDate)) {
            patientVisitsMap[v.patientId] = v;
          }
        });
        const combinedPatients = patientsList.map(p => {
          const latestVisit = patientVisitsMap[p.patientId];
          return {
            ...p,
            visitDate: latestVisit ? latestVisit.visitDate : p.createdAt || p.updatedAt
          };
        });
        combinedPatients.sort((a, b) => new Date(b.visitDate || 0) - new Date(a.visitDate || 0));
        setSavedCases(combinedPatients);

        const queue = await getAllItems("queue");
        console.log(`[Dashboard] Loaded ${queue.length} queue items`);
        setLiveQueue(queue || []);
      } catch (err) {
        console.error("[Dashboard] Error refreshing data:", err);
      }
    }

    // initial fetch
    refreshAll();

    // start realtime listeners which call refreshAll on any collection change
    unsubscribeRealtime = startRealtimeListeners((storeName) => {
      console.log(`[Dashboard] Realtime event: ${storeName} changed, refreshing...`);
      try { refreshAll(); } catch {
        // Ignore refresh errors
      }
    });

    return () => {
      console.log("[Dashboard] Cleanup: Unsubscribing realtime listeners");
      try {
        if (unsubscribeRealtime) unsubscribeRealtime();
      } catch {
        // Ignore unsubscribe errors
      }
    };
  }, [isAuthenticated]);

  // Auto-refresh queue every 15 seconds so new bookings appear in real time
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(async () => {
      const queue = await getAllItems("queue");
      setLiveQueue(queue);
    }, 15000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Load storage metrics and archives when viewMode switches to utilities
  useEffect(() => {
    if (viewMode === "utilities") {
      async function loadMetrics() {
        try {
          const { getStorageMetrics } = await import("../lib/archiveService.js");
          const metrics = await getStorageMetrics();
          setStorageMetrics(metrics);
        } catch (err) {
          console.error("Error loading metrics / archives:", err);
        }
      }
      loadMetrics();
    }
  }, [viewMode]);


  // Auto-fill or find matching patient profiles when 10-digit mobile is typed
  useEffect(() => {
    const cleanMobile = (currentCase.mobile || "").replace(/[^0-9]/g, "");
    if (cleanMobile.length === 10) {
      async function checkRegistry() {
        try {
          const patientsList = await getAllItems("patients");
          const matches = patientsList.filter(p => (p.mobile || "").replace(/[^0-9]/g, "") === cleanMobile);
          setMatchingPatients(matches);
          
          // If there is exactly 1 match and form fields are empty, auto-fill it
          if (matches.length === 1 && !currentCase.patientId && !currentCase.name.trim()) {
            const patient = matches[0];
            
            // Try to find if there's an existing case sheet with full visits loaded
            const { getPatientWithVisits } = await import("../lib/patientService.js");
            const fullRecord = await getPatientWithVisits(patient.patientId);
            if (fullRecord) {
              const activeVisit = fullRecord.visits.find(v => v.status === "active");
              setCurrentCase(mergeWithDefaults({
                ...fullRecord.patient,
                ...(activeVisit || {}),
                visits: activeVisit
                  ? fullRecord.visits.filter(v => v.visitId !== activeVisit.visitId)
                  : fullRecord.visits
              }));
              triggerNotification(`Loaded patient record for ${patient.name}.`);
            }
          }
        } catch (err) {
          console.error("Error reading patients:", err);
        }
      }
      checkRegistry();
    } else {
      setTimeout(() => setMatchingPatients([]), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCase.mobile]);

  // Duplicate Check logic when phone and DOB are provided (only for new registrations)
  useEffect(() => {
    const cleanMobile = (currentCase.mobile || "").replace(/[^0-9]/g, "");
    const dob = currentCase.dateOfBirth;
    
    if (cleanMobile.length === 10 && dob && !currentCase.patientId) {
      async function checkDuplicate() {
        try {
          const { findDuplicatePatient } = await import("../lib/patientService.js");
          const duplicate = await findDuplicatePatient(cleanMobile, dob);
          if (duplicate) {
            setDuplicatePatientFound(duplicate);
          }
        } catch (err) {
          console.error("Error checking duplicates:", err);
        }
      }
      checkDuplicate();
    }
  }, [currentCase.mobile, currentCase.dateOfBirth, currentCase.patientId]);

  function triggerNotification(msg) {
    setNotification(msg);
    setTimeout(() => setNotification(""), 3500);
  }

  const handleLogout = () => {
    localStorage.removeItem("ayurkaya_doctor_logged_in");
    sessionStorage.clear();
    navigate("/login");
  };

  // Text state handlers
  const handleTextChange = (field, value) => {
    if (field === "dateOfBirth") {
      const calculatedAge = calculateAge(value);
      setCurrentCase(prev => ({
        ...prev,
        dateOfBirth: value,
        age: calculatedAge || prev.age
      }));
    } else {
      setCurrentCase(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleCheckboxChange = (group, key, val) => {
    setCurrentCase({
      ...currentCase,
      [group]: { ...currentCase[group], [key]: val }
    });
  };

  // Complaint wizard handlers
  const addComplaint = () => {
    const updated = [...currentCase.complaints, { text: "", onsetDate: new Date().toISOString() }];
    setCurrentCase({ ...currentCase, complaints: updated });
  };

  const updateComplaint = (index, field, value) => {
    const updated = [...currentCase.complaints];
    updated[index][field] = value;
    setCurrentCase({ ...currentCase, complaints: updated });
  };

  const removeComplaint = (index) => {
    if (currentCase.complaints.length === 1) return;
    const updated = currentCase.complaints.filter((_, i) => i !== index);
    setCurrentCase({ ...currentCase, complaints: updated });
  };

  // Prescription medicines handlers
  const addMedicine = () => {
    const updated = [...currentCase.medicines, { name: "", dose: "1 Tab", frequency: "BD", kala: "After Food", anupana: "Warm Water", duration: "30 Days" }];
    setCurrentCase({ ...currentCase, medicines: updated });
  };

  const updateMedicine = (index, field, value) => {
    const updated = [...currentCase.medicines];
    updated[index][field] = value;
    setCurrentCase({ ...currentCase, medicines: updated });
  };

  const removeMedicine = (index) => {
    if (currentCase.medicines.length === 1) return;
    const updated = currentCase.medicines.filter((_, i) => i !== index);
    setCurrentCase({ ...currentCase, medicines: updated });
  };

  const addMedicinePreset = (name) => {
    const existsEmpty = currentCase.medicines.findIndex(m => m.name === "");
    if (existsEmpty !== -1) {
      updateMedicine(existsEmpty, "name", name);
    } else {
      const updated = [...currentCase.medicines, { name, dose: "1 Tab", frequency: "BD", kala: "After Food", anupana: "Warm Water", duration: "30 Days" }];
      setCurrentCase({ ...currentCase, medicines: updated });
    }
  };

  // Investigation Lab panel handlers
  const addLabPanel = (panelName) => {
    const panelTests = LAB_PANELS[panelName];
    if (!panelTests) return;
    
    const currentTestNames = currentCase.labTests.map(t => t.testName);
    const newTests = panelTests.filter(t => !currentTestNames.includes(t.testName));
    
    if (newTests.length === 0) {
      triggerNotification(`${panelName} panel items already loaded.`);
      return;
    }
    
    setCurrentCase({
      ...currentCase,
      labTests: [...currentCase.labTests, ...JSON.parse(JSON.stringify(newTests))]
    });
    triggerNotification(`Added ${panelName} Panel tests.`);
  };

  const updateLabTestValue = (index, val) => {
    const updated = [...currentCase.labTests];
    updated[index].value = val;
    setCurrentCase({ ...currentCase, labTests: updated });
  };

  const removeLabTest = (index) => {
    const updated = currentCase.labTests.filter((_, i) => i !== index);
    setCurrentCase({ ...currentCase, labTests: updated });
  };

  const addCustomLabRow = () => {
    setCurrentCase({
      ...currentCase,
      labTests: [...currentCase.labTests, { testName: "", value: "", range: "Custom", unit: "-" }]
    });
  };

  const updateCustomLabField = (index, field, val) => {
    const updated = [...currentCase.labTests];
    updated[index][field] = val;
    setCurrentCase({ ...currentCase, labTests: updated });
  };

  // Update Permanent Registry basic profile manually
  const updateRegistryProfile = async () => {
    const cleanMobile = (currentCase.mobile || "").replace(/[^0-9]/g, "");
    if (cleanMobile.length !== 10) {
      triggerNotification("Valid 10-digit Mobile Number is required to update registry profile.");
      return;
    }
    if (!currentCase.name.trim()) {
      triggerNotification("Patient Name is required.");
      return;
    }
    // If it is a new patient, DOB is required
    if (!currentCase.patientId && !currentCase.dateOfBirth) {
      triggerNotification("Date of Birth is required for new patient registration.");
      setActiveTab("profile");
      return;
    }

    try {
      let patientId = currentCase.patientId;
      if (!patientId) {
        const { getNextPatientId } = await import("../lib/patientService.js");
        patientId = await getNextPatientId();
        setCurrentCase(prev => ({ ...prev, patientId }));
      }

      const patientData = {
        patientId,
        name: currentCase.name,
        age: currentCase.age,
        dateOfBirth: currentCase.dateOfBirth || "",
        gender: currentCase.gender,
        mobile: cleanMobile,
        occupation: currentCase.occupation,
        email: currentCase.email || "",
        address: currentCase.address || "",
        status: currentCase.status || "Active",
        createdAt: currentCase.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await putItem("patients", patientData);

      const registryData = {
        patientId,
        name: currentCase.name,
        dateOfBirth: currentCase.dateOfBirth || "",
        gender: currentCase.gender,
        mobile: cleanMobile,
        occupation: currentCase.occupation,
        address: currentCase.address || "",
        email: currentCase.email || "",
        status: currentCase.status || "Active",
        updatedAt: new Date().toISOString()
      };
      await putItem("registry", registryData);

      // Check if there is an existing case in savedCases, and update it
      const existingIndex = savedCases.findIndex(c => c.patientId === patientId);
      if (existingIndex !== -1) {
        const updated = {
          ...savedCases[existingIndex],
          name: currentCase.name,
          age: currentCase.age,
          dateOfBirth: currentCase.dateOfBirth || "",
          gender: currentCase.gender,
          mobile: cleanMobile,
          occupation: currentCase.occupation
        };
        const newCases = [...savedCases];
        newCases[existingIndex] = updated;
        setSavedCases(newCases);
        setCurrentCase(prev => ({ ...prev, ...updated }));
      } else {
        setCurrentCase(prev => ({
          ...prev,
          patientId,
          mobile: cleanMobile
        }));
      }
      
      // Refresh the savedCases list to make sure patient list is updated
      const patientsList = await getAllItems("patients");
      const visits = await getAllItems("visits");
      const patientVisitsMap = {};
      visits.forEach(v => {
        if (!patientVisitsMap[v.patientId] || new Date(v.visitDate) > new Date(patientVisitsMap[v.patientId].visitDate)) {
          patientVisitsMap[v.patientId] = v;
        }
      });
      const combinedPatients = patientsList.map(p => {
        const latestVisit = patientVisitsMap[p.patientId];
        return {
          ...p,
          visitDate: latestVisit ? latestVisit.visitDate : p.createdAt || p.updatedAt
        };
      });
      combinedPatients.sort((a, b) => new Date(b.visitDate || 0) - new Date(a.visitDate || 0));
      setSavedCases(combinedPatients);

      triggerNotification(`Permanent profile and case file for ${currentCase.name} updated successfully.`);
    } catch (err) {
      console.error(err);
      triggerNotification("Failed to update patient profile.");
    }
  };

  const handleNewPatientRegistration = () => {
    setCurrentCase({ ...DEFAULT_STATE });
    setCompletedTabs({});
    setActiveTab("profile");
    triggerNotification("Cleared workspace. Ready to register new patient.");
  };

  // Save Case Sheet to Firestore
  const saveCase = async () => {
    if (!currentCase.name.trim()) {
      triggerNotification("Patient Name is required to save case.");
      setActiveTab("profile");
      return null;
    }
    if (!currentCase.patientId && !currentCase.dateOfBirth) {
      triggerNotification("Date of Birth is required for new patient registration.");
      setActiveTab("profile");
      return null;
    }

    let updatedCase = { ...currentCase };
    try {
      let patientId = currentCase.patientId;
      if (!patientId) {
        const { getNextPatientId } = await import("../lib/patientService.js");
        patientId = await getNextPatientId();
        updatedCase.patientId = patientId;
      }

      const cleanMobile = (updatedCase.mobile || "").replace(/[^0-9]/g, "");

      // 1. Save demographics to patients store
      const patientData = {
        patientId,
        name: updatedCase.name,
        age: updatedCase.age,
        dateOfBirth: updatedCase.dateOfBirth || "",
        gender: updatedCase.gender,
        mobile: cleanMobile,
        occupation: updatedCase.occupation,
        email: updatedCase.email || "",
        address: updatedCase.address || "",
        status: updatedCase.status || "Active",
        createdAt: updatedCase.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await putItem("patients", patientData);

      // 2. Save active visit to visits store
      const visitDate = updatedCase.visitDate || new Date().toISOString();
      const visitId = updatedCase.visitId || generateVisitId();
      
      const visitData = {
        visitId,
        patientId,
        visitDate,
        visitNumber: updatedCase.visitNumber || (updatedCase.visits || []).length + 1,
        status: "active",
        // Clinical fields
        chiefComplaints: updatedCase.complaints || [],
        kshudha: updatedCase.kshudha || "Sama",
        mutra: updatedCase.mutra || "Normal",
        mala: updatedCase.mala || "Regular",
        koshtha: updatedCase.koshtha || "Madhya",
        nidra: updatedCase.nidra || "Sound Sleep",
        avastha: updatedCase.avastha || "Sama",
        surgicalHistory: updatedCase.surgicalHistory || "",
        drugAllergy: updatedCase.drugAllergy || "",
        anyOther: updatedCase.anyOther || "",
        pastHistory: updatedCase.pastHistory || {},
        drugHistory: updatedCase.drugHistory || {},
        familyHistory: updatedCase.familyHistory || {},
        addiction: updatedCase.addiction || "None",
        vegaDharana: updatedCase.vegaDharana || {},
        workType: updatedCase.workType || "Mixed",
        stressLevel: updatedCase.stressLevel || "Moderate",
        prakriti: updatedCase.prakriti || "Vata-Pitta",
        vikriti: updatedCase.vikriti || "Vata",
        doshajaVikriti: updatedCase.doshajaVikriti || "Vataja",
        dhatugataVikriti: updatedCase.dhatugataVikriti || [],
        dosha: updatedCase.dosha || {},
        dushya: updatedCase.dushya || {},
        srotas: updatedCase.srotas || {},
        agni: updatedCase.agni || "Sama",
        samprapti: updatedCase.samprapti || "",
        sampraptiCustom: updatedCase.sampraptiCustom || "",
        ayurvedicDiagnosis: updatedCase.ayurvedicDiagnosis || "",
        modernDiagnosis: updatedCase.modernDiagnosis || "",
        diet: updatedCase.diet || "Vegetarian",
        mealPattern: updatedCase.mealPattern || "Regular",
        waterIntake: updatedCase.waterIntake || "1–2 L/day",
        viruddhaAhara: updatedCase.viruddhaAhara || "Never",
        teaCoffee: updatedCase.teaCoffee || "None",
        activity: updatedCase.activity || "Sedentary",
        exercise: updatedCase.exercise || "None",
        divaswap: updatedCase.divaswap || "Never",
        screenTime: updatedCase.screenTime || "<2 hrs",
        medicines: updatedCase.medicines || [],
        panchakarmaAdvice: updatedCase.panchakarmaAdvice || [],
        pathyaApathya: updatedCase.pathyaApathya || "",
        visitNumberDropdown: updatedCase.visitNumberDropdown || "",
        followUpSymptoms: updatedCase.followUpSymptoms || "Same",
        followUpAgni: updatedCase.followUpAgni || "Same",
        followUpTreatment: updatedCase.followUpTreatment || "Continued",
        outcomeScore: updatedCase.outcomeScore || "No Improvement",
        nextPlan: updatedCase.nextPlan || "Continue Same Treatment",
        nextFollowUp: updatedCase.nextFollowUp || "15 Days",
        doctorsNotes: updatedCase.doctorsNotes || "",
        labTests: updatedCase.labTests || [],
        notes: updatedCase.notes || ""
      };
      await putItem("visits", visitData);

      // Retrieve updated full list of visits for this patient
      const { getPatientVisits } = await import("../lib/patientService.js");
      const allVisits = await getPatientVisits(patientId);

      // Refresh active case state — map chiefComplaints back to complaints for the UI
      const fullActive = {
        ...patientData,
        ...visitData,
        complaints: normalizeComplaints(visitData.chiefComplaints || updatedCase.complaints),
        visits: allVisits.filter(v => v.visitId !== visitId) // separate history
      };
      setCurrentCase(fullActive);

      // Update savedCases list (sidebar list) — include clinical fields for analytics/alerts
      const updatedSavedCase = {
        ...patientData,
        visitDate,
        complaints: visitData.chiefComplaints || [],
        labTests: visitData.labTests || [],
        outcomeScore: visitData.outcomeScore || "No Improvement",
        prakriti: visitData.prakriti || "Vata-Pitta",
        agni: visitData.agni || "Sama",
        mala: visitData.mala || "Regular",
        medicines: visitData.medicines || [],
        nextFollowUp: visitData.nextFollowUp || "15 Days"
      };
      setSavedCases(prevCases => {
        const existingIndex = prevCases.findIndex(c => c.patientId === patientId);
        let updatedList = [...prevCases];
        if (existingIndex !== -1) {
          updatedList[existingIndex] = updatedSavedCase;
        } else {
          updatedList = [updatedSavedCase, ...updatedList];
        }
        return updatedList.sort((a, b) => new Date(b.visitDate || 0) - new Date(a.visitDate || 0));
      });

      triggerNotification(`Case Record Saved (ID: ${patientId}).`);
      await autoCheckoutQueuePatient(patientId, updatedCase.name, updatedCase.mobile, updatedCase.dateOfBirth);
      return fullActive;
    } catch (err) {
      console.error("Save case failed:", err);
      triggerNotification("Failed to save case record.");
      return null;
    }
  };

  // Archive active session details to visits history, reset active visit parameters
  const handleRecordNewVisit = async (caseDataOverride = null) => {
    const activeCase = caseDataOverride || currentCase;
    if (!activeCase.patientId) {
      triggerNotification("Please save the patient case first before recording a follow-up visit.");
      return;
    }
    
    try {
      // 1. Create a historical visit record from the active fields (same as original logic)
      const activeVisit = JSON.parse(JSON.stringify(activeCase));
      delete activeVisit.visits;
      activeVisit.visitId = activeVisit.visitId || generateVisitId();
      activeVisit.visitDate = activeCase.visitDate || new Date().toISOString();
      activeVisit.status = "completed";
      // Map complaints → chiefComplaints for storage consistency
      activeVisit.chiefComplaints = activeVisit.complaints || [];

      await putItem("visits", activeVisit);

      // 2. Prepare the new active case state (same reset logic as original)
      const newVisitDate = new Date().toISOString();
      const newVisitId = generateVisitId();
      
      const updatedCase = {
        ...activeCase,
        visitId: newVisitId,
        visitDate: newVisitDate,
        status: "active",
        outcomeScore: "No Improvement",
        nextPlan: "Continue Same Treatment",
        notes: "",
        doctorsNotes: "",
        followUpSymptoms: "Same",
        followUpAgni: "Same",
        followUpTreatment: "Continued"
      };

      // 3. Fetch all visits to rebuild the history list
      const { getPatientVisits } = await import("../lib/patientService.js");
      const allVisits = await getPatientVisits(activeCase.patientId);

      updatedCase.visits = allVisits.filter(v => v.visitId !== newVisitId);

      // 4. Update UI state with new follow-up session (will save to DB when doctor edits and clicks Save Case)
      setCurrentCase(updatedCase);

      // 5. Update the savedCases list with enriched data for alerts
      const updatedSavedCase = {
        patientId: activeCase.patientId,
        name: activeCase.name,
        age: activeCase.age,
        dateOfBirth: activeCase.dateOfBirth,
        gender: activeCase.gender,
        mobile: activeCase.mobile,
        occupation: activeCase.occupation,
        visitDate: newVisitDate,
        complaints: updatedCase.complaints || [],
        labTests: updatedCase.labTests || [],
        outcomeScore: updatedCase.outcomeScore,
        prakriti: updatedCase.prakriti,
        agni: updatedCase.agni,
        mala: updatedCase.mala
      };
      setSavedCases(prevCases => {
        const existingIndex = prevCases.findIndex(c => c.patientId === activeCase.patientId);
        let updatedList = [...prevCases];
        if (existingIndex !== -1) {
          updatedList[existingIndex] = updatedSavedCase;
        } else {
          updatedList = [updatedSavedCase, ...updatedList];
        }
        return updatedList.sort((a, b) => new Date(b.visitDate || 0) - new Date(a.visitDate || 0));
      });

      triggerNotification("Current session archived to history. Started follow-up visit.");
      setActiveTab("complaints");
      await autoCheckoutQueuePatient(activeCase.patientId, activeCase.name, activeCase.mobile, activeCase.dateOfBirth);
    } catch (err) {
      console.error("Error creating follow-up visit:", err);
      triggerNotification("Failed to record follow-up visit.");
    }
  };

  const handleSaveAndRecordFollowUp = async () => {
    const savedCaseData = await saveCase();
    if (savedCaseData) {
      await handleRecordNewVisit(savedCaseData);
    }
  };

  // Copy details of a past visit into the active clinical sheet
  const copyPastVisitDetails = (pastVisit) => {
    const pastCopy = JSON.parse(JSON.stringify(pastVisit));
    
    // Remove fields we don't want to overwrite in current case
    delete pastCopy.patientId;
    delete pastCopy.name;
    delete pastCopy.age;
    delete pastCopy.gender;
    delete pastCopy.mobile;
    delete pastCopy.occupation;
    delete pastCopy.visitId;
    delete pastCopy.visitDate;
    
    setCurrentCase(prev => ({
      ...prev,
      ...pastCopy
    }));
    triggerNotification(`Copied remedies & diagnoses from visit on ${new Date(pastVisit.visitDate).toLocaleDateString()}`);
  };

  // Load selected case into active editor
  async function selectCase(c, targetTab = "profile", openPrintMode = false) {
    try {
      const { getPatientWithVisits } = await import("../lib/patientService.js");
      const fullRecord = await getPatientWithVisits(c.patientId);
      if (fullRecord) {
        let combined;
        if (openPrintMode) {
          // If viewing print/case sheet, load specific or active visit details
          const activeVisit = c.visitId
            ? fullRecord.visits.find(v => v.visitId === c.visitId)
            : fullRecord.visits.find(v => v.status === "active");
          
          combined = mergeWithDefaults({
            ...fullRecord.patient,
            ...(activeVisit || {}),
            visits: activeVisit
              ? fullRecord.visits.filter(v => v.visitId !== activeVisit.visitId)
              : fullRecord.visits
          });
          setPrintReferrer(viewMode);
        } else {
          // If searching or opening patient to consult, load demographics & carry forward past history, keep other clinical fields clean
          const latestVisit = fullRecord.visits[0];
          combined = mergeWithDefaults({
            ...fullRecord.patient,
            visits: fullRecord.visits,
            surgicalHistory: latestVisit?.surgicalHistory || "",
            drugAllergy: latestVisit?.drugAllergy || "",
            anyOther: latestVisit?.anyOther || "",
            pastHistory: latestVisit?.pastHistory || {},
            drugHistory: latestVisit?.drugHistory || {},
            familyHistory: latestVisit?.familyHistory || {},
          });
          combined.visitId = generateVisitId();
          combined.visitDate = new Date().toISOString();
          combined.status = "active";
        }
        
        setCurrentCase(combined);
        setCompletedTabs({});
        setViewMode("clinical");
        setActiveTab(targetTab);
        closeSidebarOnMobile();
        if (openPrintMode) {
          setIsPrintMode(true);
        }
        triggerNotification(`Loaded record of ${fullRecord.patient.name}`);
      } else {
        if (openPrintMode) {
          setPrintReferrer(viewMode);
        }
        setCurrentCase(mergeWithDefaults({ ...c }));
        setCompletedTabs({});
        setViewMode("clinical");
        setActiveTab(targetTab);
        closeSidebarOnMobile();
        if (openPrintMode) {
          setIsPrintMode(true);
        }
        triggerNotification(`Loaded record of ${c.name}`);
      }
    } catch (err) {
      console.error("Error selecting patient:", err);
      if (openPrintMode) {
        setPrintReferrer(viewMode);
      }
      setCurrentCase(mergeWithDefaults({ ...c }));
      setCompletedTabs({});
      setViewMode("clinical");
      setActiveTab(targetTab);
      if (openPrintMode) {
        setIsPrintMode(true);
      }
    }
  }

  const loadSelectedPatientProfile = async (patient) => {
    try {
      const { getPatientWithVisits } = await import("../lib/patientService.js");
      const fullRecord = await getPatientWithVisits(patient.patientId);
      if (fullRecord) {
        // Load demographics & carry forward past history, keep other clinical fields clean
        const latestVisit = fullRecord.visits[0];
        const combined = mergeWithDefaults({
          ...fullRecord.patient,
          visits: fullRecord.visits,
          surgicalHistory: latestVisit?.surgicalHistory || "",
          drugAllergy: latestVisit?.drugAllergy || "",
          anyOther: latestVisit?.anyOther || "",
          pastHistory: latestVisit?.pastHistory || {},
          drugHistory: latestVisit?.drugHistory || {},
          familyHistory: latestVisit?.familyHistory || {},
        });
        combined.visitId = generateVisitId();
        combined.visitDate = new Date().toISOString();
        combined.status = "active";
        
        setCurrentCase(combined);
        setCompletedTabs({});
        triggerNotification(`Loaded patient record for ${patient.name}.`);
      } else {
        setCurrentCase(prev => mergeWithDefaults({
          ...prev,
          patientId: patient.patientId,
          name: patient.name || "",
          age: patient.age || "",
          dateOfBirth: patient.dateOfBirth || "",
          gender: patient.gender || "Male",
          occupation: patient.occupation || "",
          mobile: patient.mobile || prev.mobile,
          visits: []
        }));
        triggerNotification(`Loaded profile details for ${patient.name}.`);
      }
    } catch (err) {
      console.error("Error loading patient profile selection:", err);
    }
    setMatchingPatients([]);
  };

  const startNewFamilyMemberProfile = () => {
    const activeMobile = currentCase.mobile;
    setCurrentCase({
      ...DEFAULT_STATE,
      mobile: activeMobile
    });
    setCompletedTabs({});
    setMatchingPatients([]);
    triggerNotification("Cleared form to register a new family member under this mobile number.");
  };

  // Clear case sheets for a new patient
  const startNewCase = () => {
    setCurrentCase({ ...DEFAULT_STATE });
    setCompletedTabs({});
    setViewMode("clinical");
    setActiveTab("profile");
    closeSidebarOnMobile();
    triggerNotification("Cleared workspace editor.");
  };

  // Helper function to convert modern color strings (oklch, oklab, etc.) to standard RGB/RGBA
  // so html2canvas doesn't crash on unsupported color functions.
  const convertModernColorToRgba = (colorStr) => {
    if (!colorStr || typeof colorStr !== "string") return colorStr;
    const hasModernColor = colorStr.includes("oklch") || colorStr.includes("oklab");
    if (!hasModernColor) return colorStr;
    
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return colorStr;
      
      ctx.fillStyle = colorStr;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
    } catch (e) {
      console.warn("Failed to convert modern color:", colorStr, e);
      return colorStr;
    }
  };

  const handleSendToPatientWhatsApp = async () => {
    if (!currentCase.name?.trim()) {
      triggerNotification("Patient Profile name is required.");
      return;
    }
    
    let phone = currentCase.mobile || "";
    phone = phone.replace(/\D/g, "");
    if (!phone) {
      triggerNotification("Patient mobile number is missing!");
      return;
    }
    if (phone.length === 10) {
      phone = "91" + phone;
    }

    let text = `*AYURKAYA AYURVEDIC CLINIC*\n`;
    text += `*Chief Consultant:* Dr. Neha, B.A.M.S\n`;
    text += `------------------------------------\n`;
    text += `*Patient Name:* ${currentCase.name}\n`;
    text += `*Patient ID:* ${currentCase.patientId || "N/A"}\n`;
    text += `*Consultation Date:* ${currentCase.visitDate ? new Date(currentCase.visitDate).toLocaleDateString() : new Date().toLocaleDateString()}\n`;
    
    if (currentCase.ayurvedicDiagnosis || currentCase.modernDiagnosis) {
      text += `*Diagnosis:* ${currentCase.ayurvedicDiagnosis ? `Ayurvedic: ${currentCase.ayurvedicDiagnosis}` : ""}${currentCase.ayurvedicDiagnosis && currentCase.modernDiagnosis ? " | " : ""}${currentCase.modernDiagnosis ? `Modern: ${currentCase.modernDiagnosis}` : ""}\n`;
    }
    
    const validMeds = currentCase.medicines.filter(m => m.name?.trim());
    if (validMeds.length > 0) {
      text += `\n*💊 Advised Rx (Prescription):*\n`;
      validMeds.forEach((m, idx) => {
        text += `${idx + 1}. *${m.name}* - ${m.dose}${m.frequency ? ` • ${m.frequency}` : ""}\n`;
        text += `   - Kala: ${m.kala || "N/A"} | Anupana: ${m.anupana || "N/A"} | Duration: ${m.duration || "N/A"}\n`;
      });
    }

    const pkg = Array.isArray(currentCase.panchakarma) ? currentCase.panchakarma.filter(Boolean) : [currentCase.panchakarma].filter(Boolean);
    if (pkg.length > 0) {
      text += `\n*🌿 Panchakarma Advised:* ${pkg.join(", ")}\n`;
    }

    if (currentCase.notes) {
      text += `\n*Diet & Lifestyle (Pathya-Apathya):*\n_${currentCase.notes}_\n`;
    }

    if (currentCase.nextFollowUp) {
      text += `\n*Next Follow-Up:* ${currentCase.nextFollowUp}\n`;
    }

    text += `------------------------------------\n`;
    text += `Wish you a speedy recovery! For queries, contact us at +91 70212 72264.`;

    const element = document.getElementById("case-sheet-printout");
    if (!element) {
      // If print content is not on page (e.g. they clicked from another screen), open WhatsApp directly
      const encodedText = encodeURIComponent(text);
      const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodedText}`;
      window.open(url, "_blank");
      return;
    }

    try {
      triggerNotification("Copying prescription image to clipboard...");

      const { default: html2canvas } = await import("html2canvas");

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.getElementById("case-sheet-printout");
          if (!clonedElement) return;

          const originalElements = [element, ...element.getElementsByTagName("*")];
          const clonedElements = [clonedElement, ...clonedElement.getElementsByTagName("*")];

          const propsToConvert = [
            "color",
            "backgroundColor",
            "borderColor",
            "borderTopColor",
            "borderRightColor",
            "borderBottomColor",
            "borderLeftColor",
            "fill",
            "stroke"
          ];

          for (let i = 0; i < originalElements.length; i++) {
            const orig = originalElements[i];
            const clone = clonedElements[i];
            if (!orig || !clone) continue;

            const computedStyle = window.getComputedStyle(orig);
            propsToConvert.forEach(prop => {
              const val = computedStyle[prop];
              if (val && (val.includes("oklch") || val.includes("oklab"))) {
                const converted = convertModernColorToRgba(val);
                clone.style[prop] = converted;
              }
            });
          }
        }
      });

      // Convert canvas to Blob and write to clipboard
      canvas.toBlob(async (blob) => {
        if (!blob) {
          triggerNotification("Could not copy image. Redirecting to WhatsApp...");
          openWhatsAppWindow();
          return;
        }

        try {
          if (typeof ClipboardItem !== "undefined") {
            const item = new ClipboardItem({ "image/png": blob });
            await navigator.clipboard.write([item]);
            triggerNotification("Prescription image copied! Paste (Ctrl+V) in the WhatsApp window.");
          } else {
            throw new Error("ClipboardItem is not supported in this browser.");
          }
        } catch (clipErr) {
          console.error("Clipboard copy failed:", clipErr);
          triggerNotification("Could not copy image. Redirecting to WhatsApp...");
        } finally {
          openWhatsAppWindow();
        }
      }, "image/png");

    } catch (err) {
      console.error("Prescription capture failed:", err);
      triggerNotification("Redirecting to WhatsApp...");
      openWhatsAppWindow();
    }

    function openWhatsAppWindow() {
      const encodedText = encodeURIComponent(text);
      const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodedText}`;
      window.open(url, "_blank");
    }
  };

  const handleSaveAsPDF = async () => {
    if (!currentCase.name?.trim()) {
      triggerNotification("Patient Profile name is required.");
      return;
    }

    const element = document.getElementById("case-sheet-printout");
    if (!element) {
      triggerNotification("Could not find printout content!");
      return;
    }

    try {
      triggerNotification("Generating PDF, please wait...");
      
      const { default: html2canvas } = await import("html2canvas");
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.getElementById("case-sheet-printout");
          if (!clonedElement) return;

          const originalElements = [element, ...element.getElementsByTagName("*")];
          const clonedElements = [clonedElement, ...clonedElement.getElementsByTagName("*")];

          const propsToConvert = [
            "color",
            "backgroundColor",
            "borderColor",
            "borderTopColor",
            "borderRightColor",
            "borderBottomColor",
            "borderLeftColor",
            "fill",
            "stroke"
          ];

          for (let i = 0; i < originalElements.length; i++) {
            const orig = originalElements[i];
            const clone = clonedElements[i];
            if (!orig || !clone) continue;

            const computedStyle = window.getComputedStyle(orig);
            propsToConvert.forEach(prop => {
              const val = computedStyle[prop];
              if (val && (val.includes("oklch") || val.includes("oklab"))) {
                const converted = convertModernColorToRgba(val);
                clone.style[prop] = converted;
              }
            });
          }
        }
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      
      // Calculate layout to scale the page correctly to A4 dimensions
      const imgWidth = 190; // A4 page width minus margins
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 10; // Top margin

      pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight + 10;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Ayurkaya_Rx_${currentCase.name.trim().replace(/\s+/g, "_")}.pdf`);
      triggerNotification("PDF downloaded successfully!");
    } catch (err) {
      console.error("PDF generation failed:", err);
      triggerNotification("Failed to generate PDF. Please try Print / Save as PDF.");
    }
  };

  // Delete Case from database
  const deleteCaseRecord = async (id, e) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this patient record, their registry card, and all their active/archived visits?")) {
      try {
        // 1. Delete demographics from patients store
        const res = await deleteItem("patients", id);
        if (!res || !res.deleted) {
          console.error("Delete patient record failed: server delete not confirmed", res);
          triggerNotification("Failed to delete patient record on server.");
          return;
        }

        // 2. Delete registry card
        try {
          await deleteItem("registry", id);
        } catch (regErr) {
          console.warn("Failed to delete patient registry profile from Firestore:", regErr);
        }

        // 3. Delete active and completed visits belonging to this patient
        try {
          const { collection, getDocs, query, where } = await import("firebase/firestore");
          const { db: fdb } = await import("../lib/firebase.js");
          const visitsQuery = query(collection(fdb, "visits"), where("patientId", "==", id));
          const visitsSnapshot = await getDocs(visitsQuery);
          const deletePromises = visitsSnapshot.docs.map((docSnap) => deleteItem("visits", docSnap.id));
          await Promise.all(deletePromises);
        } catch (err) {
          console.warn("Failed to delete patient visits from Firestore:", err);
        }

        // 4. Delete archived records belonging to this patient
        try {
          const { collection, getDocs, query, where } = await import("firebase/firestore");
          const { db: fdb } = await import("../lib/firebase.js");
          const archivedQuery = query(collection(fdb, "archived_records"), where("patientId", "==", id));
          const archivedSnapshot = await getDocs(archivedQuery);
          const deleteArchivedPromises = archivedSnapshot.docs.map((docSnap) => deleteItem("archived_records", docSnap.id));
          await Promise.all(deleteArchivedPromises);
        } catch (err) {
          console.warn("Failed to delete patient archived records from Firestore:", err);
        }

        // 5. Delete patient queue entries
        try {
          const { collection, getDocs, query, where } = await import("firebase/firestore");
          const { db: fdb } = await import("../lib/firebase.js");
          const queueQuery = query(collection(fdb, "queue"), where("patientId", "==", id));
          const queueSnapshot = await getDocs(queueQuery);
          const deleteQueuePromises = queueSnapshot.docs.map((docSnap) => deleteItem("queue", docSnap.id));
          await Promise.all(deleteQueuePromises);

          const queueIds = queueSnapshot.docs.map(d => d.id);
          if (queueIds.length > 0) {
            setLiveQueue(prev => prev.filter(q => !queueIds.includes(q.id)));
          }
        } catch (err) {
          console.warn("Failed to delete patient from queue:", err);
        }

        const filtered = savedCases.filter(c => c.patientId !== id);
        setSavedCases(filtered);
        if (currentCase.patientId === id) {
          setCurrentCase({ ...DEFAULT_STATE });
        }
        triggerNotification("Patient record, registry, and all visits removed successfully.");
      } catch (err) {
        console.error("Delete patient record failed:", err);
        triggerNotification("Failed to delete patient record.");
      }
    }
  };

  // Consulting a queue patient
  const consultQueuePatient = async (patient) => {
    setCompletedTabs({});
    const cleanMobile = (patient.mobile || "").replace(/[^0-9]/g, "");
    let existingPatient = null;
    
    try {
      const { getPatientWithVisits } = await import("../lib/patientService.js");
      const patientsList = await getAllItems("patients");
      
      if (patient.patientId) {
        existingPatient = patientsList.find(p => p.patientId === patient.patientId);
      } else {
        const dob = patient.dateOfBirth || patient.dob;
        if (dob) {
          existingPatient = patientsList.find(
            p => (p.mobile || "").replace(/[^0-9]/g, "") === cleanMobile && p.dateOfBirth === dob
          );
        } else {
          existingPatient = patientsList.find(
            p => (p.mobile || "").replace(/[^0-9]/g, "") === cleanMobile && 
                 p.name.toLowerCase().trim() === patient.name.toLowerCase().trim()
          );
        }
      }
      
      if (existingPatient) {
        const fullRecord = await getPatientWithVisits(existingPatient.patientId);
        if (fullRecord) {
          const latestVisit = fullRecord.visits[0];
          const newVisitDate = new Date().toISOString();
          const newVisitId = generateVisitId();
          
          const combined = mergeWithDefaults({
            ...fullRecord.patient,
            visits: fullRecord.visits,
            surgicalHistory: latestVisit?.surgicalHistory || "",
            drugAllergy: latestVisit?.drugAllergy || "",
            anyOther: latestVisit?.anyOther || "",
            pastHistory: latestVisit?.pastHistory || {},
            drugHistory: latestVisit?.drugHistory || {},
            familyHistory: latestVisit?.familyHistory || {},
          });
          combined.visitId = newVisitId;
          combined.visitDate = newVisitDate;
          combined.visitNumber = fullRecord.visits.length + 1;
          combined.status = "active";
          combined.complaints = [{ text: patient.reason || "", onsetDate: new Date().toISOString() }];
          setCurrentCase(combined);
          triggerNotification(`Initialized follow-up visit for registered patient ${patient.name}`);
        }
      }
    } catch (err) {
      console.error("Error consulting queue patient:", err);
    }
    
    if (!existingPatient) {
      setCurrentCase({
        ...DEFAULT_STATE,
        name: patient.name,
        age: patient.age,
        gender: patient.gender || "Male",
        mobile: patient.mobile,
        dateOfBirth: patient.dateOfBirth || "",
        occupation: patient.occupation || "",
        complaints: [{ text: patient.reason || "", onsetDate: new Date().toISOString() }]
      });
      triggerNotification(`Consultation initialized for new patient ${patient.name}`);
    }
    
    const updatedQueue = liveQueue.map(q => q.id === patient.id ? { ...q, status: "In-Consult" } : q);
    setLiveQueue(updatedQueue);
    
    // Save state to Firestore
    await putItem("queue", { ...patient, status: "In-Consult" });
    
    setViewMode("clinical");
    setActiveTab("profile");
    closeSidebarOnMobile();
    triggerNotification(`Consultation initialized for ${patient.name}`);
  };


  // Remove patient from waiting list
  const completeQueuePatient = async (id) => {
    const updatedQueue = liveQueue.filter(q => q.id !== id);
    setLiveQueue(updatedQueue);
    await deleteItem("queue", id);
    triggerNotification("Patient checked out from waiting list.");
  };

  const autoCheckoutQueuePatient = async (patientId, patientName, patientMobile, patientDOB) => {
    try {
      const cleanMobileStr = (patientMobile || "").replace(/[^0-9]/g, "").slice(-10);
      const matchingQueueItem = liveQueue.find(q => {
        if (q.patientId && q.patientId === patientId) return true;
        const qMobile = (q.mobile || "").replace(/[^0-9]/g, "").slice(-10);
        if (qMobile && cleanMobileStr && qMobile === cleanMobileStr) return true;
        if (q.name && q.name.toLowerCase().trim() === (patientName || "").toLowerCase().trim()) return true;
        return false;
      });
      if (matchingQueueItem) {
        await completeQueuePatient(matchingQueueItem.id);
      }
    } catch (err) {
      console.warn("Failed to auto-checkout queue patient:", err);
    }
  };

  // Add patient to queue
  const addToQueue = async (e) => {
    e.preventDefault();
    if (!queueName.trim()) return;
    
    const newItem = {
      id: "Q-" + Date.now(),
      name: queueName,
      age: queueAge,
      gender: queueGender,
      mobile: queueMobile,
      reason: queueReason,
      status: "Waiting",
      timestamp: new Date().toISOString(),
      preferredTime: "Walk-in"
    };
    
    const updated = [...liveQueue, newItem];
    setLiveQueue(updated);
    await putItem("queue", newItem);
    
    setQueueName("");
    setQueueAge("");
    setQueueGender("Male");
    setQueueMobile("");
    setQueueReason("");
    
    triggerNotification(`Added ${newItem.name} to waiting list.`);
  };

  // JSON Database Export
  const handleExportBackup = async () => {
    try {
      const patients = await getAllItems("patients");
      const visits = await getAllItems("visits");
      const queue = await getAllItems("queue");
      const archived_records = await getAllItems("archived_records");
      const registry = await getAllItems("registry");
      
      const backupData = {
        version: 3,
        exportedAt: new Date().toISOString(),
        patients,
        visits,
        queue,
        archived_records,
        registry
      };
      
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ayurkaya_clinic_backup_${new Date().toISOString().split("T")[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      triggerNotification("Database backup file generated successfully.");
    } catch (err) {
      console.error(err);
      triggerNotification("Failed to export backup.");
    }
  };

  // JSON Database Import
  const handleImportBackup = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        
        // Support importing either version 3 (new cloud format) or version 2 (cases/registry/queue)
        const hasVersion3Data = data.version === 3 && Array.isArray(data.patients);
        const hasVersion2Data = data.version === 2 && Array.isArray(data.cases);

        if (hasVersion3Data || hasVersion2Data) {
          // Clear current stores first
          await clearStore("patients");
          await clearStore("visits");
          await clearStore("queue");
          await clearStore("archived_records");
          await clearStore("registry");

          if (hasVersion3Data) {
            // Restore version 3 (patients + visits + queue + archived_records + registry)
            for (const p of data.patients) {
              await putItem("patients", p);
            }
            if (Array.isArray(data.visits)) {
              for (const v of data.visits) {
                await putItem("visits", v);
              }
            }
            if (Array.isArray(data.queue)) {
              for (const q of data.queue) {
                await putItem("queue", q);
              }
            }
            if (Array.isArray(data.archived_records)) {
              for (const ar of data.archived_records) {
                await putItem("archived_records", ar);
              }
            }
            if (Array.isArray(data.registry)) {
              for (const r of data.registry) {
                await putItem("registry", r);
              }
            }
          } else {
            // Backward compatibility: Restore version 2 (cases -> patients/visits)
            const importedPatients = new Map();
            const importedVisits = [];
            const importedRegistry = [];

            // 1. Recover patients from registry or cases
            const registryList = Array.isArray(data.registry) ? data.registry : [];
            for (const reg of registryList) {
              if (reg.patientId) {
                importedPatients.set(reg.patientId, reg);
                importedRegistry.push(reg);
              }
            }

            // 2. Recover visits and patient profiles from cases
            for (const c of data.cases) {
              const patientId = c.patientId;
              if (!patientId) continue;

              // If this patient profile wasn't in registry, reconstruct from case
              if (!importedPatients.has(patientId)) {
                const patientProfile = {
                  patientId,
                  name: c.name || "",
                  age: c.age || "",
                  gender: c.gender || "Male",
                  mobile: c.mobile || "",
                  occupation: c.occupation || ""
                };
                importedPatients.set(patientId, patientProfile);

                const registryProfile = {
                  patientId,
                  name: c.name || "",
                  gender: c.gender || "Male",
                  mobile: c.mobile || "",
                  occupation: c.occupation || "",
                  updatedAt: new Date().toISOString()
                };
                importedRegistry.push(registryProfile);
              }

              // Extract visits from case
              const activeVisit = {
                visitId: c.visitId || `VIS-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                patientId,
                visitDate: c.visitDate || new Date().toISOString(),
                status: "active",
                kshudha: c.kshudha || "Sama",
                mutra: c.mutra || "Normal",
                mala: c.mala || "Regular",
                koshtha: c.koshtha || "Madhya",
                nidra: c.nidra || "Sound Sleep",
                avastha: c.avastha || "Sama",
                prakriti: c.prakriti || "Vata-Pitta",
                vikriti: c.vikriti || "Vata",
                doshajaVikriti: c.doshajaVikriti || "Vataja",
                dhatugataVikriti: c.dhatugataVikriti || [],
                dosha: c.dosha || { vata: true, pitta: false, kapha: false },
                dushya: c.dushya || { rasa: true, rakta: false, mamsa: false, meda: false, asthi: false, majja: false, shukra: false },
                srotas: c.srotas || { annavaha: true, pranavaha: false, rasavaha: false, raktavaha: false, medovaha: false, mutravaha: false, purishavaha: false },
                agni: c.agni || "Sama",
                samprapti: c.samprapti || "",
                sampraptiCustom: c.sampraptiCustom || "",
                ayurvedicDiagnosis: c.ayurvedicDiagnosis || "",
                modernDiagnosis: c.modernDiagnosis || "",
                diet: c.diet || "Vegetarian",
                mealPattern: c.mealPattern || "Regular",
                waterIntake: c.waterIntake || "1–2 L/day",
                viruddhaAhara: c.viruddhaAhara || "Never",
                teaCoffee: c.teaCoffee || "None",
                activity: c.activity || "Sedentary",
                exercise: c.exercise || "None",
                divaswap: c.divaswap || "Never",
                screenTime: c.screenTime || "<2 hrs",
                medicines: c.medicines || [],
                panchakarma: c.panchakarma || [],
                visitNumber: c.visitNumber || "1",
                outcomeScore: c.outcomeScore || "No Improvement",
                nextPlan: c.nextPlan || "Continue Same Treatment",
                notes: c.notes || "",
                doctorsNotes: c.doctorsNotes || ""
              };
              importedVisits.push(activeVisit);

              if (Array.isArray(c.visits)) {
                for (const hv of c.visits) {
                  importedVisits.push({
                    ...hv,
                    patientId,
                    status: hv.status || "completed"
                  });
                }
              }
            }

            // Save migrated data to Firestore
            for (const p of importedPatients.values()) {
              await putItem("patients", p);
            }
            for (const v of importedVisits) {
              await putItem("visits", v);
            }
            for (const r of importedRegistry) {
              await putItem("registry", r);
            }
            if (Array.isArray(data.queue)) {
              for (const q of data.queue) {
                await putItem("queue", q);
              }
            }
          }

          // Reload React state from Firestore
          const patientsList = await getAllItems("patients");
          const visitsList = await getAllItems("visits");
          
          const patientVisitsMap = {};
          visitsList.forEach(v => {
            if (!patientVisitsMap[v.patientId] || new Date(v.visitDate) > new Date(patientVisitsMap[v.patientId].visitDate)) {
              patientVisitsMap[v.patientId] = v;
            }
          });
          
          const combinedPatients = patientsList.map(patient => {
            const lastVisit = patientVisitsMap[patient.patientId] || {};
            return {
              ...patient,
              ...lastVisit
            };
          });
          combinedPatients.sort((a, b) => new Date(b.visitDate || 0) - new Date(a.visitDate || 0));
          setSavedCases(combinedPatients);
          
          const loadedQueue = await getAllItems("queue");
          setLiveQueue(loadedQueue);

          // Update storage metrics to reflect the new state
          const { getStorageMetrics } = await import("../lib/archiveService.js");
          const m = await getStorageMetrics();
          setStorageMetrics(m);

          triggerNotification("All database records restored successfully!");
          e.target.value = null; // reset input
        } else {
          alert("Invalid backup file structure. Import aborted.");
        }
      } catch (err) {
        console.error(err);
        alert("Failed to parse JSON backup file.");
      }
    };
    reader.readAsText(file);
  };

  // Reset entire database
  const handleResetDatabase = async () => {
    const passcode = prompt("Enter doctor authentication passcode (1008) to reset database:");
    if (passcode === "1008") {
      if (confirm("WARNING: This will permanently delete ALL patient records, visits, registries, archives, and queue history from both the website AND Firebase cloud. This action cannot be undone. Proceed?")) {
        try {
          // Clear ALL Firestore collections permanently
          await clearStore("patients");
          await clearStore("visits");
          await clearStore("archived_records");
          await clearStore("registry");
          await clearStore("queue");

          // Reset all local UI states
          setSavedCases([]);
          setLiveQueue([]);
          setCurrentCase({ ...DEFAULT_STATE });
          setCompletedTabs({});

          // Refresh storage metrics to reflect the empty database
          const { getStorageMetrics } = await import("../lib/archiveService.js");
          const m = await getStorageMetrics();
          setStorageMetrics(m);

          triggerNotification("Clinic database fully cleared and reset from both website and Firebase cloud.");
        } catch (err) {
          console.error("Database reset failed:", err);
          triggerNotification("Failed to reset database. Check console for details.");
        }
      }
    } else if (passcode !== null) {
      alert("Incorrect passcode. Database reset cancelled.");
    }
  };

  // Cleanup historical patient visits beyond the selected threshold
  const runStorageCleanupSweep = async () => {
    const threshold = new Date();
    let label = "";
    if (cleanupThreshold === "1m") {
      threshold.setMonth(threshold.getMonth() - 1);
      label = "1 month";
    } else if (cleanupThreshold === "3m") {
      threshold.setMonth(threshold.getMonth() - 3);
      label = "3 months";
    } else if (cleanupThreshold === "6m") {
      threshold.setMonth(threshold.getMonth() - 6);
      label = "6 months";
    } else if (cleanupThreshold === "9m") {
      threshold.setMonth(threshold.getMonth() - 9);
      label = "9 months";
    } else if (cleanupThreshold === "1y") {
      threshold.setFullYear(threshold.getFullYear() - 1);
      label = "1 year";
    }

    if (!window.confirm(`This will perform a historical purge sweep for visits older than ${label}.\n\nFor every patient, the system will:\n1. Keep all basic profile and contact details intact.\n2. Delete all active and archived visits older than the ${label} threshold.\n\nDo you want to proceed?`)) {
      return;
    }

    try {
      const { collection, getDocs, query, where } = await import("firebase/firestore");
      const { db: fdb } = await import("../lib/firebase.js");
      
      let deletedVisitsCount = 0;
      let deletedArchivesCount = 0;

      // Get all patients registered
      const patientsList = await getAllItems("patients");
      if (patientsList.length === 0) {
        triggerNotification("No patient profiles found to clean up.");
        return;
      }

      for (const patient of patientsList) {
        const patientId = patient.patientId;
        
        // Fetch all visits
        const visitsQuery = query(collection(fdb, "visits"), where("patientId", "==", patientId));
        const visitsSnapshot = await getDocs(visitsQuery);
        const patientVisits = visitsSnapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));

        // Fetch all archives
        const archivedQuery = query(collection(fdb, "archived_records"), where("patientId", "==", patientId));
        const archivedSnapshot = await getDocs(archivedQuery);
        const patientArchives = archivedSnapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));

        // Combine
        const allVisits = [
          ...patientVisits.map(v => ({ ...v, type: "active" })),
          ...patientArchives.map(a => ({ ...a, type: "archive" }))
        ];

        // Process all visits matching the threshold
        for (const visit of allVisits) {
          const visitDateStr = visit.visitDate || visit.data?.visitDate;
          if (!visitDateStr) continue;
          
          const visitDate = new Date(visitDateStr);
          // If the visit is older than our threshold date, purge it!
          if (visitDate < threshold) {
            if (visit.type === "active") {
              await deleteItem("visits", visit.id);
              deletedVisitsCount++;
            } else if (visit.type === "archive") {
              await deleteItem("archived_records", visit.id);
              deletedArchivesCount++;
            }
          }
        }
      }

      triggerNotification(`Historical purge complete: Deleted ${deletedVisitsCount} old active visits and ${deletedArchivesCount} archives.`);
      
      // C. Refresh metrics and states
      const { getStorageMetrics } = await import("../lib/archiveService.js");
      const m = await getStorageMetrics();
      setStorageMetrics(m);
      
      // D. Re-fetch visits and patients to update savedCases
      const patientsListUpdated = await getAllItems("patients");
      const visitsUpdated = await getAllItems("visits");
      const patientVisitsMap = {};
      visitsUpdated.forEach(v => {
        if (!patientVisitsMap[v.patientId] || new Date(v.visitDate) > new Date(patientVisitsMap[v.patientId].visitDate)) {
          patientVisitsMap[v.patientId] = v;
        }
      });
      const combinedPatients = patientsListUpdated.map(p => {
        const latestVisit = patientVisitsMap[p.patientId];
        if (latestVisit) {
          return {
            ...p,
            visitDate: latestVisit.visitDate,
            complaints: latestVisit.chiefComplaints || latestVisit.complaints || [],
            labTests: latestVisit.labTests || [],
            outcomeScore: latestVisit.outcomeScore || "No Improvement",
            prakriti: latestVisit.prakriti || p.prakriti || "Vata-Pitta",
            agni: latestVisit.agni || "Sama",
            mala: latestVisit.mala || "Regular",
            medicines: latestVisit.medicines || [],
            nextFollowUp: latestVisit.nextFollowUp || "15 Days"
          };
        }
        return {
          ...p,
          visitDate: p.createdAt || p.updatedAt
        };
      });
      combinedPatients.sort((a, b) => new Date(b.visitDate || 0) - new Date(a.visitDate || 0));
      setSavedCases(combinedPatients);
      
    } catch (err) {
      console.error("Storage cleanup failed:", err);
      triggerNotification("Failed to run storage cleanup.");
    }
  };

  // Compile visual stats metrics
  const getAnalytics = () => {
    const totalCases = savedCases.length;
    const uniqueMobiles = new Set(savedCases.map(c => c.mobile).filter(Boolean));
    const totalPatients = uniqueMobiles.size;

    const genderCounts = { Male: 0, Female: 0, Other: 0 };
    const ageCounts = { "0-18": 0, "19-35": 0, "36-50": 0, "51-65": 0, "66+": 0 };
    const prakritiCounts = {};
    const agniCounts = {};
    const malaCounts = {};
    const complaintCounts = {};

    savedCases.forEach(c => {
      // Gender
      if (genderCounts[c.gender] !== undefined) genderCounts[c.gender]++;
      else genderCounts.Male++;

      // Age
      const age = parseInt(c.age);
      if (!isNaN(age)) {
        if (age <= 18) ageCounts["0-18"]++;
        else if (age <= 35) ageCounts["19-35"]++;
        else if (age <= 50) ageCounts["36-50"]++;
        else if (age <= 65) ageCounts["51-65"]++;
        else ageCounts["66+"]++;
      }

      // Prakriti
      const prak = c.prakriti || "Vata-Pitta";
      prakritiCounts[prak] = (prakritiCounts[prak] || 0) + 1;

      // Agni
      const agn = c.agni || "Sama";
      agniCounts[agn] = (agniCounts[agn] || 0) + 1;

      // Bowel (mala)
      const bowel = c.mala || "Normal";
      malaCounts[bowel] = (malaCounts[bowel] || 0) + 1;

      // Complaints
      if (Array.isArray(c.complaints)) {
        c.complaints.forEach(comp => {
          if (comp.text && comp.text.trim()) {
            const txt = comp.text.trim().toLowerCase();
            complaintCounts[txt] = (complaintCounts[txt] || 0) + 1;
          }
        });
      }
    });

    return {
      totalCases,
      totalPatients,
      genderCounts,
      ageCounts,
      prakritiCounts,
      agniCounts,
      malaCounts,
      complaintCounts: Object.entries(complaintCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5) // top 5
    };
  };

  // Identify patients with critical lab vitals or due follow-ups
  const getFollowupsAndAlerts = () => {
    const alerts = [];
    const followups = [];
    const now = new Date();

    savedCases.forEach(c => {
      // 1. Vitals Lab Alerts
      if (Array.isArray(c.labTests)) {
        c.labTests.forEach(t => {
          const val = parseFloat(t.value);
          if (!isNaN(val)) {
            if (t.testName.includes("HbA1c") && val > 5.6) {
              alerts.push({
                patientName: c.name,
                mobile: c.mobile,
                parameter: t.testName,
                measured: `${val}%`,
                normalRange: "4.0 - 5.6%",
                severity: val >= 6.5 ? "Critical" : "Warning",
                visitDate: c.visitDate
              });
            }
            if (t.testName.includes("Total Cholesterol") && val > 200) {
              alerts.push({
                patientName: c.name,
                mobile: c.mobile,
                parameter: t.testName,
                measured: `${val} mg/dL`,
                normalRange: "< 200 mg/dL",
                severity: val >= 240 ? "Critical" : "Warning",
                visitDate: c.visitDate
              });
            }
            if (t.testName.includes("Fasting Blood Sugar") && val > 100) {
              alerts.push({
                patientName: c.name,
                mobile: c.mobile,
                parameter: t.testName,
                measured: `${val} mg/dL`,
                normalRange: "70 - 100 mg/dL",
                severity: val >= 126 ? "Critical" : "Warning",
                visitDate: c.visitDate
              });
            }
            if (t.testName.includes("Serum Creatinine") && val > 1.2) {
              alerts.push({
                patientName: c.name,
                mobile: c.mobile,
                parameter: t.testName,
                measured: `${val} mg/dL`,
                normalRange: "0.5 - 1.2 mg/dL",
                severity: val >= 1.5 ? "Critical" : "Warning",
                visitDate: c.visitDate
              });
            }
          }
        });
      }

      // 2. Follow-ups / Revisits required
      // Only show in pending revisits list if rating is < 5 AND last visit was within the last 14 days.
      // If last visit was > 14 days ago, patient is auto-considered cured (5/5) and cleared from pending list.
      if (c.visitDate) {
        const visit = new Date(c.visitDate);
        const diffTime = now.getTime() - visit.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        let score = c.wellnessRating;
        if (score === undefined || score === null) {
          const outcomeStr = (c.outcomeScore || "No Improvement").toLowerCase();
          score = 1; // default starting rating
          if (outcomeStr.includes("marked")) score = 5;
          else if (outcomeStr.includes("moderate")) score = 4;
          else if (outcomeStr.includes("mild")) score = 3;
          else if (outcomeStr.includes("minimal")) score = 2;
          else if (outcomeStr.includes("no improvement") || outcomeStr.includes("worsened")) score = 1;
        }

        if (score < 5 && diffDays <= 14) {
          // Check if this patient is already listed (keep newest sheet only)
          if (!followups.some(f => f.mobile === c.mobile)) {
            followups.push({
              name: c.name,
              patientId: c.patientId,
              mobile: c.mobile,
              lastVisit: c.visitDate,
              daysAgo: diffDays,
              wellnessRating: score,
              reason: c.complaints?.[0]?.text || "Routine Consultation"
            });
          }
        }
      }
    });

    return { alerts, followups };
  };

  // Filtered cases list sidebar search
  const filteredCasesList = savedCases.filter(c => 
    (c.name || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.mobile || "").includes(searchTerm) ||
    (c.patientId || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isTabComplete = (tabId) => {
    if (tabId === "profile") {
      return currentCase.name?.trim() !== "" && (currentCase.patientId || currentCase.dateOfBirth);
    }
    if (tabId === "complaints") {
      const hasComplaints = currentCase.complaints?.some(c => c.text?.trim() !== "");
      const hasHistory = currentCase.surgicalHistory?.trim() !== "" || 
                         currentCase.drugAllergy?.trim() !== "" || 
                         currentCase.anyOther?.trim() !== "" ||
                         Object.values(currentCase.pastHistory || {}).some(v => v === true || (typeof v === 'string' && v.trim() !== "")) ||
                         Object.values(currentCase.familyHistory || {}).some(v => v === true || (typeof v === 'string' && v.trim() !== "")) ||
                         currentCase.drugHistory?.hasHistory === "Yes";
      return hasComplaints || hasHistory || completedTabs["complaints"];
    }
    if (tabId === "core") {
      const isModified = currentCase.kshudha !== "Sama" || 
                         currentCase.mutra !== "Normal" || 
                         currentCase.mala !== "Regular" || 
                         currentCase.koshtha !== "Madhya" || 
                         currentCase.nidra !== "Sound Sleep" || 
                         currentCase.avastha !== "Sama";
      return isModified || completedTabs["core"];
    }
    if (tabId === "diagnosis") {
      const isModified = currentCase.prakriti !== "Vata-Pitta" || 
                         currentCase.vikriti !== "Vata" || 
                         currentCase.doshajaVikriti !== "Vataja" ||
                         currentCase.dhatugataVikriti?.length > 0 ||
                         currentCase.ayurvedicDiagnosis?.trim() !== "" || 
                         currentCase.modernDiagnosis?.trim() !== "" ||
                         currentCase.samprapti?.trim() !== "" ||
                         currentCase.sampraptiCustom?.trim() !== "";
      return isModified || completedTabs["diagnosis"];
    }
    if (tabId === "lifestyle") {
      const isModified = currentCase.diet !== "Vegetarian" || 
                         currentCase.mealPattern !== "Regular" || 
                         currentCase.waterIntake !== "1–2 L/day" || 
                         currentCase.viruddhaAhara !== "Never" || 
                         currentCase.teaCoffee !== "None" || 
                         currentCase.activity !== "Sedentary" || 
                         currentCase.exercise !== "None" ||
                         currentCase.divaswap !== "Never" ||
                         currentCase.screenTime !== "<2 hrs";
      return isModified || completedTabs["lifestyle"];
    }
    if (tabId === "treatment") {
      return currentCase.medicines?.some(m => m.name?.trim() !== "") || completedTabs["treatment"];
    }
    if (tabId === "panchakarma") {
      return currentCase.panchakarma?.length > 0 || currentCase.doctorsNotes?.trim() !== "" || completedTabs["panchakarma"];
    }
    if (tabId === "labs") {
      return currentCase.labTests?.some(l => l.testName?.trim() !== "") || completedTabs["labs"];
    }
    return false;
  };

  const handleNextTab = () => {
    const next = getNextTab();
    if (next) {
      if (activeTab === "profile" && !currentCase.name?.trim()) {
        triggerNotification("Patient Name is required to proceed.");
        return;
      }
      if (activeTab === "profile" && !currentCase.patientId && !currentCase.dateOfBirth) {
        triggerNotification("Date of Birth is required for new patient registration.");
        return;
      }
      setCompletedTabs(prev => ({ ...prev, [activeTab]: true }));
      setActiveTab(next);
    }
  };

  const handleSkipQueuePatient = async (patient) => {
    if (!patient) return;
    const updated = {
      ...patient,
      timestamp: new Date().toISOString()
    };
    // Update local state immediately
    setLiveQueue(prev => prev.map(q => q.id === patient.id ? updated : q));
    // Persist to IndexedDB/cloud
    await putItem("queue", updated);
    triggerNotification(`Moved ${patient.name} to the end of the queue.`);
  };

  const wizardTabs = [
    { id: "profile", label: "Patient Profile" },
    { id: "complaints", label: "Complaints and History" },
    { id: "core", label: "Ayur Core" },
    { id: "diagnosis", label: "Diagnosis" },
    { id: "lifestyle", label: "Lifestyle" },
    { id: "treatment", label: "Prescription" },
    { id: "panchakarma", label: "Panchakarma and Advice" },
    { id: "labs", label: "Labs and Follow-up" }
  ];

  const getNextTab = () => {
    const idx = wizardTabs.findIndex(t => t.id === activeTab);
    if (idx < wizardTabs.length - 1) return wizardTabs[idx + 1].id;
    return null;
  };

  const getPrevTab = () => {
    const idx = wizardTabs.findIndex(t => t.id === activeTab);
    if (idx > 0) return wizardTabs[idx - 1].id;
    return null;
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center bg-brand-cream/40 px-4 py-12">
        <SEO title="Redirecting..." description="Authenticating Doctor..." />
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary" />
      </div>
    );
  }

  // Print Prescription View Mode
  if (isPrintMode) {
    return (
      <div className="bg-white text-black min-h-screen p-4 sm:p-8 md:p-16 max-w-4xl mx-auto font-sans print:p-0 print:m-0 print:max-w-none print:block space-y-6 sm:space-y-8 animate-fadeIn">
        <SEO title={`Case Print - ${currentCase.name || "Patient"}`} description="Ayurkaya Case Record Prescription Printout Form." />
        
        {/* Actions bar for printing */}
        <div className="flex flex-col lg:flex-row justify-between items-center bg-brand-cream border border-brand-light/60 p-4 rounded-2xl print:hidden shadow-sm gap-4">
          <button
            onClick={() => {
              setIsPrintMode(false);
              setViewMode(printReferrer);
            }}
            className="flex items-center text-xs font-bold text-brand-primary hover:text-brand-secondary uppercase tracking-wider gap-1.5 shrink-0 self-start lg:self-center"
          >
            {printReferrer === "recent_cases" ? "← Back to Case Sheets Directory" : "← Back to Workspace"}
          </button>
          <div className="flex flex-wrap gap-2 w-full lg:w-auto justify-start lg:justify-end">
            <button
              onClick={handleSendToPatientWhatsApp}
              className="flex-1 lg:flex-initial flex items-center justify-center gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 px-3 py-2 sm:px-5 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer min-w-fit"
            >
              <MessageCircle size={14} /> Send to Patient (WhatsApp)
            </button>
            <button
              onClick={handleSaveAsPDF}
              className="flex-1 lg:flex-initial flex items-center justify-center gap-1.5 bg-brand-secondary text-brand-beige hover:bg-brand-primary px-3 py-2 sm:px-5 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer min-w-fit"
            >
              <Download size={14} /> Save as PDF
            </button>
            <button
              onClick={() => window.print()}
              className="flex-1 lg:flex-initial flex items-center justify-center gap-1.5 bg-brand-primary text-brand-beige hover:bg-brand-secondary px-3 py-2 sm:px-5 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer min-w-fit"
            >
              <Printer size={14} /> Send to Print / PDF
            </button>
          </div>
        </div>

        {/* Print Content Area */}
        <div id="case-sheet-printout" className="border-4 border-double border-emerald-950 p-4 sm:p-6 md:p-8 space-y-8 bg-white">
          {/* Clinic Header */}
          <div className="flex justify-between items-start border-b border-brand-primary/25 pb-6">
            <div className="space-y-1">
              <span className="font-serif text-3xl font-extrabold text-emerald-900 tracking-tight block">
                AYURKAYA
              </span>
              <span className="text-[10px] tracking-widest text-emerald-800 uppercase font-bold block">
                Ayurvedic Integrative Wellness Center
              </span>
              <p className="text-[10px] text-gray-600 font-medium leading-relaxed">
                <span className="font-bold text-gray-800">Borivali (W) Clinic:</span> Aayushree Ayurved Polyclinic • +91 70212 72264<br/>
                <span className="font-bold text-gray-800">Kandivali (W) Clinic 1:</span> Aaroyam Panchakarma Centre • +91 93269 73764<br/>
                <span className="font-bold text-gray-800">Kandivali (W) Clinic 2:</span> Dubal's Clinic • +91 79992 53864
              </p>
            </div>
            <div className="text-right space-y-1 shrink-0">
              <h3 className="font-serif text-lg font-bold text-emerald-900">Dr. Neha, B.A.M.S</h3>
              <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Chief Consultant Physician</p>
              <p className="text-xs text-gray-600">Reg No: AYUSH-A-2014-9023</p>
            </div>
          </div>

          {/* Patient Details Info Block */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 bg-emerald-50/50 p-4 rounded-xl text-xs border border-emerald-100">
            <div>
              <span className="text-gray-500 font-semibold uppercase block text-[10px]">Patient ID</span>
              <span className="font-bold text-gray-900 mt-0.5 block font-mono">{currentCase.patientId || "N/A"}</span>
            </div>
            <div>
              <span className="text-gray-500 font-semibold uppercase block text-[10px]">Patient Name</span>
              <span className="font-bold text-gray-900 text-sm mt-0.5 block">{currentCase.name || "N/A"}</span>
            </div>
            <div>
              <span className="text-gray-500 font-semibold uppercase block text-[10px]">Age / Gender</span>
              <span className="font-bold text-gray-900 mt-0.5 block">{currentCase.age || "N/A"} Yrs / {currentCase.gender}</span>
            </div>
            <div>
              <span className="text-gray-500 font-semibold uppercase block text-[10px]">Contact Mobile</span>
              <span className="font-bold text-gray-900 mt-0.5 block">{currentCase.mobile || "N/A"}</span>
            </div>
            <div>
              <span className="text-gray-500 font-semibold uppercase block text-[10px]">Consultation Date</span>
              <span className="font-bold text-gray-900 mt-0.5 block">{currentCase.visitDate ? new Date(currentCase.visitDate).toLocaleDateString() : new Date().toLocaleDateString()}</span>
            </div>
          </div>

          {/* Chief Complaints */}
          <div className="space-y-2">
            <h4 className="font-serif text-sm font-bold uppercase tracking-wider text-emerald-900 border-b border-gray-200 pb-1">
              Chief Complaints
            </h4>
            <ul className="list-disc pl-5 text-xs text-gray-800 space-y-1">
              {currentCase.complaints.map((c, i) => {
                const text = typeof c === "string" ? c : (c && c.text ? c.text : "");
                const onsetDate = typeof c === "string" ? "" : (c && c.onsetDate ? c.onsetDate : "");
                return text.trim() && (
                  <li key={i}>
                    <span className="font-semibold text-gray-900">{text}</span>
                    {onsetDate ? (
                      <span> — Onset: <span className="italic">{formatOnsetDateTime(onsetDate)}</span></span>
                    ) : (
                      <span> — Onset: <span className="italic">N/A</span></span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Clinical Summaries Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Ayurvedic Diagnostics (Prakriti, Agni, etc) */}
            <div className="border border-gray-100 p-4 rounded-xl space-y-2.5">
              <h5 className="font-serif text-xs font-bold uppercase tracking-wide text-emerald-900 border-b border-gray-200 pb-1">
                Ayurvedic Diagnostic Assessment
              </h5>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                <div>
                  <span className="text-gray-500 block">Prakriti (Constitutional):</span>
                  <span className="font-bold text-gray-900">{currentCase.prakriti}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Vikriti (Doshaja):</span>
                  <span className="font-bold text-gray-900">{currentCase.doshajaVikriti || currentCase.vikriti}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Vikriti (Dhatugata):</span>
                  <span className="font-bold text-gray-900">
                    {currentCase.dhatugataVikriti?.length > 0 ? currentCase.dhatugataVikriti.join(", ") : "None"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block">Jatharagni (Digestive):</span>
                  <span className="font-bold text-gray-900">{currentCase.agni}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Koshtha (Gut Nature):</span>
                  <span className="font-bold text-gray-900">{currentCase.koshtha}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Avastha (Metabolism):</span>
                  <span className="font-bold text-gray-900">{currentCase.avastha}</span>
                </div>
                {(currentCase.ayurvedicDiagnosis || currentCase.modernDiagnosis) && (
                  <div className="col-span-2">
                    <span className="text-gray-500 block">Clinical Diagnosis:</span>
                    <span className="font-bold text-gray-900">
                      {currentCase.ayurvedicDiagnosis ? `Ayurvedic: ${currentCase.ayurvedicDiagnosis}` : ""}
                      {currentCase.ayurvedicDiagnosis && currentCase.modernDiagnosis ? " | " : ""}
                      {currentCase.modernDiagnosis ? `Modern: ${currentCase.modernDiagnosis}` : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* General Vitals and Additional History */}
            <div className="border border-gray-100 p-4 rounded-xl space-y-2.5">
              <h5 className="font-serif text-xs font-bold uppercase tracking-wide text-emerald-900 border-b border-gray-200 pb-1">
                Clinical Vitals and Medical History
              </h5>
              <div className="space-y-1.5 text-gray-800">
                <p>
                  <span className="text-gray-500">Past History: </span>
                  <span className="font-semibold">
                    {Object.entries(currentCase.pastHistory).filter(([k, v]) => v && k !== "others").map(([k]) => k.toUpperCase()).join(", ")}
                    {currentCase.pastHistory.others ? `, ${currentCase.pastHistory.others}` : ""}
                  </span>
                </p>
                <p>
                  <span className="text-gray-500">Family History: </span>
                  <span className="font-semibold">
                    {Object.entries(currentCase.familyHistory).filter(([k, v]) => v && k !== "others").map(([k]) => k.toUpperCase()).join(", ")}
                    {currentCase.familyHistory.others ? `, ${currentCase.familyHistory.others}` : ""}
                  </span>
                </p>
                <p>
                  <span className="text-gray-500">Drug History: </span>
                  <span className="font-semibold">{currentCase.drugHistory.hasHistory === "Yes" ? currentCase.drugHistory.details : "No significant details"}</span>
                </p>
                <p>
                  <span className="text-gray-500">Panchakarma Advised: </span>
                  <span className="font-bold text-emerald-800">
                    {Array.isArray(currentCase.panchakarma) ? currentCase.panchakarma.join(", ") : currentCase.panchakarma}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Medicines Prescription Table */}
          <div className="space-y-3">
            <h4 className="font-serif text-sm font-bold uppercase tracking-wider text-emerald-900 border-b border-gray-200 pb-1 flex items-center gap-1">
              💊 Advised Rx (Prescription)
            </h4>
            
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-emerald-50 text-emerald-900 border-b border-emerald-250 font-bold uppercase">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Medicine Name</th>
                  <th className="py-2.5 px-3">Dosage / Frequency</th>
                  <th className="py-2.5 px-3">Administration (Kala)</th>
                  <th className="py-2.5 px-3">Anupana (Vehicle)</th>
                  <th className="py-2.5 px-3 text-right">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-800">
                {currentCase.medicines.map((med, idx) => (
                  med.name.trim() && (
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="py-3 px-3 font-semibold text-gray-400">{idx + 1}</td>
                      <td className="py-3 px-3 font-bold text-emerald-900">{med.name}</td>
                      <td className="py-3 px-3">{med.dose} {med.frequency && `• ${med.frequency}`}</td>
                      <td className="py-3 px-3 font-medium">{med.kala}</td>
                      <td className="py-3 px-3 italic">{med.anupana}</td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-900">{med.duration}</td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>

          {/* Lab Investigations Table (Only render if there are tests) */}
          {currentCase.labTests.length > 0 && (
            <div className="space-y-3 pt-4">
              <h4 className="font-serif text-sm font-bold uppercase tracking-wider text-emerald-900 border-b border-gray-200 pb-1">
                🔬 Investigation Reports (Lab Panels)
              </h4>
              
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-800 border-b border-gray-200 font-bold">
                    <th className="py-2.5 px-3">Test Parameters</th>
                    <th className="py-2.5 px-3 text-center">Measured Value</th>
                    <th className="py-2.5 px-3 text-center">Reference Range</th>
                    <th className="py-2.5 px-3 text-center">Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {currentCase.labTests.map((t, idx) => (
                    t.testName.trim() && (
                      <tr key={idx}>
                        <td className="py-2 px-3 font-medium">{t.testName}</td>
                        <td className="py-2 px-3 text-center font-bold text-gray-900">{t.value || "—"}</td>
                        <td className="py-2 px-3 text-center text-gray-500">{t.range}</td>
                        <td className="py-2 px-3 text-center text-gray-500">{t.unit}</td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* General Notes */}
          {(currentCase.notes || currentCase.doctorsNotes || currentCase.nextFollowUp) && (
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-xs space-y-3">
              {currentCase.notes && (
                <div>
                  <h5 className="font-serif font-bold text-gray-800 mb-1">Diet & Lifestyle (Pathya-Apathya):</h5>
                  <p className="text-gray-700 leading-relaxed italic">"{currentCase.notes}"</p>
                </div>
              )}
              {currentCase.doctorsNotes && (
                <div>
                  <h5 className="font-serif font-bold text-gray-800 mb-1">Clinical Notes:</h5>
                  <p className="text-gray-700 leading-relaxed">{currentCase.doctorsNotes}</p>
                </div>
              )}
              {currentCase.nextFollowUp && (
                <div>
                  <h5 className="font-serif font-bold text-gray-800 mb-1">Next Follow-Up: <span className="font-normal text-emerald-900">{currentCase.nextFollowUp}</span></h5>
                </div>
              )}
            </div>
          )}

          {/* Signature Area */}
          <div className="pt-12 flex justify-between items-end text-xs text-gray-700">
            <div>
              <p className="font-semibold text-emerald-900">Ayurkaya Clinic</p>
              <p className="text-[10px] text-gray-400">Electronic case record generation</p>
            </div>
            <div className="text-center w-48 space-y-1">
              <div className="h-0.5 bg-gray-300 w-full mb-1" />
              <p className="font-bold text-gray-900">Dr. Neha</p>
              <p className="text-[10px] uppercase font-bold text-gray-400">Consultant Signature</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { alerts, followups } = getFollowupsAndAlerts();
  const analytics = getAnalytics();

  return (
    <div className="min-h-screen bg-brand-beige flex flex-col lg:flex-row font-sans relative">
      <SEO title="Doctor Portal" description="Ayurkaya Clinic Dashboard for Dr. Neha." />

      {/* Global Toast Notification */}
      {notification && (
        <div
          style={{
            position: "fixed",
            top: "24px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            minWidth: "320px",
            maxWidth: "520px",
            padding: "14px 28px",
            background: "linear-gradient(135deg, #2d6a4f, #40916c)",
            color: "#fff",
            fontWeight: 600,
            fontSize: "14px",
            borderRadius: "12px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(45,106,79,0.3)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            animation: "toastSlideIn 0.4s ease-out",
            pointerEvents: "none",
          }}
        >
          <span style={{ fontSize: "18px" }}>✓</span>
          <span>{notification}</span>
        </div>
      )}

      {/* Backdrop overlay for mobile drawer */}
      {showSidebar && (
        <div 
          className="fixed inset-0 bg-black/45 backdrop-blur-xs z-[55] lg:hidden transition-all duration-300"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Main Switcher Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-[60] w-72 bg-brand-cream border-r border-brand-light/60 flex flex-col shrink-0 transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
        showSidebar 
          ? "translate-x-0 lg:flex lg:w-72" 
          : "-translate-x-full lg:hidden lg:w-0"
      }`}>
        
        {/* Module Switcher Buttons */}
        <div className="p-4 border-b border-brand-light/60 space-y-2">
          <div className="flex items-center justify-between pb-2">
            <span className="text-[10px] font-bold text-brand-secondary uppercase tracking-widest block">
              Ayurkaya Clinic
            </span>
            <button
              onClick={() => setShowSidebar(false)}
              className="lg:hidden p-1.5 bg-brand-beige border border-brand-light/60 rounded-xl hover:bg-brand-light/45 active:scale-95 transition-all text-brand-primary flex items-center justify-center cursor-pointer"
              title="Close Menu Sidebar"
            >
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-1.5">
            <button
              onClick={() => { setViewMode("clinical"); closeSidebarOnMobile(); }}
              className={`flex items-center gap-2.5 px-4.5 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                viewMode === "clinical" 
                  ? "bg-brand-primary text-brand-beige shadow-sm" 
                  : "bg-brand-beige text-brand-primary hover:bg-brand-light/45"
              }`}
            >
              <User size={15} />
              <span>Workspace</span>
            </button>
            <button
              onClick={() => { setViewMode("recent_cases"); closeSidebarOnMobile(); }}
              className={`flex items-center gap-2.5 px-4.5 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer relative ${
                viewMode === "recent_cases" 
                  ? "bg-brand-primary text-brand-beige shadow-sm" 
                  : "bg-brand-beige text-brand-primary hover:bg-brand-light/45"
              }`}
            >
              <History size={15} />
              <span>Case Sheets Directory</span>
            </button>
            <button
              onClick={() => { setViewMode("walkins"); closeSidebarOnMobile(); }}
              className={`flex items-center gap-2.5 px-4.5 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer relative ${
                viewMode === "walkins" 
                  ? "bg-brand-primary text-brand-beige shadow-sm" 
                  : "bg-brand-beige text-brand-primary hover:bg-brand-light/45"
              }`}
            >
              <Calendar size={15} />
              <span>Walk-ins & Search</span>
              {liveQueue.filter(q => q.status === "Waiting").length > 0 && (
                <span className="ml-auto bg-brand-accent/25 text-brand-primary text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {liveQueue.filter(q => q.status === "Waiting").length}
                </span>
              )}
            </button>
            <button
              onClick={() => { setViewMode("analytics"); closeSidebarOnMobile(); }}
              className={`flex items-center gap-2.5 px-4.5 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                viewMode === "analytics" 
                  ? "bg-brand-primary text-brand-beige shadow-sm" 
                  : "bg-brand-beige text-brand-primary hover:bg-brand-light/45"
              }`}
            >
              <BarChart3 size={15} />
              <span>Analytics</span>
              {analytics.totalCases > 0 && (
                <span className="ml-auto bg-brand-accent/25 text-brand-primary text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {analytics.totalCases}
                </span>
              )}
            </button>
            <button
              onClick={() => { setViewMode("followups"); closeSidebarOnMobile(); }}
              className={`flex items-center gap-2.5 px-4.5 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer relative ${
                viewMode === "followups" 
                  ? "bg-brand-primary text-brand-beige shadow-sm" 
                  : "bg-brand-beige text-brand-primary hover:bg-brand-light/45"
              }`}
            >
              <Bell size={15} />
              <span>Alerts Hub</span>
              {(alerts.length > 0 || followups.length > 0) && (
                <span className="ml-auto bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse">
                  {alerts.length + followups.length}
                </span>
              )}
            </button>
            <button
              onClick={() => { setViewMode("utilities"); closeSidebarOnMobile(); }}
              className={`flex items-center gap-2.5 px-4.5 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                viewMode === "utilities" 
                  ? "bg-brand-primary text-brand-beige shadow-sm" 
                  : "bg-brand-beige text-brand-primary hover:bg-brand-light/45"
              }`}
            >
              <Database size={15} />
              <span>Settings and Backups</span>
            </button>
          </div>
        </div>
        {/* Sidebar Case Sheets list (Only show when in clinical workspace) */}
        <div className="flex-grow hidden lg:block p-6 text-center text-xs text-brand-secondary/65 leading-relaxed border-b border-brand-light/30">
          <Shield size={36} className="mx-auto text-brand-secondary/30 mb-2" />
          <p><strong>Secure Connection</strong></p>
          <p className="text-[10px] mt-1">Firestore stores workspace data in the cloud so your clinic records remain available across browsers and devices.</p>
        </div>

        {/* Footer actions inside sidebar */}
        <div className="p-4 border-t border-brand-light/60 bg-brand-beige/40 flex justify-between items-center text-xs text-brand-secondary font-semibold shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span>Dr. Neha Portal</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-brand-primary hover:text-brand-accent transition-colors cursor-pointer"
            title="Log out Portal"
          >
            <LogOut size={14} /> Log out
          </button>
        </div>
      </div>

      {/* Main Workspace Frame */}
      <div className="flex-grow flex flex-col min-h-0 min-w-0 bg-brand-cream/30">
        
        {/* Module views header */}
        <div className="p-4 bg-brand-cream border-b border-brand-light/60 flex justify-between items-center shrink-0 flex-wrap gap-3">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2.5 bg-brand-beige border border-brand-light/60 rounded-xl hover:bg-brand-light/45 active:scale-95 transition-all cursor-pointer text-brand-primary flex items-center justify-center"
              title={showSidebar ? "Hide Menu Sidebar" : "Show Menu Sidebar"}
            >
              <Menu size={16} />
            </button>
            <span className="font-serif font-bold text-brand-primary text-lg">
              {viewMode === "clinical" && (currentCase.name ? `Clinical Record: ${currentCase.name}` : "New Consultation Case Sheet")}
              {viewMode === "walkins" && "Walk-ins & Search Directory"}
              {viewMode === "analytics" && "Clinic Analytics"}
              {viewMode === "followups" && "Alerts and Follow-ups Hub"}
              {viewMode === "utilities" && "System Settings and Backups"}
              {viewMode === "recent_cases" && "All Recent Case Sheets"}
            </span>
          </div>

          <div className="flex items-center space-x-3">
            {viewMode === "clinical" && (
              <>
                <button
                  onClick={handleNewPatientRegistration}
                  className="flex items-center gap-1.5 bg-brand-primary/10 border border-brand-primary/30 text-brand-primary hover:bg-brand-primary hover:text-brand-beige px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                >
                  <Plus size={14} /> New Consult
                </button>
                <button
                  onClick={saveCase}
                  className="flex items-center gap-1.5 bg-brand-secondary text-brand-beige hover:bg-brand-primary px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer"
                >
                  <Save size={14} /> Save Record
                </button>
                <button
                  onClick={() => {
                    if (!currentCase.name.trim()) {
                      triggerNotification("Must save patient profile with a name first!");
                      return;
                    }
                    setPrintReferrer("clinical");
                    setIsPrintMode(true);
                  }}
                  className="flex items-center gap-1.5 bg-brand-primary text-brand-beige hover:bg-brand-secondary px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer"
                >
                  <Printer size={14} /> Generate Rx / Print
                </button>
              </>
            )}
          </div>
        </div>

        {/* Wizard Stepper progress tracker (Only show in clinical mode) */}
        {viewMode === "clinical" && (
          <div
            ref={stepperRef}
            onMouseDown={handleStepperMouseDown}
            onMouseLeave={handleStepperMouseLeaveOrUp}
            onMouseUp={handleStepperMouseLeaveOrUp}
            onMouseMove={handleStepperMouseMove}
            className="flex overflow-x-auto bg-brand-cream/80 border-b border-brand-light/45 shrink-0 select-none scrollbar-none py-3 md:py-4 px-4 md:px-8 cursor-grab active:cursor-grabbing"
          >
            <div className="flex items-center space-x-1.5 md:space-x-3 mx-auto w-full max-w-5xl justify-start md:justify-between">
              {wizardTabs.map((t, idx) => {
                const isCurrent = activeTab === t.id;
                const isCompleted = isTabComplete(t.id);
                return (
                  <div key={t.id} className="flex items-center shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveTab(t.id)}
                      className={`${isCurrent ? "active-step-button " : ""}flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 rounded-full border transition-all text-[10px] md:text-xs font-bold uppercase tracking-wider whitespace-nowrap cursor-pointer ${
                        isCurrent
                          ? "bg-brand-primary border-brand-primary text-brand-beige shadow-sm scale-105"
                          : isCompleted
                          ? "bg-brand-light/40 border-brand-secondary/40 text-brand-secondary hover:bg-brand-light/60 hover:border-brand-secondary"
                          : "bg-transparent border-brand-light/50 text-brand-secondary/70 hover:text-brand-primary hover:border-brand-primary"
                      }`}
                    >
                      {/* Step Indicator circle */}
                      <span
                        className={`flex items-center justify-center w-4 md:w-5 h-4 md:h-5 rounded-full text-[9px] md:text-[10px] font-extrabold ${
                          isCurrent
                            ? "bg-brand-beige text-brand-primary"
                            : isCompleted
                            ? "bg-brand-secondary text-brand-beige"
                            : "bg-brand-light/20 text-brand-secondary/80 border border-brand-secondary/20"
                        }`}
                      >
                        {isCompleted ? "✓" : idx + 1}
                      </span>
                      <span>{t.label}</span>
                    </button>

                    {/* Stepper Line Connector */}
                    {idx < wizardTabs.length - 1 && (
                      <div
                        className={`h-0.5 w-4 md:w-6 lg:w-8 ml-1.5 md:ml-3 rounded transition-all shrink-0 ${
                          isCompleted ? "bg-brand-secondary/55" : "bg-brand-light/45"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Dynamic Inner Panel View Router */}
        <div className="flex-grow overflow-y-auto p-4 md:p-8 max-w-5xl w-full mx-auto">
          
          {/* ==================== VIEW 1: CLINICAL WORKSPACE ==================== */}
          {viewMode === "clinical" && (
            <div className="animate-fadeIn">

              {/* Tab 1: Patient Profile */}
              {activeTab === "profile" && (
                <div className="space-y-6">
                  {/* Demographic Card */}
                  <div className="bg-brand-cream border border-brand-light/60 p-6 rounded-3xl space-y-6 shadow-sm">
                    <div className="flex justify-between items-center border-b border-brand-light/40 pb-2 flex-wrap gap-2">
                      <h3 className="font-serif text-xl font-bold text-brand-primary">
                        1. Patient Demographic Profile
                      </h3>
                      {currentCase.mobile && currentCase.mobile.replace(/[^0-9]/g, "").length === 10 && (
                        <button
                          onClick={updateRegistryProfile}
                          className="flex items-center gap-1.5 bg-brand-secondary text-brand-beige hover:bg-brand-primary px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer"
                          title="Save details permanently"
                        >
                          <Save size={13} /> Update Registry Card
                        </button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Patient ID</label>
                        <div className="w-full bg-brand-light/10 border border-brand-light/45 px-4 py-3 rounded-xl text-sm font-mono text-brand-primary font-semibold select-all">
                          {currentCase.patientId || "Auto-created when saved"}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Patient Full Name</label>
                        <input
                          type="text"
                          value={currentCase.name}
                          onChange={(e) => handleTextChange("name", e.target.value)}
                          placeholder="e.g. Aditi Rao"
                          className="w-full bg-brand-beige border border-brand-light/50 px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-brand-secondary"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">
                            Date of Birth {!currentCase.patientId && <span className="text-red-500 font-bold">*</span>}
                          </label>
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              placeholder="DD-MM-YYYY"
                              value={dobInput}
                              onChange={(e) => {
                                let val = e.target.value.replace(/[^0-9-]/g, "");
                                let digits = val.replace(/-/g, "");
                                let formatted = "";
                                if (digits.length > 0) formatted += digits.substring(0, 2);
                                if (digits.length > 2) formatted += "-" + digits.substring(2, 4);
                                if (digits.length > 4) formatted += "-" + digits.substring(4, 8);
                                formatted = formatted.substring(0, 10);
                                if (e.nativeEvent.inputType === "deleteContentBackward" && val.endsWith("-")) {
                                  formatted = val;
                                }
                                setDobInput(formatted);
                                if (formatted.length === 10) {
                                  const parts = formatted.split("-");
                                  const d = parseInt(parts[0], 10);
                                  const m = parseInt(parts[1], 10);
                                  const y = parseInt(parts[2], 10);
                                  const testDate = new Date(y, m - 1, d);
                                  const today = new Date();
                                  today.setHours(0, 0, 0, 0);
                                  if (testDate.getDate() !== d || testDate.getMonth() !== m - 1 || testDate.getFullYear() !== y || testDate > today || y < 1900) {
                                    triggerNotification("Please enter a valid, non-future Date of Birth.");
                                    setDobInput("");
                                    handleTextChange("dateOfBirth", "");
                                    return;
                                  }
                                  handleTextChange("dateOfBirth", toIsoDate(formatted));
                                } else {
                                  handleTextChange("dateOfBirth", "");
                                }
                              }}
                              maxLength={10}
                              className="w-full bg-brand-beige border border-brand-light/50 pl-4 pr-11 py-3 rounded-xl text-sm focus:outline-none focus:border-brand-secondary font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => dobPickerRef.current && dobPickerRef.current.showPicker()}
                              className="absolute right-3 p-1.5 hover:bg-brand-light/20 text-brand-primary rounded-lg transition-colors cursor-pointer"
                              title="Open Calendar"
                            >
                              <Calendar size={16} />
                            </button>
                            <input
                              type="date"
                              ref={dobPickerRef}
                              max={new Date().toISOString().split("T")[0]}
                              value={currentCase.dateOfBirth || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val) {
                                  const today = new Date().toISOString().split("T")[0];
                                  if (val > today) {
                                    triggerNotification("Please enter a valid, non-future Date of Birth.");
                                    handleTextChange("dateOfBirth", "");
                                  } else {
                                    handleTextChange("dateOfBirth", val);
                                  }
                                }
                              }}
                              className="sr-only"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Age</label>
                            <input
                              type="number"
                              value={currentCase.age}
                              onChange={(e) => handleTextChange("age", e.target.value)}
                              placeholder="e.g. 29"
                              className="w-full bg-brand-beige border border-brand-light/50 px-4 py-3 rounded-xl text-sm focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Gender</label>
                            <select
                              value={currentCase.gender}
                              onChange={(e) => handleTextChange("gender", e.target.value)}
                              className="w-full bg-brand-beige border border-brand-light/50 px-4 py-3 rounded-xl text-sm focus:outline-none"
                            >
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="relative">
                        <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Mobile Number</label>
                        <input
                          type="tel"
                          value={currentCase.mobile}
                          onChange={(e) => handleTextChange("mobile", e.target.value)}
                          placeholder="e.g. 9876543210"
                          className="w-full bg-brand-beige border border-brand-light/50 px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-brand-secondary"
                        />
                        
                        {/* Inline Multiple Patient Picker */}
                        {matchingPatients.length > 0 && (
                          <div className="absolute z-20 left-0 right-0 mt-2 bg-brand-cream border border-brand-light p-4 rounded-2xl shadow-xl space-y-2 animate-fadeIn max-h-[220px] overflow-y-auto">
                            <div className="text-[10px] font-bold text-brand-primary/80 uppercase tracking-wide border-b border-brand-light/45 pb-1">
                              Registered profiles sharing this number:
                            </div>
                            <div className="space-y-1">
                              {matchingPatients.map(p => (
                                <button
                                  key={p.patientId}
                                  type="button"
                                  onClick={() => loadSelectedPatientProfile(p)}
                                  className={`w-full text-left p-2 rounded-lg text-xs font-sans flex justify-between items-center transition-all hover:bg-brand-light/35 ${
                                    currentCase.patientId === p.patientId ? "bg-brand-light/45 font-bold" : "text-brand-dark/95"
                                  }`}
                                >
                                  <span>{p.name} ({p.age} Yrs, {p.gender})</span>
                                  <span className="font-mono text-[10px] text-brand-secondary bg-brand-light/20 px-2 py-0.5 rounded">{p.patientId}</span>
                                </button>
                              ))}
                            </div>
                            <div className="border-t border-brand-light/45 pt-1.5 flex justify-end">
                              <button
                                type="button"
                                onClick={startNewFamilyMemberProfile}
                                className="text-[10px] font-bold text-brand-secondary hover:text-brand-primary flex items-center gap-1 uppercase transition-colors"
                              >
                                <PlusCircle size={12} /> Register New Patient Profile
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Occupation</label>
                        <input
                          type="text"
                          value={currentCase.occupation}
                          onChange={(e) => handleTextChange("occupation", e.target.value)}
                          placeholder="e.g. Software Engineer"
                          className="w-full bg-brand-beige border border-brand-light/50 px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-brand-secondary"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Consultation Date</label>
                        <input
                          type="date"
                          value={currentCase.visitDate ? currentCase.visitDate.split("T")[0] : new Date().toISOString().split("T")[0]}
                          onChange={(e) => {
                            const selectedDate = e.target.value;
                            const originalTime = currentCase.visitDate && currentCase.visitDate.includes("T") ? currentCase.visitDate.substring(currentCase.visitDate.indexOf("T")) : "T12:00:00.000Z";
                            setCurrentCase(prev => ({
                              ...prev,
                              visitDate: selectedDate + originalTime
                            }));
                          }}
                          className="w-full bg-brand-beige border border-brand-light/50 px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-brand-secondary"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Visit History Timeline card */}
                  {currentCase.patientId && (
                    <div className="bg-brand-cream border border-brand-light/60 p-6 rounded-3xl space-y-6 shadow-sm animate-fadeIn">
                      <div className="flex justify-between items-center border-b border-brand-light/40 pb-3 flex-wrap gap-3">
                        <div className="space-y-1">
                          <h3 className="font-serif text-lg font-bold text-brand-primary flex items-center gap-2">
                            <Calendar size={18} /> Visit History and Consultation Timeline
                          </h3>
                          <p className="text-[10px] text-brand-dark/50">
                            Track patient progress across consult sheets and repeat prescriptions.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleRecordNewVisit}
                          className="flex items-center gap-1.5 bg-brand-primary text-brand-beige hover:bg-brand-secondary px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer"
                        >
                          <Plus size={14} /> Record Follow-up Visit
                        </button>
                      </div>

                      {(!currentCase.visits || currentCase.visits.length === 0) ? (
                        <div className="text-center py-6 text-xs text-brand-dark/40 font-sans italic">
                          No previous visits archived yet. (Click "Record Follow-up Visit" to archive current details and start a new consult).
                        </div>
                      ) : (
                        <div className="relative border-l-2 border-brand-light/70 ml-2.5 pl-6 space-y-6 py-2">
                          {currentCase.visits
                            .filter((v, idx, self) => self.findIndex(other => other.visitDate === v.visitDate) === idx)
                            .map((v, idx) => (
                            <div key={v.visitId || idx} className="relative group">
                              {/* Timeline dot */}
                              <div className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border-2 border-brand-primary bg-brand-beige group-hover:bg-brand-primary transition-colors" />
                              
                              <div className="bg-brand-beige/35 border border-brand-light/50 rounded-2xl p-4 space-y-3 hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-center flex-wrap gap-2">
                                  <div className="flex items-center gap-2">
                                    {v.visitNumber && (
                                      <span className="text-[10px] bg-brand-primary text-brand-beige px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                                        {v.visitNumber}
                                      </span>
                                    )}
                                    <span className="font-serif font-bold text-brand-primary text-sm">
                                      {new Date(v.visitDate).toLocaleDateString("en-US", { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                    <span className="text-[10px] bg-brand-light/35 text-brand-secondary px-2 py-0.5 rounded-full font-semibold">
                                      {new Date(v.visitDate).toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      (v.wellnessRating === 5 || String(v.outcomeScore).match(/Marked/i)) ? "bg-emerald-100 text-emerald-800 border-emerald-250 font-bold" :
                                      (v.wellnessRating === 4 || String(v.outcomeScore).match(/Moderate/i)) ? "bg-green-100 text-green-800 border-green-250" :
                                      (v.wellnessRating === 3 || String(v.outcomeScore).match(/Mild/i)) ? "bg-yellow-100 text-yellow-800 border-yellow-250" :
                                      (v.wellnessRating === 2 || String(v.outcomeScore).match(/Minimal/i)) ? "bg-orange-100 text-orange-850 border-orange-250" :
                                      "bg-red-100 text-red-800 border-red-250"
                                    }`}>
                                      Progress: {v.wellnessRating ? `${v.wellnessRating}/5` : v.outcomeScore}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => copyPastVisitDetails(v)}
                                      className="text-[10px] font-bold text-brand-primary hover:text-brand-secondary border border-brand-primary/30 px-2 py-0.5 rounded-lg transition-colors bg-white shadow-sm flex items-center gap-1 uppercase"
                                    >
                                      <RefreshCw size={10} /> Copy remedies
                                    </button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans leading-relaxed">
                                  <div className="space-y-1.5">
                                    <h4 className="font-bold text-brand-primary text-[10px] uppercase tracking-wider">Chief Complaints:</h4>
                                    <ul className="list-disc list-inside text-brand-dark/80 space-y-0.5 pl-1">
                                      {(v.chiefComplaints || v.complaints || []).filter(c => c.text).map((c, i) => (
                                        <li key={i} className="list-item">
                                          {c.text} {c.onsetDate ? `(since ${formatOnsetDateTime(c.onsetDate)})` : ""}
                                        </li>
                                      ))}
                                      {(v.chiefComplaints || v.complaints || []).filter(c => c.text).length === 0 && (
                                        <li className="list-item italic text-brand-dark/50">Routine consult / General follow-up</li>
                                      )}
                                    </ul>
                                    <div className="mt-2 text-brand-dark/85">
                                        <span className="font-bold text-brand-primary text-[10px] uppercase tracking-wider block">Diagnosis:</span>
                                        Prakriti: <span className="font-semibold">{v.prakriti}</span> • Vikriti: <span className="font-semibold">{v.doshajaVikriti || v.vikriti}</span> • Agni: <span className="font-semibold">{v.agni}</span>
                                        {(v.ayurvedicDiagnosis || v.modernDiagnosis) && (
                                          <div className="mt-1">
                                            {v.ayurvedicDiagnosis && <span className="mr-2">Ayurvedic: <span className="font-semibold">{v.ayurvedicDiagnosis}</span></span>}
                                            {v.modernDiagnosis && <span>Modern: <span className="font-semibold">{v.modernDiagnosis}</span></span>}
                                          </div>
                                        )}
                                      </div>
                                  </div>

                                  <div className="space-y-1.5">
                                    <h4 className="font-bold text-brand-primary text-[10px] uppercase tracking-wider">Prescribed Remedies:</h4>
                                    <div className="text-brand-dark/85 font-mono text-[11px] bg-white border border-brand-light/35 p-2 rounded-xl space-y-1 max-h-[80px] overflow-y-auto">
                                      {(v.medicines || []).filter(m => m.name).map((m, i) => (
                                        <div key={i} className="truncate">
                                          • {m.name} ({m.dose} - {m.kala})
                                        </div>
                                      ))}
                                      {(v.medicines || []).filter(m => m.name).length === 0 && (
                                        <div className="italic text-brand-dark/40">No specific formulations prescribed</div>
                                      )}
                                    </div>
                                    {v.notes && (
                                      <div className="mt-2 text-[11px] text-brand-dark/80 italic">
                                        <strong className="text-brand-primary not-italic text-[10px] uppercase tracking-wider block">Advice & Notes:</strong>
                                        "{v.notes}"
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Complaints & History */}
              {activeTab === "complaints" && (
                <div className="space-y-6">
                  <div className="bg-brand-cream border border-brand-light/60 p-6 rounded-3xl space-y-4 shadow-sm">
                    <div className="flex justify-between items-center border-b border-brand-light/40 pb-2">
                      <h3 className="font-serif text-xl font-bold text-brand-primary">
                        2. Chief Complaints
                      </h3>
                      <button
                        onClick={addComplaint}
                        className="flex items-center gap-1 bg-brand-primary text-brand-beige px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer"
                      >
                        <Plus size={14} /> Add Complaint
                      </button>
                    </div>

                    <div className="space-y-4">
                      {currentCase.complaints.map((c, index) => (
                        <div key={index} className="flex gap-4 items-center flex-wrap md:flex-nowrap bg-brand-beige/30 p-3 rounded-xl border border-brand-light/30">
                          <div className="flex-grow min-w-[200px]">
                            <label className="block text-[9px] uppercase tracking-wider text-brand-secondary font-bold mb-1">Complaint / symptom</label>
                            <input
                              type="text"
                              value={c.text}
                              onChange={(e) => updateComplaint(index, "text", e.target.value)}
                              placeholder="e.g. Chronic bloating / Indigestion after meals"
                              className="w-full bg-brand-beige border border-brand-light/50 px-4 py-2.5 rounded-lg text-xs focus:outline-none"
                            />
                          </div>
                          <div className="w-52">
                            <label className="block text-[9px] uppercase tracking-wider text-brand-secondary font-bold mb-1">Onset Date & Time</label>
                            <div className="w-full bg-brand-beige/60 border border-brand-light/40 px-3 py-2.5 rounded-lg text-xs text-brand-dark/70 font-medium">
                              {formatOnsetDateTime(c.onsetDate || new Date().toISOString())}
                            </div>
                          </div>
                          <button
                            onClick={() => removeComplaint(index)}
                            disabled={currentCase.complaints.length === 1}
                            className="text-brand-dark/40 hover:text-red-500 p-2 disabled:opacity-30 transition-colors cursor-pointer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Past History */}
                    <div className="bg-brand-cream border border-brand-light/60 p-6 rounded-3xl space-y-4 shadow-sm">
                      <h4 className="font-serif text-lg font-bold text-brand-primary border-b border-brand-light/40 pb-2">
                        Past History
                      </h4>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        {["diabetes", "htn", "thyroid", "asthma", "obesity", "gut"].map((key) => (
                          <label key={key} className="flex items-center space-x-2.5 cursor-pointer uppercase font-bold text-brand-primary/80">
                            <input
                              type="checkbox"
                              checked={currentCase.pastHistory[key] || false}
                              onChange={(e) => handleCheckboxChange("pastHistory", key, e.target.checked)}
                              className="rounded text-brand-primary focus:ring-brand-secondary h-4 w-4"
                            />
                            <span>{key === "htn" ? "HTN" : key === "gut" ? "Gut Issues" : key}</span>
                          </label>
                        ))}
                      </div>
                      <div className="pt-2">
                        <label className="block text-[11px] font-bold text-brand-primary uppercase tracking-wider mb-1">Other Past History</label>
                        <input
                          type="text"
                          value={currentCase.pastHistory.others || ""}
                          onChange={(e) => handleCheckboxChange("pastHistory", "others", e.target.value)}
                          placeholder="e.g. Migraine / Appendectomy"
                          className="w-full bg-brand-beige border border-brand-light/50 px-3 py-2 rounded-lg text-xs focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Family History */}
                    <div className="bg-brand-cream border border-brand-light/60 p-6 rounded-3xl space-y-4 shadow-sm">
                      <h4 className="font-serif text-lg font-bold text-brand-primary border-b border-brand-light/40 pb-2">
                        Family History
                      </h4>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        {["diabetes", "htn", "thyroid"].map((key) => (
                          <label key={key} className="flex items-center space-x-2.5 cursor-pointer uppercase font-bold text-brand-primary/80">
                            <input
                              type="checkbox"
                              checked={currentCase.familyHistory[key] || false}
                              onChange={(e) => handleCheckboxChange("familyHistory", key, e.target.checked)}
                              className="rounded text-brand-primary focus:ring-brand-secondary h-4 w-4"
                            />
                            <span>{key === "htn" ? "HTN" : key}</span>
                          </label>
                        ))}
                      </div>
                      <div className="pt-2">
                        <label className="block text-[11px] font-bold text-brand-primary uppercase tracking-wider mb-1">Other Family History</label>
                        <input
                          type="text"
                          value={currentCase.familyHistory.others || ""}
                          onChange={(e) => handleCheckboxChange("familyHistory", "others", e.target.value)}
                          placeholder="e.g. Cardiac history"
                          className="w-full bg-brand-beige border border-brand-light/50 px-3 py-2 rounded-lg text-xs focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Drug history & lifestyle indicators */}
                  <div className="bg-brand-cream border border-brand-light/60 p-6 rounded-3xl space-y-4 shadow-sm">
                    <h4 className="font-serif text-lg font-bold text-brand-primary border-b border-brand-light/40 pb-2">
                      Clinical Parameters
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider">Drug History</label>
                        <div className="flex gap-2">
                          {["Yes", "No"].map(option => (
                            <button
                              key={option}
                              type="button"
                              onClick={() => setCurrentCase({
                                ...currentCase,
                                drugHistory: { ...currentCase.drugHistory, hasHistory: option }
                              })}
                              className={`flex-grow py-2 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer border ${
                                currentCase.drugHistory.hasHistory === option
                                  ? "bg-brand-primary text-brand-beige border-brand-primary"
                                  : "bg-brand-beige text-brand-primary border-brand-light"
                              }`}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                        {currentCase.drugHistory.hasHistory === "Yes" && (
                          <input
                            type="text"
                            value={currentCase.drugHistory.details || ""}
                            onChange={(e) => setCurrentCase({
                              ...currentCase,
                              drugHistory: { ...currentCase.drugHistory, details: e.target.value }
                            })}
                            placeholder="Details of drugs..."
                            className="w-full bg-brand-beige border border-brand-light/50 px-3 py-2 rounded-lg text-xs mt-2"
                          />
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider">Addictions</label>
                        <select
                          value={currentCase.addiction || "None"}
                          onChange={(e) => handleTextChange("addiction", e.target.value)}
                          className="w-full bg-brand-beige border border-brand-light/50 px-3 py-2.5 rounded-lg text-xs focus:outline-none"
                        >
                          <option value="None">None</option>
                          <option value="Tobacco">Tobacco</option>
                          <option value="Smoking">Smoking</option>
                          <option value="Alcohol">Alcohol</option>
                          <option value="Multiple">Multiple Habits</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Surgical, Allergy and Other History */}
                  <div className="bg-brand-cream border border-brand-light/60 p-6 rounded-3xl space-y-4 shadow-sm">
                    <h4 className="font-serif text-lg font-bold text-brand-primary border-b border-brand-light/40 pb-2">
                      Surgical, Allergy and Other History
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider">Surgical History</label>
                        <textarea
                          rows={2}
                          value={currentCase.surgicalHistory || ""}
                          onChange={(e) => handleTextChange("surgicalHistory", e.target.value)}
                          placeholder="Details of surgical history..."
                          className="w-full bg-brand-beige border border-brand-light/50 px-3 py-2 rounded-lg text-xs focus:outline-none resize-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider">Drug Allergy</label>
                        <textarea
                          rows={2}
                          value={currentCase.drugAllergy || ""}
                          onChange={(e) => handleTextChange("drugAllergy", e.target.value)}
                          placeholder="Details of drug allergies..."
                          className="w-full bg-brand-beige border border-brand-light/50 px-3 py-2 rounded-lg text-xs focus:outline-none resize-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider">Any Other History</label>
                        <textarea
                          rows={2}
                          value={currentCase.anyOther || ""}
                          onChange={(e) => handleTextChange("anyOther", e.target.value)}
                          placeholder="Any other medical information..."
                          className="w-full bg-brand-beige border border-brand-light/50 px-3 py-2 rounded-lg text-xs focus:outline-none resize-none"
                        />
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* Tab 3: Ayur Core (Kshudha, Mala, sleep) */}
              {activeTab === "core" && (
                <div className="bg-brand-cream border border-brand-light/60 p-6 rounded-3xl space-y-6 shadow-sm">
                  <h3 className="font-serif text-xl font-bold text-brand-primary border-b border-brand-light/40 pb-2">
                    3. Ayurvedic Physiological Assessment (Koshtha & Sleep)
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Kshudha (Appetite)</label>
                        <select
                          value={currentCase.kshudha}
                          onChange={(e) => handleTextChange("kshudha", e.target.value)}
                          className="w-full bg-brand-beige border border-brand-light/50 px-4 py-3 rounded-xl text-sm focus:outline-none"
                        >
                          <option value="Sama">Sama (Normal)</option>
                          <option value="Manda">Manda</option>
                          <option value="Tikshna">Tikshna</option>
                          <option value="Vishama">Vishama</option>
                          <option value="Adhyashana">Adhyashana (Overeating)</option>
                          <option value="Alpashana">Alpashana (Reduced Intake)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Mutra (Urination)</label>
                        <select
                          value={currentCase.mutra}
                          onChange={(e) => handleTextChange("mutra", e.target.value)}
                          className="w-full bg-brand-beige border border-brand-light/50 px-4 py-3 rounded-xl text-sm focus:outline-none"
                        >
                          <option value="Normal">Normal</option>
                          <option value="Polyuria">Polyuria</option>
                          <option value="Oliguria">Oliguria</option>
                          <option value="Nocturia">Nocturia</option>
                          <option value="Burning Micturition">Burning Micturition</option>
                          <option value="Frequency Increased">Frequency Increased</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Mala (Bowel Habits)</label>
                        <select
                          value={currentCase.mala}
                          onChange={(e) => handleTextChange("mala", e.target.value)}
                          className="w-full bg-brand-beige border border-brand-light/50 px-4 py-3 rounded-xl text-sm focus:outline-none"
                        >
                          <option value="Regular">Regular</option>
                          <option value="Constipation">Constipation</option>
                          <option value="Loose Stool">Loose Stool</option>
                          <option value="Hard Stool">Hard Stool</option>
                          <option value="Mucus">Mucus</option>
                          <option value="Blood in Stool">Blood in Stool</option>
                          <option value="Alternate Constipation & Diarrhoea">Alternate Constipation & Diarrhoea</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Koshtha (Gut Constitution)</label>
                        <select
                          value={currentCase.koshtha}
                          onChange={(e) => handleTextChange("koshtha", e.target.value)}
                          className="w-full bg-brand-beige border border-brand-light/50 px-4 py-3 rounded-xl text-sm focus:outline-none"
                        >
                          <option value="Madhya">Madhya (Moderate / Normal)</option>
                          <option value="Mridu">Mridu (Soft / Sensitive bowel)</option>
                          <option value="Kroora">Kroora (Hard bowel / Constipated)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Nidra (Sleep)</label>
                        <select
                          value={currentCase.nidra}
                          onChange={(e) => handleTextChange("nidra", e.target.value)}
                          className="w-full bg-brand-beige border border-brand-light/50 px-4 py-3 rounded-xl text-sm focus:outline-none"
                        >
                          <option value="Sound Sleep">Sound Sleep</option>
                          <option value="Disturbed Sleep">Disturbed Sleep</option>
                          <option value="Insomnia">Insomnia</option>
                          <option value="Excessive Sleep">Excessive Sleep</option>
                          <option value="Interrupted Sleep">Interrupted Sleep</option>
                          <option value="Shift Duty Sleep Pattern">Shift Duty Sleep Pattern</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Avastha</label>
                        <select
                          value={currentCase.avastha}
                          onChange={(e) => handleTextChange("avastha", e.target.value)}
                          className="w-full bg-brand-beige border border-brand-light/50 px-4 py-3 rounded-xl text-sm focus:outline-none"
                        >
                          <option value="Sama">Sama</option>
                          <option value="Nirama">Nirama</option>
                          <option value="Mixed">Mixed</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: Diagnosis */}
              {activeTab === "diagnosis" && (
                <div className="bg-brand-cream border border-brand-light/60 p-6 rounded-3xl space-y-6 shadow-sm">
                  <h3 className="font-serif text-xl font-bold text-brand-primary border-b border-brand-light/40 pb-2">
                    4. Ayurvedic & Modern Diagnosis
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 1. Prakriti */}
                    <div>
                      <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Prakriti (Natural Constitution)</label>
                      <select
                        value={currentCase.prakriti}
                        onChange={(e) => handleTextChange("prakriti", e.target.value)}
                        className="w-full bg-brand-beige border border-brand-light/50 px-4 py-3 rounded-xl text-sm focus:outline-none"
                      >
                        <option value="Vata">Vata</option>
                        <option value="Pitta">Pitta</option>
                        <option value="Kapha">Kapha</option>
                        <option value="Vata-Pitta">Vata-Pitta</option>
                        <option value="Pitta-Kapha">Pitta-Kapha</option>
                        <option value="Vata-Kapha">Vata-Kapha</option>
                        <option value="Tridoshaja">Tridoshaja</option>
                      </select>
                    </div>

                    {/* 2. Doshaja Vikriti */}
                    <div>
                      <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Doshaja Vikriti (Imbalance)</label>
                      <select
                        value={currentCase.doshajaVikriti || "Vataja"}
                        onChange={(e) => handleTextChange("doshajaVikriti", e.target.value)}
                        className="w-full bg-brand-beige border border-brand-light/50 px-4 py-3 rounded-xl text-sm focus:outline-none"
                      >
                        <option value="Vataja">Vataja</option>
                        <option value="Pittaja">Pittaja</option>
                        <option value="Kaphaja">Kaphaja</option>
                        <option value="Vata-Pittaja">Vata-Pittaja</option>
                        <option value="Pitta-Kaphaja">Pitta-Kaphaja</option>
                        <option value="Vata-Kaphaja">Vata-Kaphaja</option>
                        <option value="Tridoshaja">Tridoshaja</option>
                      </select>
                    </div>

                    {/* 3. Dhatugata Vikriti */}
                    <div className="md:col-span-2 space-y-2">
                      <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-1">Dhatugata Vikriti (Select all that apply)</label>
                      <div className="flex flex-wrap gap-2">
                        {["Rasa", "Rakta", "Mamsa", "Meda", "Asthi", "Majja", "Shukra / Artava", "Ojas"].map(dhatu => {
                          const isSelected = (currentCase.dhatugataVikriti || []).includes(dhatu);
                          return (
                            <button
                              key={dhatu}
                              type="button"
                              onClick={() => {
                                const current = currentCase.dhatugataVikriti || [];
                                const updated = current.includes(dhatu)
                                  ? current.filter(d => d !== dhatu)
                                  : [...current, dhatu];
                                setCurrentCase({ ...currentCase, dhatugataVikriti: updated });
                              }}
                              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer transition-all border ${
                                isSelected
                                  ? "bg-brand-primary text-brand-beige border-brand-primary"
                                  : "bg-brand-beige text-brand-primary border-brand-light"
                              }`}
                            >
                              {dhatu}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 4. Samprapti */}
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Samprapti (Pathogenesis)</label>
                      <input
                        type="text"
                        list="samprapti-presets"
                        value={currentCase.samprapti || ""}
                        onChange={(e) => handleTextChange("samprapti", e.target.value)}
                        placeholder="Type or select pathogenesis e.g. Agnimandya..."
                        className="w-full bg-brand-beige border border-brand-light/50 px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-brand-secondary"
                      />
                      <datalist id="samprapti-presets">
                        <option value="Agnimandya" />
                        <option value="Avarana" />
                        <option value="Dhatukshaya" />
                        <option value="Santarpanottha" />
                        <option value="Apatarpanottha" />
                        <option value="Srotorodha" />
                        <option value="Ama" />
                        <option value="Dhatvagnimandya" />
                      </datalist>
                    </div>

                    {/* 5. Ayurvedic Diagnosis */}
                    <div>
                      <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Ayurvedic Diagnosis</label>
                      <input
                        type="text"
                        value={currentCase.ayurvedicDiagnosis || ""}
                        onChange={(e) => handleTextChange("ayurvedicDiagnosis", e.target.value)}
                        placeholder="Enter Ayurvedic Diagnosis..."
                        className="w-full bg-brand-beige border border-brand-light/50 px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-brand-secondary"
                      />
                    </div>

                    {/* 6. Modern Diagnosis */}
                    <div>
                      <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Modern Diagnosis</label>
                      <input
                        type="text"
                        value={currentCase.modernDiagnosis || ""}
                        onChange={(e) => handleTextChange("modernDiagnosis", e.target.value)}
                        placeholder="Enter Modern Diagnosis..."
                        className="w-full bg-brand-beige border border-brand-light/50 px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-brand-secondary"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 5: Lifestyle */}
              {activeTab === "lifestyle" && (
                <div className="bg-brand-cream border border-brand-light/60 p-6 rounded-3xl space-y-6 shadow-sm">
                  <h3 className="font-serif text-xl font-bold text-brand-primary border-b border-brand-light/40 pb-2">
                    5. Lifestyle & Diet Assessment
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Left Column: Diet */}
                    <div className="space-y-4">
                      <h4 className="font-serif text-base font-bold text-brand-primary border-b border-brand-light/20 pb-1">
                        Dietary Habits
                      </h4>

                      {/* Diet Type */}
                      <div>
                        <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Diet Type</label>
                        <select
                          value={currentCase.diet || "Vegetarian"}
                          onChange={(e) => handleTextChange("diet", e.target.value)}
                          className="w-full bg-brand-beige border border-brand-light/50 px-4 py-3 rounded-xl text-sm focus:outline-none"
                        >
                          <option value="Vegetarian">Vegetarian</option>
                          <option value="Eggetarian">Eggetarian</option>
                          <option value="Mixed Diet">Mixed Diet</option>
                          <option value="Vegan">Vegan</option>
                          <option value="Jain">Jain</option>
                          <option value="Others">Others</option>
                        </select>
                      </div>

                      {/* Meal Pattern */}
                      <div>
                        <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Meal Pattern</label>
                        <select
                          value={currentCase.mealPattern || "Regular"}
                          onChange={(e) => handleTextChange("mealPattern", e.target.value)}
                          className="w-full bg-brand-beige border border-brand-light/50 px-4 py-3 rounded-xl text-sm focus:outline-none"
                        >
                          <option value="Regular">Regular</option>
                          <option value="Irregular">Irregular</option>
                          <option value="Skips Breakfast">Skips Breakfast</option>
                          <option value="Late Dinner">Late Dinner</option>
                          <option value="Frequent Snacking">Frequent Snacking</option>
                          <option value="Intermittent Fasting">Intermittent Fasting</option>
                        </select>
                      </div>

                      {/* Water Intake */}
                      <div>
                        <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Water Intake</label>
                        <select
                          value={currentCase.waterIntake || "1–2 L/day"}
                          onChange={(e) => handleTextChange("waterIntake", e.target.value)}
                          className="w-full bg-brand-beige border border-brand-light/50 px-4 py-3 rounded-xl text-sm focus:outline-none"
                        >
                          <option value="<1 L/day">&lt;1 L/day</option>
                          <option value="1–2 L/day">1–2 L/day</option>
                          <option value="2–3 L/day">2–3 L/day</option>
                          <option value=">3 L/day">&gt;3 L/day</option>
                        </select>
                      </div>

                      {/* Viruddha Ahara */}
                      <div>
                        <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Viruddha Ahara (Incompatible Diet)</label>
                        <select
                          value={currentCase.viruddhaAhara || "Never"}
                          onChange={(e) => handleTextChange("viruddhaAhara", e.target.value)}
                          className="w-full bg-brand-beige border border-brand-light/50 px-4 py-3 rounded-xl text-sm focus:outline-none"
                        >
                          <option value="Never">Never</option>
                          <option value="Occasionally">Occasionally</option>
                          <option value="Frequently">Frequently</option>
                        </select>
                      </div>

                      {/* Tea/Coffee Intake */}
                      <div>
                        <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Tea/Coffee Intake</label>
                        <select
                          value={currentCase.teaCoffee || "None"}
                          onChange={(e) => handleTextChange("teaCoffee", e.target.value)}
                          className="w-full bg-brand-beige border border-brand-light/50 px-4 py-3 rounded-xl text-sm focus:outline-none"
                        >
                          <option value="None">None</option>
                          <option value="1–2/day">1–2/day</option>
                          <option value="3–5/day">3–5/day</option>
                          <option value=">5/day">&gt;5/day</option>
                        </select>
                      </div>
                    </div>

                    {/* Right Column: Lifestyle */}
                    <div className="space-y-4">
                      <h4 className="font-serif text-base font-bold text-brand-primary border-b border-brand-light/20 pb-1">
                        Lifestyle Habits
                      </h4>

                      {/* Physical Activity */}
                      <div>
                        <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Physical Activity</label>
                        <select
                          value={currentCase.activity || "Sedentary"}
                          onChange={(e) => handleTextChange("activity", e.target.value)}
                          className="w-full bg-brand-beige border border-brand-light/50 px-4 py-3 rounded-xl text-sm focus:outline-none"
                        >
                          <option value="Sedentary">Sedentary</option>
                          <option value="Light">Light</option>
                          <option value="Moderate">Moderate</option>
                          <option value="Heavy">Heavy</option>
                        </select>
                      </div>

                      {/* Exercise */}
                      <div>
                        <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Exercise</label>
                        <select
                          value={currentCase.exercise || "None"}
                          onChange={(e) => handleTextChange("exercise", e.target.value)}
                          className="w-full bg-brand-beige border border-brand-light/50 px-4 py-3 rounded-xl text-sm focus:outline-none"
                        >
                          <option value="None">None</option>
                          <option value="Walking">Walking</option>
                          <option value="Yoga">Yoga</option>
                          <option value="Gym">Gym</option>
                          <option value="Sports">Sports</option>
                          <option value="Mixed">Mixed</option>
                        </select>
                      </div>

                      {/* Divaswap */}
                      <div>
                        <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Divaswap (Day Sleep)</label>
                        <select
                          value={currentCase.divaswap || "Never"}
                          onChange={(e) => handleTextChange("divaswap", e.target.value)}
                          className="w-full bg-brand-beige border border-brand-light/50 px-4 py-3 rounded-xl text-sm focus:outline-none"
                        >
                          <option value="Never">Never</option>
                          <option value="Occasionally">Occasionally</option>
                          <option value="Daily">Daily</option>
                        </select>
                      </div>

                      {/* Stress Level */}
                      <div>
                        <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Stress Level</label>
                        <select
                          value={currentCase.stressLevel || "Low"}
                          onChange={(e) => handleTextChange("stressLevel", e.target.value)}
                          className="w-full bg-brand-beige border border-brand-light/50 px-4 py-3 rounded-xl text-sm focus:outline-none"
                        >
                          <option value="Low">Low</option>
                          <option value="Mild">Mild</option>
                          <option value="Moderate">Moderate</option>
                          <option value="High">High</option>
                          <option value="Severe">Severe</option>
                        </select>
                      </div>

                      {/* Screen Time */}
                      <div>
                        <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Screen Time</label>
                        <select
                          value={currentCase.screenTime || "<2 hrs"}
                          onChange={(e) => handleTextChange("screenTime", e.target.value)}
                          className="w-full bg-brand-beige border border-brand-light/50 px-4 py-3 rounded-xl text-sm focus:outline-none"
                        >
                          <option value="<2 hrs">&lt;2 hrs</option>
                          <option value="2–4 hrs">2–4 hrs</option>
                          <option value="4–6 hrs">4–6 hrs</option>
                          <option value=">6 hrs">&gt;6 hrs</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 6: Prescription */}
              {activeTab === "treatment" && (
                <div className="space-y-6 animate-fadeIn">
                  
                  {/* Ayurvedic presets panel */}
                  <div className="bg-brand-cream border border-brand-light/60 p-5 rounded-3xl space-y-3 shadow-sm">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-primary block">
                      Rapid Entry Presets (Rx Formulary)
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {MEDICINE_PRESETS.map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => addMedicinePreset(name)}
                          className="bg-brand-beige hover:bg-brand-light border border-brand-light/65 text-brand-primary px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                        >
                          + {name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Medicines table */}
                  <div className="bg-brand-cream border border-brand-light/60 p-6 rounded-3xl space-y-4 shadow-sm">
                    <div className="flex justify-between items-center border-b border-brand-light/40 pb-2">
                      <h3 className="font-serif text-xl font-bold text-brand-primary">
                        6. Advised Prescription (Rx Formulation)
                      </h3>
                      <button
                        onClick={addMedicine}
                        className="flex items-center gap-1 bg-brand-primary text-brand-beige px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer"
                      >
                        <Plus size={14} /> Add Row
                      </button>
                    </div>

                    <div className="space-y-4">
                      {currentCase.medicines.map((med, index) => (
                        <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-brand-beige/25 p-3.5 rounded-2xl border border-brand-light/35 items-center">
                          
                          {/* 1. Medicine Name */}
                          <div className="md:col-span-3">
                            <label className="block text-[9px] uppercase tracking-wider font-bold text-brand-secondary mb-1">Medicine Name</label>
                            <input
                              type="text"
                              value={med.name}
                              onChange={(e) => updateMedicine(index, "name", e.target.value)}
                              placeholder="e.g. Triphala Churna"
                              className="w-full bg-brand-beige border border-brand-light/50 px-3.5 py-2.5 rounded-xl text-xs focus:outline-none"
                            />
                          </div>

                          {/* 2. Dosage */}
                          <div className="md:col-span-2">
                            <label className="block text-[9px] uppercase tracking-wider font-bold text-brand-secondary mb-1">Dosage</label>
                            <input
                              type="text"
                              list="dose-presets"
                              value={med.dose}
                              onChange={(e) => updateMedicine(index, "dose", e.target.value)}
                              placeholder="e.g. 1 Tab"
                              className="w-full bg-brand-beige border border-brand-light/50 px-3 py-2.5 rounded-xl text-xs focus:outline-none"
                            />
                            <datalist id="dose-presets">
                              <option value="1 Tab" />
                              <option value="2 Tab" />
                              <option value="5 ml" />
                              <option value="10 ml" />
                              <option value="15 ml" />
                              <option value="30 ml" />
                              <option value="40 ml" />
                              <option value="3 g" />
                              <option value="5 g" />
                            </datalist>
                          </div>

                          {/* 3. Frequency */}
                          <div className="md:col-span-1">
                            <label className="block text-[9px] uppercase tracking-wider font-bold text-brand-secondary mb-1">Frequency</label>
                            <select
                              value={med.frequency || ""}
                              onChange={(e) => updateMedicine(index, "frequency", e.target.value)}
                              className="w-full bg-brand-beige border border-brand-light/50 px-2 py-2.5 rounded-xl text-xs focus:outline-none"
                            >
                              <option value="">Select</option>
                              <option value="OD">OD</option>
                              <option value="BD">BD</option>
                              <option value="TDS">TDS</option>
                              <option value="QID">QID</option>
                              <option value="SOS">SOS</option>
                              <option value="HS">HS</option>
                              <option value="Weekly">Weekly</option>
                            </select>
                          </div>

                          {/* 4. Kala */}
                          <div className="md:col-span-2">
                            <label className="block text-[9px] uppercase tracking-wider font-bold text-brand-secondary mb-1">Kala (Timing)</label>
                            <select
                              value={med.kala || ""}
                              onChange={(e) => updateMedicine(index, "kala", e.target.value)}
                              className="w-full bg-brand-beige border border-brand-light/50 px-2 py-2.5 rounded-xl text-xs focus:outline-none"
                            >
                              <option value="">Select</option>
                              <option value="Before Food">Before Food</option>
                              <option value="After Food">After Food</option>
                              <option value="With Food">With Food</option>
                              <option value="Empty Stomach">Empty Stomach</option>
                              <option value="Morning">Morning</option>
                              <option value="Afternoon">Afternoon</option>
                              <option value="Evening">Evening</option>
                              <option value="Bedtime">Bedtime</option>
                            </select>
                          </div>

                          {/* 5. Anupana */}
                          <div className="md:col-span-2">
                            <label className="block text-[9px] uppercase tracking-wider font-bold text-brand-secondary mb-1">Anupana</label>
                            <input
                              type="text"
                              list="anupana-presets"
                              value={med.anupana || ""}
                              onChange={(e) => updateMedicine(index, "anupana", e.target.value)}
                              placeholder="e.g. Warm Water"
                              className="w-full bg-brand-beige border border-brand-light/50 px-2 py-2.5 rounded-xl text-xs focus:outline-none"
                            />
                            <datalist id="anupana-presets">
                              <option value="Warm Water" />
                              <option value="Lukewarm Water" />
                              <option value="Hot Water" />
                              <option value="Cold Water" />
                              <option value="Honey" />
                              <option value="Ghee" />
                              <option value="Milk" />
                              <option value="Buttermilk" />
                              <option value="Plain Water" />
                              <option value="Decoction" />
                              <option value="Others" />
                            </datalist>
                          </div>

                          {/* 6. Duration */}
                          <div className="md:col-span-1">
                            <label className="block text-[9px] uppercase tracking-wider font-bold text-brand-secondary mb-1">Duration</label>
                            <input
                              type="text"
                              list="duration-presets"
                              value={med.duration || ""}
                              onChange={(e) => updateMedicine(index, "duration", e.target.value)}
                              placeholder="e.g. 30 Days"
                              className="w-full bg-brand-beige border border-brand-light/50 px-2 py-2.5 rounded-xl text-xs focus:outline-none"
                            />
                            <datalist id="duration-presets">
                              <option value="3 Days" />
                              <option value="5 Days" />
                              <option value="7 Days" />
                              <option value="15 Days" />
                              <option value="21 Days" />
                              <option value="30 Days" />
                              <option value="45 Days" />
                              <option value="60 Days" />
                              <option value="90 Days" />
                            </datalist>
                          </div>

                          {/* Delete Button */}
                          <div className="md:col-span-1 justify-self-center pt-3 md:pt-0">
                            <button
                              onClick={() => removeMedicine(index)}
                              disabled={currentCase.medicines.length === 1}
                              className="text-brand-dark/40 hover:text-red-500 p-2 disabled:opacity-30 cursor-pointer"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}

              {/* Tab 7: Panchakarma & Advice */}
              {activeTab === "panchakarma" && (
                <div className="space-y-6 animate-fadeIn">
                  {/* Panchakarma advise */}
                  <div className="bg-brand-cream border border-brand-light/60 p-6 rounded-3xl space-y-4 shadow-sm">
                    <h4 className="font-serif text-lg font-bold text-brand-primary border-b border-brand-light/40 pb-2">
                      7. Panchakarma Detox Therapy Advice
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        "Vamana", "Virechana", "Basti", "Nasya", "Raktamokshana",
                        "Abhyanga", "Swedana", "Shirodhara", "Kati Basti", "Janu Basti",
                        "Greeva Basti", "Pizhichil", "Udvartana", "Patra Pinda Sweda",
                        "Shashtika Shali Pinda Sweda", "Lepa", "Karnapoorana", "Netra Tarpana",
                        "No Panchakarma"
                      ].map(therapy => {
                        const isSelected = (currentCase.panchakarma || []).includes(therapy);
                        return (
                          <button
                            key={therapy}
                            type="button"
                            onClick={() => {
                              let current = currentCase.panchakarma || [];
                              if (therapy === "No Panchakarma") {
                                current = ["No Panchakarma"];
                              } else {
                                current = current.filter(t => t !== "No Panchakarma");
                                if (current.includes(therapy)) {
                                  current = current.filter(t => t !== therapy);
                                } else {
                                  current = [...current, therapy];
                                }
                                if (current.length === 0) {
                                  current = ["No Panchakarma"];
                                }
                              }
                              setCurrentCase({ ...currentCase, panchakarma: current });
                            }}
                            className={`px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer text-center border transition-all ${
                              isSelected
                                ? "bg-brand-primary text-brand-beige border-brand-primary"
                                : "bg-brand-beige text-brand-primary border-brand-light"
                            }`}
                          >
                            {therapy}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pathya-Apathya, Follow-up and Notes */}
                  <div className="bg-brand-cream border border-brand-light/60 p-6 rounded-3xl space-y-6 shadow-sm">
                    <h4 className="font-serif text-lg font-bold text-brand-primary border-b border-brand-light/40 pb-2">
                      Pathya-Apathya, Follow-Up and Clinical Notes
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Pathya-Apathya */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider">Pathya – Apathya (Diet and Lifestyle Advice)</label>
                          <button
                            type="button"
                            onClick={() => {
                              const templates = [
                                "Avoid curd at night. Drink warm water.",
                                "Early dinner by 7:30 PM. Regular walking for 30 mins.",
                                "Avoid junk food and cold drinks. Sleep by 10:30 PM.",
                                "Light diet (Laghu Ahara). Take warm water throughout the day."
                              ];
                              const current = currentCase.notes || "";
                              setCurrentCase({ ...currentCase, notes: current ? current + "\n" + templates[0] : templates[0] });
                            }}
                            className="text-[10px] font-bold text-brand-secondary hover:text-brand-primary uppercase tracking-wide cursor-pointer"
                          >
                            + Insert Template
                          </button>
                        </div>
                        <textarea
                          rows={4}
                          value={currentCase.notes || ""}
                          onChange={(e) => handleTextChange("notes", e.target.value)}
                          placeholder="Avoid curd at night, take warm water, regular walking..."
                          className="w-full bg-brand-beige border border-brand-light/50 px-4 py-3 rounded-xl text-xs focus:outline-none resize-none"
                        />
                      </div>

                      {/* Next Follow-Up & Doctor Notes */}
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Next Follow-Up</label>
                          <select
                            value={currentCase.nextFollowUp || "15 Days"}
                            onChange={(e) => handleTextChange("nextFollowUp", e.target.value)}
                            className="w-full bg-brand-beige border border-brand-light/50 px-4 py-3 rounded-xl text-xs focus:outline-none"
                          >
                            <option value="3 Days">3 Days</option>
                            <option value="7 Days">7 Days</option>
                            <option value="15 Days">15 Days</option>
                            <option value="30 Days">30 Days</option>
                            <option value="45 Days">45 Days</option>
                            <option value="60 Days">60 Days</option>
                            <option value="Custom Date">Custom Date</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Doctor's Clinical Notes</label>
                          <textarea
                            rows={2}
                            value={currentCase.doctorsNotes || ""}
                            onChange={(e) => handleTextChange("doctorsNotes", e.target.value)}
                            placeholder="Extra details from doctor..."
                            className="w-full bg-brand-beige border border-brand-light/50 px-4 py-3 rounded-xl text-xs focus:outline-none resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 8: Labs & Follow-up */}
              {activeTab === "labs" && (
                <div className="space-y-6 animate-fadeIn">
                  
                  {/* Lab Investigation Panels */}
                  <div className="bg-brand-cream border border-brand-light/60 p-6 rounded-3xl space-y-4 shadow-sm">
                    <div className="flex justify-between items-center border-b border-brand-light/40 pb-2 flex-wrap gap-2">
                      <h3 className="font-serif text-xl font-bold text-brand-primary">
                        8. Lab Investigations & Blood Chemistry
                      </h3>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => addLabPanel("Glycemic")}
                          className="bg-brand-beige border border-brand-light/60 hover:bg-brand-light text-brand-primary px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          + Glycemic Panel
                        </button>
                        <button
                          type="button"
                          onClick={() => addLabPanel("Lipid")}
                          className="bg-brand-beige border border-brand-light/60 hover:bg-brand-light text-brand-primary px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          + Lipid Panel
                        </button>
                        <button
                          type="button"
                          onClick={addCustomLabRow}
                          className="bg-brand-primary text-brand-beige hover:bg-brand-secondary px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          + Custom Test
                        </button>
                      </div>
                    </div>

                    {currentCase.labTests.length === 0 ? (
                      <div className="text-center py-8 text-xs text-brand-dark/50 italic font-sans">
                        No lab parameters added. Click a panel preset above or add a custom test.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {currentCase.labTests.map((t, index) => {
                          const isCustom = t.range === "Custom";
                          return (
                            <div key={index} className="flex gap-4 items-center flex-wrap md:flex-nowrap bg-brand-beige/25 p-3 rounded-xl border border-brand-light/35">
                              <div className="flex-grow min-w-[200px]">
                                <label className="block text-[8px] uppercase tracking-wider font-bold text-brand-secondary mb-1">Test Parameter</label>
                                <input
                                  type="text"
                                  value={t.testName}
                                  readOnly={!isCustom}
                                  onChange={(e) => updateCustomLabField(index, "testName", e.target.value)}
                                  className="w-full bg-brand-beige border border-brand-light/50 px-3 py-2 rounded-lg text-xs focus:outline-none read-only:opacity-80"
                                />
                              </div>

                              <div className="w-32">
                                <label className="block text-[8px] uppercase tracking-wider font-bold text-brand-secondary mb-1">Measured Value</label>
                                <input
                                  type="text"
                                  value={t.value}
                                  onChange={(e) => updateLabTestValue(index, e.target.value)}
                                  placeholder="e.g. 98.4"
                                  className="w-full bg-brand-beige border border-brand-light/50 px-3 py-2 rounded-lg text-xs font-bold focus:outline-none"
                                />
                              </div>

                              <div className="w-28">
                                <label className="block text-[8px] uppercase tracking-wider font-bold text-brand-secondary mb-1">Normal Range</label>
                                <input
                                  type="text"
                                  value={t.range}
                                  readOnly={!isCustom}
                                  onChange={(e) => updateCustomLabField(index, "range", e.target.value)}
                                  className="w-full bg-brand-beige border border-brand-light/50 px-3 py-2 rounded-lg text-[10px] focus:outline-none read-only:opacity-85 text-center"
                                />
                              </div>

                              <div className="w-20">
                                <label className="block text-[8px] uppercase tracking-wider font-bold text-brand-secondary mb-1">Unit</label>
                                <input
                                  type="text"
                                  value={t.unit}
                                  readOnly={!isCustom}
                                  onChange={(e) => updateCustomLabField(index, "unit", e.target.value)}
                                  className="w-full bg-brand-beige border border-brand-light/50 px-2 py-2 rounded-lg text-[10px] focus:outline-none read-only:opacity-85 text-center"
                                />
                              </div>

                              <button
                                onClick={() => removeLabTest(index)}
                                className="text-brand-dark/40 hover:text-red-500 p-2 cursor-pointer"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Follow up outcomes */}
                  <div className="bg-brand-cream border border-brand-light/60 p-6 rounded-3xl space-y-6 shadow-sm">
                    <div className="flex justify-between items-center border-b border-brand-light/40 pb-2 flex-wrap gap-2">
                      <h3 className="font-serif text-lg font-bold text-brand-primary">
                        Clinical Vitals and Follow-Up Outcomes
                      </h3>
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-brand-primary uppercase">Visit:</label>
                        <input
                          type="text"
                          list="visit-number-presets"
                          value={currentCase.visitNumber || `Visit ${(currentCase.visits || []).length + 1}`}
                          onChange={(e) => handleTextChange("visitNumber", e.target.value)}
                          className="bg-brand-beige border border-brand-light/50 px-3 py-1.5 rounded-lg text-xs font-bold text-brand-secondary focus:outline-none w-32"
                        />
                        <datalist id="visit-number-presets">
                          <option value="Visit 1" />
                          <option value="Visit 2" />
                          <option value="Visit 3" />
                          <option value="Visit 4" />
                          <option value="Visit 5" />
                          <option value="Routine Checkup" />
                          <option value="Emergency Consult" />
                        </datalist>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Wellness Rating (1-5) */}
                      <div>
                        <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Wellness Rating</label>
                        <div className="flex items-center gap-2 mt-1">
                          {[1, 2, 3, 4, 5].map((num) => {
                            const colors = {
                              1: "bg-red-500 text-white border-red-600 hover:bg-red-600",
                              2: "bg-orange-500 text-white border-orange-600 hover:bg-orange-600",
                              3: "bg-yellow-500 text-brand-dark border-yellow-600 hover:bg-yellow-600",
                              4: "bg-lime-500 text-white border-lime-600 hover:bg-lime-600",
                              5: "bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700",
                            };
                            const activeColor = colors[num];
                            const isSelected = (currentCase.wellnessRating || 1) === num;
                            return (
                              <button
                                key={num}
                                type="button"
                                onClick={() => {
                                  // Update rating
                                  handleTextChange("wellnessRating", num);
                                  // Sync outcomeScore for backwards compatibility
                                  const textScores = {
                                    1: "No Improvement",
                                    2: "Minimal Improvement (<25%)",
                                    3: "Mild Improvement (25–50%)",
                                    4: "Moderate Improvement (50–75%)",
                                    5: "Marked Improvement (>75%)"
                                  };
                                  handleTextChange("outcomeScore", textScores[num]);
                                }}
                                className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs border-2 cursor-pointer transition-all ${
                                  isSelected
                                    ? `${activeColor} scale-110 ring-2 ring-brand-primary/30 shadow-md`
                                    : "bg-brand-beige border-brand-light text-brand-secondary hover:bg-brand-light/35"
                                }`}
                                title={`${num}/5`}
                              >
                                {num}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-brand-dark/60 mt-2 font-medium italic">
                          {(() => {
                            const rating = currentCase.wellnessRating || 1;
                            if (rating === 5) return "5/5 - Fully OK (Cured - clears from pending)";
                            if (rating === 4) return "4/5 - Better (Stays in follow-up)";
                            if (rating === 3) return "3/5 - Moderate Improvement (Stays in follow-up)";
                            if (rating === 2) return "2/5 - Mild Improvement (Stays in follow-up)";
                            return "1/5 - Severe / No Change (Stays in follow-up)";
                          })()}
                        </p>
                      </div>

                      {/* Next Plan */}
                      <div>
                        <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Next Plan</label>
                        <select
                          value={currentCase.nextPlan || "Continue Same Treatment"}
                          onChange={(e) => handleTextChange("nextPlan", e.target.value)}
                          className="w-full bg-brand-beige border border-brand-light/50 px-4 py-3 rounded-xl text-sm focus:outline-none"
                        >
                          <option value="Continue Same Treatment">Continue Same Treatment</option>
                          <option value="Modify Medicines">Modify Medicines</option>
                          <option value="Add Panchakarma">Add Panchakarma</option>
                          <option value="Repeat Investigations">Repeat Investigations</option>
                          <option value="Refer to Specialist">Refer to Specialist</option>
                          <option value="Custom">Custom</option>
                        </select>
                      </div>

                      {/* Doctor's Notes */}
                      <div>
                        <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">Doctor's Follow-up Notes</label>
                        <textarea
                          rows={2}
                          value={currentCase.doctorsNotes || ""}
                          onChange={(e) => handleTextChange("doctorsNotes", e.target.value)}
                          placeholder="Clinical notes, observations..."
                          className="w-full bg-brand-beige border border-brand-light/50 px-4 py-3 rounded-xl text-xs focus:outline-none resize-none"
                        />
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* Clinical Wizard Navigation Footer (Common to all tabs) */}
              <div className="flex justify-between items-center py-4 border-t border-brand-light/20 mt-6 shrink-0 bg-brand-cream/10 rounded-2xl px-2">
                <button
                  type="button"
                  onClick={() => setActiveTab(getPrevTab())}
                  disabled={!getPrevTab()}
                  className="flex items-center gap-1 bg-brand-beige hover:bg-brand-light border border-brand-light px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-35 cursor-pointer text-brand-secondary"
                >
                  <ArrowLeft size={14} /> Back
                </button>

                {getNextTab() ? (
                  <button
                    type="button"
                    onClick={handleNextTab}
                    className="flex items-center gap-1 bg-brand-primary text-brand-beige hover:bg-brand-secondary px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-sm"
                  >
                    Next <ArrowRight size={14} />
                  </button>
                ) : (
                  currentCase.patientId ? (
                    <button
                      type="button"
                      onClick={() => handleRecordNewVisit()}
                      className="flex items-center gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-md cursor-pointer animate-pulse"
                      title="Record follow-up / archive current visit and start new"
                    >
                      <Plus size={14} /> Record Follow-up
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSaveAndRecordFollowUp}
                      className="flex items-center gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-md cursor-pointer animate-pulse"
                      title="Save demographics and record follow-up"
                    >
                      <Save size={14} /> Save and Record Follow-up
                    </button>
                  )
                )}
              </div>

            </div>
          )}

          {/* ==================== VIEW 1.5: WALK-INS & PATIENT SEARCH ==================== */}
          {viewMode === "walkins" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fadeIn">
              {/* Left Panel: Waiting Room (Walk-ins & Queue) */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-brand-cream border border-brand-light/60 p-6 rounded-3xl shadow-sm space-y-4">
                  <h3 className="font-serif font-bold text-brand-primary text-base border-b border-brand-light/50 pb-2 flex items-center gap-2">
                    <Calendar size={18} /> Waiting Room / Queue
                  </h3>
                  
                  {/* Quick Add to Queue Form */}
                  <form onSubmit={addToQueue} className="space-y-3 bg-brand-light/20 p-4 rounded-2xl border border-brand-light/45">
                    <span className="text-[10px] font-bold text-brand-secondary uppercase tracking-wider block">Add Walk-in to Queue</span>
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Patient Full Name"
                        value={queueName}
                        onChange={(e) => setQueueName(e.target.value)}
                        className="w-full bg-brand-beige border border-brand-light/50 px-3 py-2 rounded-xl text-xs focus:outline-none"
                        required
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          placeholder="Age"
                          value={queueAge}
                          onChange={(e) => setQueueAge(e.target.value)}
                          className="bg-brand-beige border border-brand-light/50 px-3 py-2 rounded-xl text-xs focus:outline-none"
                        />
                        <select
                          value={queueGender}
                          onChange={(e) => setQueueGender(e.target.value)}
                          className="bg-brand-beige border border-brand-light/50 px-3 py-2 rounded-xl text-xs focus:outline-none cursor-pointer"
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <input
                        type="tel"
                        placeholder="Mobile Number"
                        value={queueMobile}
                        onChange={(e) => setQueueMobile(e.target.value)}
                        className="w-full bg-brand-beige border border-brand-light/50 px-3 py-2 rounded-xl text-xs focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Reason for Visit / Symptoms"
                        value={queueReason}
                        onChange={(e) => setQueueReason(e.target.value)}
                        className="w-full bg-brand-beige border border-brand-light/50 px-3 py-2 rounded-xl text-xs focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 bg-brand-primary text-brand-beige font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-brand-secondary transition-colors cursor-pointer"
                    >
                      Check In Patient
                    </button>
                  </form>

                  {/* Queue List (One Patient at a Time) */}
                  <div className="space-y-4 pr-1">
                    {(() => {
                      const sortedQueue = [...liveQueue]
                        .filter(q => q.status === "Waiting" || q.status === "In-Consult")
                        .sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
                      
                      if (sortedQueue.length === 0) {
                        return (
                          <div className="py-8 text-center text-xs text-brand-dark/45 border border-dashed border-brand-light/60 rounded-2xl bg-brand-beige/25">
                            No patients waiting in queue today.
                          </div>
                        );
                      }

                      const patient = sortedQueue[0];
                      return (
                        <div className="space-y-3">
                          {/* Queue Position Status Header */}
                          <div className="flex justify-between items-center px-1 text-[10px] font-bold text-brand-secondary uppercase tracking-wider">
                            <span>Up Next in Line</span>
                            <span className="bg-brand-light border border-brand-secondary/25 px-2.5 py-0.5 rounded-full">
                              Patient 1 of {sortedQueue.length}
                            </span>
                          </div>

                          <div
                            className={`p-5 rounded-2xl border transition-all flex flex-col justify-between gap-4 shadow-sm ${
                              patient.status === "In-Consult"
                                ? "bg-brand-light/45 border-brand-secondary/40"
                                : "bg-brand-beige border-brand-light"
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div className="space-y-1">
                                <h4 className="font-serif font-bold text-brand-primary text-base">
                                  {patient.name}
                                </h4>
                                <p className="text-xs text-brand-secondary font-semibold uppercase tracking-wider">
                                  {patient.age || "N/A"} Yrs • {patient.gender}
                                </p>
                                {patient.mobile && (
                                  <span className="text-[10px] text-brand-dark/50 block font-medium">📞 {patient.mobile}</span>
                                )}
                                {patient.reason && (
                                  <div className="mt-2.5 bg-brand-cream/60 border border-brand-light/45 p-3 rounded-xl">
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-brand-secondary block mb-0.5">Reason for Visit</span>
                                    <p className="text-xs text-brand-dark/80 italic">
                                      "{patient.reason}"
                                    </p>
                                  </div>
                                )}
                              </div>
                              <span
                                className={`text-[9px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                                  patient.status === "Waiting"
                                    ? "bg-amber-50 text-amber-800 border-amber-255"
                                    : "bg-blue-50 text-blue-800 border-blue-255"
                                }`}
                              >
                                {patient.status}
                              </span>
                            </div>
                            
                            <div className="flex gap-2.5 justify-end border-t border-brand-light/35 pt-3">
                              {/* Skip / Absent Button */}
                              <button
                                type="button"
                                onClick={() => handleSkipQueuePatient(patient)}
                                className="flex items-center gap-1 bg-brand-cream hover:bg-brand-light/35 border border-brand-light text-brand-secondary px-3.5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                                title="Move this patient to the end of the queue"
                              >
                                Skip / Absent
                              </button>
                              
                              {/* Checkout Button */}
                              <button
                                type="button"
                                onClick={() => completeQueuePatient(patient.id)}
                                className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl hover:text-red-800 transition-colors cursor-pointer border border-red-200/25"
                                title="Check out / remove from queue"
                              >
                                <Trash2 size={14} />
                              </button>
                              
                              {/* Consult Button */}
                              <button
                                type="button"
                                onClick={() => consultQueuePatient(patient)}
                                className="flex items-center gap-1.5 bg-brand-primary text-brand-beige hover:bg-brand-secondary px-4.5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-sm"
                              >
                                Start Consultation
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Right Panel: Advanced Patient Search & Family Directory */}
              <div className="lg:col-span-7 space-y-6">
                <div className="bg-brand-cream border border-brand-light/60 p-6 rounded-3xl shadow-sm space-y-6">
                  <h3 className="font-serif font-bold text-brand-primary text-base border-b border-brand-light/50 pb-2 flex items-center gap-2">
                    <Search size={18} /> Clinic Patient Directory & Family Search
                  </h3>
                  
                  {/* Full Page Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-4 top-3.5 text-brand-secondary/60" size={16} />
                    <input
                      type="text"
                      placeholder="Search by Name or Mobile Number..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-brand-beige border border-brand-light px-11 py-3 rounded-2xl text-xs focus:outline-none focus:border-brand-primary shadow-inner"
                    />
                  </div>

                  {/* Search Results */}
                  <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                    {searchTerm.trim() === "" ? (
                      <div className="py-12 text-center text-xs text-brand-dark/45 space-y-2">
                        <p>Type a patient's name or mobile number above to search.</p>
                        <p className="text-[10px] italic">💡 Tip: Searching a phone number will automatically group all patients registered under it (e.g., family members).</p>
                      </div>
                    ) : filteredCasesList.length === 0 ? (
                      <div className="py-12 text-center text-xs text-brand-dark/45">
                        No matching patient records found.
                      </div>
                    ) : (
                      filteredCasesList.map((c) => (
                        <div
                          key={c.patientId}
                          onClick={() => selectCase(c)}
                          className="bg-brand-beige hover:bg-brand-light/15 border border-brand-light/45 p-4 rounded-2xl transition-all cursor-pointer hover:border-brand-primary flex justify-between items-center group shadow-sm"
                        >
                          <div>
                            <h4 className="font-serif font-bold text-brand-primary text-sm group-hover:text-brand-secondary transition-colors">
                              {c.name}
                            </h4>
                            <p className="text-xs text-brand-dark/60 mt-0.5">
                              {c.age || "N/A"} Yrs • {c.gender} • ID: <span className="font-mono">{c.patientId}</span>
                            </p>
                            {c.mobile && (
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <span className="bg-brand-light/65 border border-brand-secondary/20 text-brand-secondary text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                  📞 {c.mobile}
                                </span>
                                {savedCases.filter(p => p.mobile === c.mobile && p.patientId !== c.patientId).length > 0 && (
                                  <span className="bg-brand-accent/15 border border-brand-accent/25 text-brand-accent text-[9px] font-bold px-2 py-0.5 rounded-full">
                                    Family Member Profile
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="bg-brand-light/30 border border-brand-light p-2 rounded-xl group-hover:bg-brand-primary group-hover:text-brand-beige transition-all">
                            <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== VIEW 2: DATABASE ANALYTICS ==================== */}
          {viewMode === "analytics" && (
            <div className="space-y-8 animate-fadeIn">
              
              {/* Stat Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-brand-cream border border-brand-light/60 p-6 rounded-3xl shadow-sm text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-2 h-full bg-brand-primary" />
                  <span className="text-[10px] uppercase font-bold tracking-widest text-brand-secondary block mb-1">Total Consultations</span>
                  <span className="font-serif text-4xl font-extrabold text-brand-primary block">{analytics.totalCases}</span>
                  <span className="text-[10px] text-brand-dark/50 mt-1 block">Case files saved in database</span>
                </div>

                <div className="bg-brand-cream border border-brand-light/60 p-6 rounded-3xl shadow-sm text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-2 h-full bg-brand-secondary" />
                  <span className="text-[10px] uppercase font-bold tracking-widest text-brand-secondary block mb-1">Unique Patients</span>
                  <span className="font-serif text-4xl font-extrabold text-brand-primary block">{analytics.totalPatients}</span>
                  <span className="text-[10px] text-brand-dark/50 mt-1 block">Registered in clinic registry</span>
                </div>
              </div>

              {/* Charts grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Age & Gender Distribution */}
                <div className="bg-brand-cream border border-brand-light/60 p-6 rounded-3xl space-y-6 shadow-sm">
                  <h3 className="font-serif text-lg font-bold text-brand-primary border-b border-brand-light/40 pb-2">
                    Demographic Distribution
                  </h3>

                  {/* Gender Progress Bars */}
                  <div className="space-y-3">
                    <span className="text-[11px] font-bold text-brand-secondary uppercase tracking-wider block">Gender Distribution</span>
                    {Object.entries(analytics.genderCounts).map(([gender, count]) => {
                      const percentage = analytics.totalCases > 0 ? Math.round((count / analytics.totalCases) * 100) : 0;
                      return (
                        <div key={gender} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold text-brand-dark">
                            <span>{gender}</span>
                            <span>{count} ({percentage}%)</span>
                          </div>
                          <div className="w-full bg-brand-beige rounded-full h-2.5 overflow-hidden border border-brand-light/35">
                            <div 
                              className={`h-full rounded-full ${gender === "Male" ? "bg-brand-primary" : gender === "Female" ? "bg-brand-secondary" : "bg-brand-accent"}`} 
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Age Groups progress bars */}
                  <div className="space-y-3 pt-2">
                    <span className="text-[11px] font-bold text-brand-secondary uppercase tracking-wider block">Age Groups</span>
                    {Object.entries(analytics.ageCounts).map(([group, count]) => {
                      const percentage = analytics.totalCases > 0 ? Math.round((count / analytics.totalCases) * 100) : 0;
                      return (
                        <div key={group} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold text-brand-dark">
                            <span>{group} Yrs</span>
                            <span>{count} ({percentage}%)</span>
                          </div>
                          <div className="w-full bg-brand-beige rounded-full h-2 overflow-hidden border border-brand-light/30">
                            <div 
                              className="bg-brand-secondary/85 h-full rounded-full" 
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Prakriti & Agni Constitutions */}
                <div className="bg-brand-cream border border-brand-light/60 p-6 rounded-3xl space-y-6 shadow-sm">
                  <h3 className="font-serif text-lg font-bold text-brand-primary border-b border-brand-light/40 pb-2">
                    Ayurvedic Constitution Analysis
                  </h3>

                  {/* Prakriti distribution bars */}
                  <div className="space-y-3">
                    <span className="text-[11px] font-bold text-brand-secondary uppercase tracking-wider block">Prakriti (Metabolic Type)</span>
                    {Object.keys(analytics.prakritiCounts).length === 0 ? (
                      <p className="text-xs text-brand-dark/50 italic">No Prakriti data recorded yet.</p>
                    ) : (
                      Object.entries(analytics.prakritiCounts).map(([prak, count]) => {
                        const percentage = analytics.totalCases > 0 ? Math.round((count / analytics.totalCases) * 100) : 0;
                        return (
                          <div key={prak} className="space-y-1">
                            <div className="flex justify-between text-xs font-semibold text-brand-dark">
                              <span className="font-medium text-emerald-950">{prak}</span>
                              <span>{count} case{count > 1 ? "s" : ""} ({percentage}%)</span>
                            </div>
                            <div className="w-full bg-brand-beige rounded-full h-2 overflow-hidden border border-brand-light/30">
                              <div 
                                className="bg-brand-primary h-full rounded-full" 
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Agni distribution */}
                  <div className="space-y-3 pt-2">
                    <span className="text-[11px] font-bold text-brand-secondary uppercase tracking-wider block">Jatharagni (Digestive Power)</span>
                    {Object.keys(analytics.agniCounts).length === 0 ? (
                      <p className="text-xs text-brand-dark/50 italic">No Agni data recorded yet.</p>
                    ) : (
                      Object.entries(analytics.agniCounts).map(([agni, count]) => {
                        const percentage = analytics.totalCases > 0 ? Math.round((count / analytics.totalCases) * 100) : 0;
                        return (
                          <div key={agni} className="space-y-1">
                            <div className="flex justify-between text-xs font-semibold text-brand-dark">
                              <span>{agni} Agni</span>
                              <span>{count} ({percentage}%)</span>
                            </div>
                            <div className="w-full bg-brand-beige rounded-full h-2 overflow-hidden border border-brand-light/30">
                              <div 
                                className="bg-brand-accent h-full rounded-full" 
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Top Complaints Card */}
              <div className="bg-brand-cream border border-brand-light/60 p-6 rounded-3xl shadow-sm">
                <h3 className="font-serif text-lg font-bold text-brand-primary border-b border-brand-light/40 pb-2 mb-4">
                  Top Symptoms & Health Complaints
                </h3>
                {analytics.complaintCounts.length === 0 ? (
                  <p className="text-xs text-brand-dark/50 italic text-center py-6">No patient complaints registered in database yet.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {analytics.complaintCounts.map(([complaint, count], idx) => {
                      const pct = Math.round((count / analytics.totalCases) * 100);
                      return (
                        <div key={complaint} className="flex justify-between items-center bg-brand-beige/35 border border-brand-light/45 px-4 py-3 rounded-2xl">
                          <div className="flex items-center space-x-3">
                            <span className="h-7 w-7 rounded-full bg-brand-primary/10 border border-brand-light flex items-center justify-center font-bold text-xs text-brand-primary">
                              #{idx + 1}
                            </span>
                            <span className="text-xs font-bold text-brand-primary capitalize">{complaint}</span>
                          </div>
                          <span className="text-xs font-bold text-brand-secondary bg-brand-light/50 px-3 py-1 rounded-full border border-brand-secondary/15">
                            {count} occurrence{count > 1 ? "s" : ""} ({pct}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ==================== VIEW 3: ALERTS and FOLLOW-UPS ==================== */}
          {viewMode === "followups" && (
            <div className="space-y-8 animate-fadeIn">
              
              {/* Vitals and Lab Chemistry Alerts */}
              <div className="bg-brand-cream border border-brand-light/60 p-6 rounded-3xl space-y-4 shadow-sm">
                <h3 className="font-serif text-lg font-bold text-red-800 border-b border-brand-light/40 pb-2 flex items-center gap-2">
                  <AlertTriangle className="text-red-500 animate-pulse" size={20} />
                  <span>Clinical Lab alerts and Borderline Vitals</span>
                </h3>

                {alerts.length === 0 ? (
                  <div className="text-center py-8 text-xs text-brand-dark/55 italic font-sans">
                    No critical lab elevations or alerts flagged in patient database.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {alerts.map((al, idx) => (
                      <div key={idx} className={`p-4 rounded-2xl border flex flex-col justify-between space-y-3 shadow-sm ${
                        al.severity === "Critical" ? "bg-red-50/50 border-red-200" : "bg-amber-50/40 border-amber-250"
                      }`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-serif font-bold text-brand-primary text-sm">{al.patientName}</h4>
                            <p className="text-[10px] text-brand-secondary font-semibold uppercase">{al.mobile}</p>
                          </div>
                          <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                            al.severity === "Critical" ? "bg-red-100 text-red-800 border-red-300 animate-pulse" : "bg-amber-100 text-amber-800 border-amber-300"
                          }`}>
                            {al.severity}
                          </span>
                        </div>
                        <div className="bg-brand-cream/80 border border-brand-light/60 p-2.5 rounded-xl text-xs space-y-1">
                          <p className="text-brand-dark/70">
                            <strong>Parameter:</strong> {al.parameter}
                          </p>
                          <p className="text-brand-primary font-bold">
                            <strong>Measured Value:</strong> <span className={al.severity === "Critical" ? "text-red-600" : "text-amber-600"}>{al.measured}</span>
                          </p>
                          <p className="text-brand-dark/60 text-[10px]">
                            Normal Reference: {al.normalRange}
                          </p>
                        </div>
                        <div className="text-[10px] text-brand-dark/55 flex justify-between items-center">
                          <span>Reported: {new Date(al.visitDate).toLocaleDateString()}</span>
                          <a
                            href={`https://wa.me/91${al.mobile}?text=Hello%20${encodeURIComponent(al.patientName)}%2C%20this%20is%20Dr.%20Neha's%20clinic.%20We%20are%20reviewing%20your%20recent%20lab%20report%20for%20${encodeURIComponent(al.parameter)}.%20The%20measured%20value%20is%20${encodeURIComponent(al.measured)}.%20Please%20let%20us%20know%20when%20you%20can%20schedule%20a%20follow-up%20review.`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-green-700 hover:text-green-800 font-bold uppercase tracking-wider"
                          >
                            <MessageCircle size={12} /> Contact Patient
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Follow-up Reminders */}
              <div className="bg-brand-cream border border-brand-light/60 p-6 rounded-3xl space-y-4 shadow-sm">
                <h3 className="font-serif text-lg font-bold text-brand-primary border-b border-brand-light/40 pb-2 flex items-center gap-2">
                  <Calendar className="text-brand-secondary" size={20} />
                  <span>Clinical Follow-Up Reminders</span>
                </h3>

                {followups.length === 0 ? (
                  <div className="text-center py-8 text-xs text-brand-dark/55 italic font-sans">
                    No patients currently marked due for clinical follow-up reviews.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {followups.map((f, idx) => (
                      <div key={idx} className="p-4 bg-brand-beige/25 border border-brand-light/40 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:shadow-md transition-all">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-serif font-bold text-brand-primary text-base">{f.name}</h4>
                            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-light text-brand-primary border border-brand-secondary/15">
                              Last Visit: {f.daysAgo} Days Ago
                            </span>
                            {(String(f.outcome).match(/No Improvement|Worsened|Minimal/i)) && (
                              <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-250">
                                ⚠ {f.outcome}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-brand-secondary font-semibold uppercase">{f.mobile}</p>
                          <p className="text-xs text-brand-dark/75">
                            <strong>Chief Complaint:</strong> {f.reason}
                          </p>
                        </div>
                        <a
                          href={`https://wa.me/91${f.mobile}?text=Hello%20${encodeURIComponent(f.name)}%2C%20this%20is%20Dr.%20Neha's%20clinic%20(Ayurkaya).%20We%20are%20reviewing%20your%20recent%20consultation%20record%20for%20${encodeURIComponent(f.reason)}.%20How%20is%20your%20progress%20with%20your%20treatments%3F%20Please%20let%20us%20know%20if%20you%20need%20to%20coordinate%20a%20follow-up%20review.`}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-2 shadow-sm shrink-0 cursor-pointer self-stretch sm:self-center text-center justify-center"
                        >
                          <MessageCircle size={14} /> Send WhatsApp Reminder
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ==================== VIEW 4: DATABASE TOOLS ==================== */}
          {viewMode === "utilities" && (
            <div className="bg-brand-cream border border-brand-light/60 p-6 md:p-10 rounded-3xl space-y-8 shadow-sm animate-fadeIn">
              
              <div className="border-b border-brand-light/45 pb-4 space-y-2">
                <h3 className="font-serif text-2xl font-bold text-brand-primary flex items-center gap-2">
                  <Database size={24} className="text-brand-secondary" />
                  <span>System Backup, Restore and Reset Tools</span>
                </h3>
                <p className="text-xs text-brand-dark/70 font-sans leading-relaxed">
                  Your clinical records are now stored directly in Firestore. Backups are still recommended for offline recovery and export/import portability.
                </p>
              </div>

              {/* Utility grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* 1. Export */}
                <div className="bg-brand-beige/20 border border-brand-light/45 p-6 rounded-2xl space-y-4 flex flex-col justify-between">
                  <div className="space-y-2">
                    <Download className="text-brand-primary" size={28} />
                    <h4 className="font-serif font-bold text-base text-brand-primary">1. Backup Database</h4>
                    <p className="text-xs text-brand-dark/65 leading-relaxed font-sans">
                      Download all saved case sheets, registries, and waiting list patients as a single JSON file.
                    </p>
                  </div>
                  <button
                    onClick={handleExportBackup}
                    className="w-full bg-brand-primary text-brand-beige hover:bg-brand-secondary py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer mt-4"
                  >
                    Export JSON Backup
                  </button>
                </div>

                {/* 2. Restore Database */}
                <div className="bg-brand-beige/20 border border-brand-light/45 p-6 rounded-2xl space-y-4 flex flex-col justify-between relative">
                  <div className="space-y-2">
                    <Upload className="text-brand-secondary" size={28} />
                    <h4 className="font-serif font-bold text-base text-brand-primary">2. Restore Database</h4>
                    <p className="text-xs text-brand-dark/65 leading-relaxed font-sans">
                      Select a previously exported JSON backup file to override the database and restore files.
                    </p>
                  </div>
                  <div className="relative mt-4">
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportBackup}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                      id="db-backup-file-selector"
                    />
                    <button
                      type="button"
                      className="w-full bg-brand-secondary text-brand-beige hover:bg-brand-primary py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-sm pointer-events-none text-center"
                    >
                      Import JSON Restore
                    </button>
                  </div>
                </div>

                {/* 3. Storage Cleanup Optimizer */}
                <div className="bg-brand-beige/20 border border-brand-light/45 p-6 rounded-2xl space-y-4 flex flex-col justify-between">
                  <div className="space-y-2">
                    <Trash2 className="text-emerald-600 animate-pulse" size={28} />
                    <h4 className="font-serif font-bold text-base text-brand-primary">3. Historical Visit Purge</h4>
                    <p className="text-xs text-brand-dark/65 leading-relaxed font-sans">
                      Delete older consultations and timelines to save space. Strictly preserves each patient's basic profile details.
                    </p>
                    <div className="space-y-1.5 mt-4">
                      <label className="block text-[10px] font-bold text-brand-primary uppercase tracking-wider">Purge visits older than:</label>
                      <select
                        value={cleanupThreshold}
                        onChange={(e) => setCleanupThreshold(e.target.value)}
                        className="w-full bg-brand-beige border border-brand-light/75 px-3 py-2 rounded-xl text-xs font-semibold text-brand-secondary focus:outline-none cursor-pointer"
                      >
                        <option value="1m">Older than 1 Month</option>
                        <option value="3m">Older than 3 Months</option>
                        <option value="6m">Older than 6 Months</option>
                        <option value="9m">Older than 9 Months</option>
                        <option value="1y">Older than 1 Year</option>
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={runStorageCleanupSweep}
                    className="w-full bg-brand-primary text-brand-beige hover:bg-brand-secondary py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer mt-4"
                  >
                    Run Purge Sweep
                  </button>
                </div>

                {/* 4. Clear */}
                <div className="bg-brand-beige/20 border border-brand-light/45 p-6 rounded-2xl space-y-4 flex flex-col justify-between">
                  <div className="space-y-2">
                    <AlertTriangle className="text-red-500 animate-pulse" size={28} />
                    <h4 className="font-serif font-bold text-base text-brand-primary">4. Reset Database</h4>
                    <p className="text-xs text-brand-dark/65 leading-relaxed font-sans">
                      Delete all patient data records and registries. Passcode verification required.
                    </p>
                  </div>
                  <button
                    onClick={handleResetDatabase}
                    className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer mt-4"
                  >
                    Clear Database Sheets
                  </button>
                </div>

              </div>

              {/* Data Storage and Archiving Management Section */}
              <div className="border-t border-brand-light/45 pt-8 space-y-6">
                <div className="space-y-1">
                  <h3 className="font-serif text-xl font-bold text-brand-primary flex items-center gap-2">
                    <Database size={20} className="text-brand-secondary" />
                    <span>Data Archiving and Storage Metrics</span>
                  </h3>
                  <p className="text-xs text-brand-dark/70 font-sans">
                    Keep database lightweight by moving old clinical records to archive storage. Restores are supported at any time.
                  </p>
                </div>

                {storageMetrics && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-brand-beige/10 border border-brand-light/35 p-4 rounded-2xl text-center">
                        <div className="text-2xl font-bold text-brand-primary font-mono">{storageMetrics.totalPatients}</div>
                        <div className="text-[10px] text-brand-dark/65 font-bold uppercase tracking-wider mt-1">Total Patients</div>
                      </div>
                      <div className="bg-brand-beige/10 border border-brand-light/35 p-4 rounded-2xl text-center">
                        <div className="text-2xl font-bold text-emerald-700 font-mono">{storageMetrics.activeVisits}</div>
                        <div className="text-[10px] text-brand-dark/65 font-bold uppercase tracking-wider mt-1">Active Visits (&lt;6M)</div>
                      </div>
                      <div className="bg-brand-beige/10 border border-brand-light/35 p-4 rounded-2xl text-center">
                        <div className="text-2xl font-bold text-amber-700 font-mono">{storageMetrics.warmVisits}</div>
                        <div className="text-[10px] text-brand-dark/65 font-bold uppercase tracking-wider mt-1">Older Visits (&gt;6M)</div>
                      </div>
                    </div>

                    {/* Real-time Storage Utilization Progress Meter */}
                    <div className="flex flex-col md:flex-row md:items-start justify-between border-t border-brand-light/35 pt-6 gap-6">
                      <div className="space-y-1.5 shrink-0">
                        <label className="block text-[10px] font-bold text-brand-primary uppercase tracking-widest">Cloud Database Plan</label>
                        <select
                          value={cloudPlan}
                          onChange={(e) => handlePlanChange(e.target.value)}
                          className="bg-brand-beige border border-brand-light px-3 py-2 rounded-xl text-xs font-semibold text-brand-secondary focus:outline-none cursor-pointer w-full md:w-auto"
                        >
                          <option value="spark">Spark Plan (1 GB Free Tier)</option>
                          <option value="blaze">Blaze Plan (Pay-As-You-Go / Scalable)</option>
                          <option value="custom">Custom Limit...</option>
                        </select>
                        {cloudPlan === "custom" && (
                          <div className="flex items-center gap-2 mt-2 animate-fadeIn">
                            <span className="text-[10px] font-bold text-brand-primary uppercase tracking-wider">Limit:</span>
                            <input
                              type="number"
                              min="0.1"
                              step="0.1"
                              value={customLimitGB}
                              onChange={(e) => handleCustomLimitChange(e.target.value)}
                              className="w-20 bg-brand-beige border border-brand-light/70 px-2.5 py-1 rounded-lg text-xs font-mono focus:outline-none text-brand-secondary"
                              placeholder="e.g. 5"
                            />
                            <span className="text-xs text-brand-dark/70 font-semibold">GB</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-grow max-w-lg space-y-2">
                        {(() => {
                          const bytes = storageMetrics.totalBytes || 0;
                          const kb = bytes / 1024;
                          const mb = kb / 1024;
                          
                          let limitMB = 1024; // Default Spark 1 GB
                          if (cloudPlan === "custom") {
                            limitMB = (parseFloat(customLimitGB) || 5) * 1024;
                          }
                          const percentage = Math.min((mb / limitMB) * 100, 100);
                          
                          return (
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-xs font-semibold text-brand-dark/80">
                                <span>Storage Utilized:</span>
                                <span className="font-mono text-xs">
                                  {mb < 0.1 ? `${kb.toFixed(2)} KB` : `${mb.toFixed(2)} MB`}
                                  {cloudPlan === "spark" ? ` / ${limitMB} MB (${percentage.toFixed(4)}%)` : ""}
                                  {cloudPlan === "custom" ? ` / ${(limitMB / 1024).toFixed(1)} GB (${percentage.toFixed(4)}%)` : ""}
                                  {cloudPlan === "blaze" ? " (Unlimited Capacity)" : ""}
                                </span>
                              </div>
                              
                              {cloudPlan === "spark" || cloudPlan === "custom" ? (
                                <div className="w-full h-3 bg-brand-beige rounded-full overflow-hidden border border-brand-light/50 relative">
                                  <div 
                                    className="h-full bg-brand-secondary transition-all duration-700 rounded-full" 
                                    style={{ width: `${Math.max(percentage, 1.5)}%` }}
                                  />
                                </div>
                              ) : (
                                <div className="w-full h-4.5 bg-brand-beige rounded-full overflow-hidden border border-brand-light/50 relative flex items-center justify-center">
                                  <div 
                                    className="h-full bg-emerald-600 transition-all duration-700 rounded-full w-full opacity-20" 
                                  />
                                  <span className="absolute text-[8px] text-emerald-950 font-bold uppercase tracking-widest select-none">Auto-scaling Active (Infinite)</span>
                                </div>
                              )}
                              
                              <p className="text-[10px] text-brand-dark/50 italic leading-snug">
                                {cloudPlan === "spark" && "On Spark plan, Firestore enforces a strict 1 GB limit. Use cleanup sweeper tools below to keep utilization low."}
                                {cloudPlan === "blaze" && "On Blaze plan, Firestore has no storage limit and auto-scales dynamically. The first 1 GB remains completely free."}
                                {cloudPlan === "custom" && `Custom limit set to ${(limitMB / 1024).toFixed(1)} GB. Progress bar tracks usage relative to your specified capacity threshold.`}
                              </p>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}


                {/* Inactive Patient Purge Panel */}
                <div className="bg-white border border-brand-light/35 rounded-2xl overflow-hidden shadow-sm space-y-4 p-5">
                  <div className="flex justify-between items-center flex-wrap gap-3 pb-3 border-b border-brand-light/35">
                    <div className="space-y-1">
                      <span className="font-serif font-bold text-xs text-brand-primary uppercase tracking-wider block">Inactive Patient Profile Purge</span>
                      <span className="text-[10px] text-brand-dark/60 font-sans">Delete inactive patients completely (demographics and visits) to free up storage.</span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <select
                        value={inactiveFilter}
                        onChange={(e) => {
                          setInactiveFilter(e.target.value);
                          setSelectedInactiveIds([]);
                        }}
                        className="bg-brand-beige border border-brand-light px-2.5 py-1.5 rounded-lg text-xs font-semibold text-brand-secondary focus:outline-none cursor-pointer"
                      >
                        <option value="6m">Inactive for +6 Months</option>
                        <option value="9m">Inactive for +9 Months</option>
                        <option value="1y">Inactive for +1 Year</option>
                        <option value="2y">Inactive for +2 Years</option>
                      </select>

                      {selectedInactiveIds.length > 0 && (
                        <button
                          onClick={() => deleteInactivePatients(selectedInactiveIds)}
                          className="bg-red-700 text-brand-beige hover:bg-red-800 px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
                        >
                          <Trash2 size={13} /> Delete Selected ({selectedInactiveIds.length})
                        </button>
                      )}
                    </div>
                  </div>

                  {(() => {
                    const inactiveList = getInactivePatients();
                    return (
                      <div className="divide-y divide-brand-light/25 max-h-[350px] overflow-y-auto">
                        {inactiveList.length === 0 ? (
                          <div className="p-8 text-center text-xs text-brand-dark/50 font-sans">
                            No inactive patients found matching this threshold.
                          </div>
                        ) : (
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="text-brand-primary border-b border-brand-light/35 select-none bg-brand-light/5 text-[10px] font-bold uppercase tracking-wider">
                                <th className="p-2 w-8 text-center">
                                  <input
                                    type="checkbox"
                                    checked={selectedInactiveIds.length === inactiveList.length}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedInactiveIds(inactiveList.map(p => p.patientId));
                                      } else {
                                        setSelectedInactiveIds([]);
                                      }
                                    }}
                                    className="cursor-pointer rounded border-brand-light"
                                  />
                                </th>
                                <th className="p-2">Patient Details</th>
                                <th className="p-2">Last Visit</th>
                                <th className="p-2 w-20 text-center">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-brand-light/20">
                              {inactiveList.map((item) => {
                                const isChecked = selectedInactiveIds.includes(item.patientId);
                                const lastVisitDateStr = item.visitDate ? new Date(item.visitDate).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric"
                                }) : "Never";
                                
                                return (
                                  <tr key={item.patientId} className="hover:bg-brand-cream/35 transition-colors">
                                    <td className="p-2 text-center">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setSelectedInactiveIds(prev => [...prev, item.patientId]);
                                          } else {
                                            setSelectedInactiveIds(prev => prev.filter(id => id !== item.patientId));
                                          }
                                        }}
                                        className="cursor-pointer rounded border-brand-light"
                                      />
                                    </td>
                                    <td className="p-2 py-3">
                                      <div className="font-bold text-brand-primary">{item.name}</div>
                                      <div className="text-[10px] text-brand-dark/65 font-mono">{item.patientId} • {item.mobile || "No Mobile"}</div>
                                    </td>
                                    <td className="p-2">
                                      <div className="font-semibold text-brand-dark/85">{lastVisitDateStr}</div>
                                      <div className="text-[10px] text-brand-dark/50 italic">{item.visitDate ? getDurationString(item.visitDate) : ""}</div>
                                    </td>
                                    <td className="p-2 text-center">
                                      <button
                                        onClick={() => deleteInactivePatients([item.patientId])}
                                        className="text-red-700 hover:text-red-800 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                                        title="Delete Patient Profile & All Visits"
                                      >
                                        <Trash2 size={15} />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Status Info box */}
              <div className="bg-brand-beige/40 border border-brand-light/45 p-4.5 rounded-2xl flex items-start space-x-3 text-xs text-brand-dark/85 leading-relaxed">
                <Shield className="text-brand-secondary shrink-0 mt-0.5" size={16} />
                <div>
                    <strong>Security and Privacy Notice:</strong> All clinical records are saved directly to Firestore. Data is stored remotely in your configured Firebase project; export backups remain recommended for offline recovery.
            </div>
              </div>
            </div>
          )}

          {/* ==================== VIEW 6: ALL RECENT CASES ==================== */}
          {viewMode === "recent_cases" && (() => {
            // Derive unique year options from visit dates
            const availableYears = [...new Set(
              allVisitsCases
                .filter(p => p.visitDate)
                .map(p => new Date(p.visitDate).getFullYear())
            )].sort((a, b) => b - a);

            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

            const filteredRecents = allVisitsCases.filter(c => {
              const q = recentSearch.toLowerCase();
              const matchSearch = !q || (
                (c.name || "").toLowerCase().includes(q) ||
                (c.patientId || "").toLowerCase().includes(q) ||
                (c.mobile || "").includes(q)
              );
              let matchMonth = true;
              let matchYear = true;
              if (c.visitDate) {
                const d = new Date(c.visitDate);
                if (recentMonthFilter) matchMonth = d.getMonth() === parseInt(recentMonthFilter);
                if (recentYearFilter) matchYear = d.getFullYear() === parseInt(recentYearFilter);
              } else {
                if (recentMonthFilter || recentYearFilter) { matchMonth = false; matchYear = false; }
              }
              return matchSearch && matchMonth && matchYear;
            });

            return (
              <div className="bg-brand-cream border border-brand-light/60 p-6 md:p-10 rounded-3xl shadow-sm space-y-6 animate-fadeIn">
                {/* Header */}
                <div className="border-b border-brand-light/45 pb-4 space-y-2">
                  <div className="flex justify-between items-center flex-wrap gap-4">
                    <h3 className="font-serif text-2xl font-bold text-brand-primary flex items-center gap-2">
                      <History size={24} className="text-brand-secondary" />
                      <span>Directory of All Case Sheets</span>
                    </h3>
                    <span className="bg-brand-light border border-brand-primary/20 text-brand-primary text-xs font-bold px-3 py-1 rounded-full">
                      {filteredRecents.length} / {allVisitsCases.length} Shown
                    </span>
                  </div>
                  <p className="text-xs text-brand-dark/70 font-sans leading-relaxed">
                    All consultation and case files stored in the cloud database. Click any card to load it into the clinical workspace.
                  </p>
                </div>

                {/* Search + Filter Bar */}
                <div className="flex flex-wrap gap-3 items-center">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-secondary/60 pointer-events-none" />
                    <input
                      type="text"
                      value={recentSearch}
                      onChange={e => setRecentSearch(e.target.value)}
                      placeholder="Search by name, ID, or mobile…"
                      className="w-full pl-8 pr-3 py-2.5 text-xs border border-brand-light/60 rounded-xl bg-brand-beige placeholder-brand-dark/35 text-brand-dark font-medium outline-none focus:border-brand-primary/50 focus:ring-1 focus:ring-brand-primary/20 transition"
                    />
                  </div>

                  <select
                    value={recentMonthFilter}
                    onChange={e => setRecentMonthFilter(e.target.value)}
                    className="px-3 py-2.5 text-xs border border-brand-light/60 rounded-xl bg-brand-beige text-brand-dark font-semibold outline-none focus:border-brand-primary/50 transition cursor-pointer"
                  >
                    <option value="">All Months</option>
                    {monthNames.map((m, i) => (
                      <option key={i} value={i}>{m}</option>
                    ))}
                  </select>

                  <select
                    value={recentYearFilter}
                    onChange={e => setRecentYearFilter(e.target.value)}
                    className="px-3 py-2.5 text-xs border border-brand-light/60 rounded-xl bg-brand-beige text-brand-dark font-semibold outline-none focus:border-brand-primary/50 transition cursor-pointer"
                  >
                    <option value="">All Years</option>
                    {availableYears.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>

                  {(recentSearch || recentMonthFilter || recentYearFilter) && (
                    <button
                      onClick={() => { setRecentSearch(""); setRecentMonthFilter(""); setRecentYearFilter(""); }}
                      className="text-[10px] text-red-500 font-bold uppercase tracking-wider hover:text-red-700 transition-colors cursor-pointer px-2"
                    >
                      ✕ Clear
                    </button>
                  )}
                </div>

                {filteredRecents.length === 0 ? (
                  <div className="py-16 text-center text-xs text-brand-dark/45 border border-dashed border-brand-light/60 rounded-3xl bg-brand-beige/25">
                    {allVisitsCases.length === 0
                      ? 'No case sheets found in the database. Use "Walk-ins & Search" to register and consult patients.'
                      : "No cases match your current search or filter."}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredRecents.map((c) => {
                      const loadedDate = c.visitDate ? new Date(c.visitDate) : null;
                      const dateStr = loadedDate
                        ? loadedDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                        : null;
                      const timeStr = loadedDate
                        ? loadedDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
                        : null;
                      return (
                        <div
                          key={c.entryId}
                          onClick={() => selectCase(c, "profile", true)}
                          className="bg-brand-beige hover:bg-brand-light/15 border border-brand-light/45 p-5 rounded-2xl transition-all cursor-pointer hover:border-brand-primary flex flex-col justify-between group shadow-sm animate-fadeIn"
                        >
                          <div className="space-y-2">
                            <div className="flex justify-between items-start">
                              <h4 className="font-serif font-bold text-brand-primary text-sm group-hover:text-brand-secondary transition-colors line-clamp-1">
                                {c.name}
                              </h4>
                              <span className="font-mono text-[9px] font-bold text-brand-secondary bg-brand-light/20 px-2 py-0.5 rounded">
                                {c.patientId}
                              </span>
                            </div>
                            <p className="text-xs text-brand-dark/60 font-semibold">
                              {c.age || "N/A"} Yrs • {c.gender}
                            </p>
                            {c.mobile && (
                              <span className="text-[10px] text-brand-secondary/80 font-medium block">
                                📞 {c.mobile}
                              </span>
                            )}
                            {c.complaints && c.complaints.length > 0 && c.complaints[0].text && (
                              <div className="mt-2 pt-2 border-t border-brand-light/20">
                                <span className="text-[10px] text-brand-dark/65 italic block line-clamp-1" title={c.complaints.map(comp => comp.text).join(", ")}>
                                  🩺 {c.complaints.map(comp => comp.text).join(", ")}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="mt-4 border-t border-brand-light/35 pt-3 flex items-center justify-between">
                            {dateStr ? (
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-brand-dark/50 uppercase tracking-wider">Created</span>
                                <span className="text-[11px] font-semibold text-brand-primary">{dateStr}</span>
                                <span className="text-[10px] text-brand-dark/45">{timeStr}</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-brand-dark/30 italic">No timestamp</span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); selectCase(c, "profile", true); }}
                              className="flex items-center gap-1 bg-brand-primary text-brand-beige hover:bg-brand-secondary px-3.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                            >
                              View Case
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

        </div>

      </div>

      {/* Floating Action Buttons for iPad / Touch Convenience */}
      {viewMode === "clinical" && (
        <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-30 lg:hidden print:hidden">
          <button
            onClick={() => {
              if (!currentCase.name.trim()) {
                triggerNotification("Must save patient profile with a name first!");
                return;
              }
              setIsPrintMode(true);
            }}
            className="h-12 w-12 rounded-full bg-brand-primary text-brand-beige shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-pointer border border-brand-light/35 animate-fadeIn"
            title="Generate Rx / Print"
          >
            <Printer size={20} />
          </button>
          <button
            onClick={saveCase}
            className="h-12 w-12 rounded-full bg-brand-secondary text-brand-beige shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-pointer border border-brand-light/35 animate-fadeIn"
            title="Save Record"
          >
            <Save size={20} />
          </button>
        </div>
      )}

      {/* Duplicate Patient Alert Modal Overlay */}
      {duplicatePatientFound && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-brand-cream border border-brand-light rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scaleUp">
            <h3 className="font-serif text-lg font-bold text-brand-primary">Duplicate Patient Detected</h3>
            <p className="text-sm text-brand-dark/85 font-sans leading-relaxed">
              A patient named <strong>{duplicatePatientFound.name}</strong> ({duplicatePatientFound.patientId}) already exists in the system with this mobile number and date of birth.
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => {
                  setDuplicatePatientFound(null);
                  setCurrentCase(prev => ({ ...prev, dateOfBirth: "" }));
                }}
                className="px-4 py-2 text-xs font-bold text-brand-primary bg-brand-light/20 rounded-xl hover:bg-brand-light/35 transition-colors uppercase tracking-wider cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  selectCase(duplicatePatientFound);
                  setDuplicatePatientFound(null);
                }}
                className="px-4 py-2 text-xs font-bold text-brand-beige bg-brand-primary rounded-xl hover:bg-brand-secondary transition-colors uppercase tracking-wider cursor-pointer"
              >
                Open Existing Patient
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
