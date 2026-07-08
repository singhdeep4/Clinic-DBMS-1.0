import { putItem, getAllItems } from "./db.js";

// Check if a patient already exists with the same phone and DOB
export async function findDuplicatePatient(mobile, dob) {
  if (!mobile || !dob) return null;
  const cleanMobile = mobile.replace(/[^0-9]/g, "");
  
  try {
    const patients = await getAllItems("patients");
    return patients.find(
      p => (p.mobile || "").replace(/[^0-9]/g, "") === cleanMobile && p.dateOfBirth === dob
    ) || null;
  } catch (err) {
    console.error("Duplicate check error:", err);
    return null;
  }
}

// Get patient details and their full visit history
export async function getPatientWithVisits(patientId) {
  if (!patientId) return null;
  
  try {
    const { doc, getDoc, collection, getDocs, query, where } = await import("firebase/firestore");
    const { db: fdb } = await import("./firebase.js");

    const patientSnapshot = await getDoc(doc(fdb, "patients", patientId));
    const patient = patientSnapshot.exists() ? patientSnapshot.data() : null;

    const visitsQuery = query(collection(fdb, "visits"), where("patientId", "==", patientId));
    const visitsSnapshot = await getDocs(visitsQuery);
    const visits = visitsSnapshot.docs
      .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
      .sort((a, b) => new Date(b.visitDate || 0) - new Date(a.visitDate || 0));

    return {
      patient,
      visits
    };
  } catch (err) {
    console.error("Error fetching patient with visits:", err);
    return null;
  }
}

// Get all visits for a patient ID
export async function getPatientVisits(patientId) {
  if (!patientId) return [];
  try {
    const { collection, getDocs, query, where } = await import("firebase/firestore");
    const { db: fdb } = await import("./firebase.js");

    const visitsQuery = query(collection(fdb, "visits"), where("patientId", "==", patientId));
    const visitsSnapshot = await getDocs(visitsQuery);
    return visitsSnapshot.docs
      .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
      .sort((a, b) => new Date(b.visitDate || 0) - new Date(a.visitDate || 0));
  } catch (err) {
    console.error("Error fetching patient visits:", err);
    return [];
  }
}

// Generate the next patient sequence ID (PAT-00000001 format)
export async function getNextPatientId() {
  try {
    const patients = await getAllItems("patients");
    // Build a set of existing numeric sequence values (integers) for PAT- ids
    const nums = new Set();
    let maxNum = 0;
    for (const p of patients) {
      const id = p.patientId;
      if (id && id.startsWith("PAT-")) {
        const num = parseInt(id.replace("PAT-", ""), 10);
        if (!isNaN(num) && num > 0) {
          nums.add(num);
          if (num > maxNum) maxNum = num;
        }
      }
    }

    // Find smallest missing positive integer starting from 1
    for (let i = 1; i <= maxNum; i++) {
      if (!nums.has(i)) {
        return `PAT-${String(i).padStart(8, "0")}`;
      }
    }

    // If none missing, use next after max
    return `PAT-${String(maxNum + 1).padStart(8, "0")}`;
  } catch (err) {
    console.error("Error generating sequential patient ID:", err);
    // Fallback to random identifier if sequence fails
    return "PAT-" + Math.floor(10000000 + Math.random() * 90000000);
  }
}
