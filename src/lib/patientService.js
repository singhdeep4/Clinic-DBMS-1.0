import { initDB, putItem, getAllItems } from "./db.js";

// Check if a patient already exists with the same phone and DOB
export async function findDuplicatePatient(mobile, dob) {
  if (!mobile || !dob) return null;
  const cleanMobile = mobile.replace(/[^0-9]/g, "");
  
  try {
    const db = await initDB();
    return new Promise((resolve) => {
      const transaction = db.transaction("patients", "readonly");
      const store = transaction.objectStore("patients");
      const index = store.index("mobile_dob");
      const request = index.get([cleanMobile, dob]);
      
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      
      request.onerror = (e) => {
        console.warn("Index query failed, falling back to scanning.", e);
        // Fallback scan
        getAllItems("patients").then(patients => {
          const match = patients.find(
            p => (p.mobile || "").replace(/[^0-9]/g, "") === cleanMobile && p.dateOfBirth === dob
          );
          resolve(match || null);
        }).catch(() => resolve(null));
      };
    });
  } catch (err) {
    console.error("Duplicate check error:", err);
    return null;
  }
}

// Get patient details and their full visit history
export async function getPatientWithVisits(patientId) {
  if (!patientId) return null;
  
  try {
    const db = await initDB();
    
    // Get patient details
    const patientPromise = new Promise((resolve, reject) => {
      const transaction = db.transaction("patients", "readonly");
      const store = transaction.objectStore("patients");
      const request = store.get(patientId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    
    // Get visits
    const visitsPromise = new Promise((resolve, reject) => {
      const transaction = db.transaction("visits", "readonly");
      const store = transaction.objectStore("visits");
      const index = store.index("patientId");
      const request = index.getAll(patientId);
      request.onsuccess = () => {
        const sorted = (request.result || []).sort(
          (a, b) => new Date(b.visitDate || 0) - new Date(a.visitDate || 0)
        );
        resolve(sorted);
      };
      request.onerror = () => reject(request.error);
    });
    
    const [patient, visits] = await Promise.all([patientPromise, visitsPromise]);
    
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
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("visits", "readonly");
      const store = transaction.objectStore("visits");
      const index = store.index("patientId");
      const request = index.getAll(patientId);
      request.onsuccess = () => {
        const sorted = (request.result || []).sort(
          (a, b) => new Date(b.visitDate || 0) - new Date(a.visitDate || 0)
        );
        resolve(sorted);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Error fetching patient visits:", err);
    return [];
  }
}

// Generate the next patient sequence ID (PAT-00000001 format)
export async function getNextPatientId() {
  try {
    const patients = await getAllItems("patients");
    const ids = new Set(patients.map(p => p.patientId));
    let maxNum = 0;
    for (const id of ids) {
      if (id && id.startsWith("PAT-")) {
        const num = parseInt(id.replace("PAT-", ""), 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
    return `PAT-${String(maxNum + 1).padStart(8, "0")}`;
  } catch (err) {
    console.error("Error generating sequential patient ID:", err);
    // Fallback to random identifier if sequence fails
    return "PAT-" + Math.floor(10000000 + Math.random() * 90000000);
  }
}
