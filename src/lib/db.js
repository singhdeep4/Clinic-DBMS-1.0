const DB_NAME = "ayurkaya_clinic_db";
const DB_VERSION = 5;

export function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("IndexedDB Open Error:", event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;

      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains("cases")) {
          db.createObjectStore("cases", { keyPath: "patientId" });
        }
        if (!db.objectStoreNames.contains("queue")) {
          db.createObjectStore("queue", { keyPath: "id" });
        }
      }

      if (oldVersion < 3) {
        if (db.objectStoreNames.contains("registry")) {
          db.deleteObjectStore("registry");
        }
        db.createObjectStore("registry", { keyPath: "patientId" });
      }

      // Upgrade registry and cases to version 4 to force clean sequential 8-digit logical IDs
      if (oldVersion < 4) {
        if (db.objectStoreNames.contains("cases")) {
          db.deleteObjectStore("cases");
        }
        db.createObjectStore("cases", { keyPath: "patientId" });

        if (db.objectStoreNames.contains("registry")) {
          db.deleteObjectStore("registry");
        }
        db.createObjectStore("registry", { keyPath: "patientId" });
        
        localStorage.removeItem("ayurkaya_indexeddb_migrated");
      }

      if (oldVersion < 5) {
        if (!db.objectStoreNames.contains("patients")) {
          const patientStore = db.createObjectStore("patients", { keyPath: "patientId" });
          patientStore.createIndex("mobile", "mobile", { unique: false });
          patientStore.createIndex("dateOfBirth", "dateOfBirth", { unique: false });
          patientStore.createIndex("mobile_dob", ["mobile", "dateOfBirth"], { unique: false });
        }
        if (!db.objectStoreNames.contains("visits")) {
          const visitStore = db.createObjectStore("visits", { keyPath: "visitId" });
          visitStore.createIndex("patientId", "patientId", { unique: false });
          visitStore.createIndex("visitDate", "visitDate", { unique: false });
          visitStore.createIndex("status", "status", { unique: false });
        }
        if (!db.objectStoreNames.contains("archived_records")) {
          const archiveStore = db.createObjectStore("archived_records", { keyPath: "archiveId", autoIncrement: true });
          archiveStore.createIndex("patientId", "patientId", { unique: false });
        }
        // Remove migration check to trigger v5 data migration
        localStorage.removeItem("ayurkaya_v5_migrated");
      }
    };
  });
}

export async function getAllItems(storeName) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function putItem(storeName, item) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.put(item);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteItem(storeName, key) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearStore(storeName) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Automatic one-time migration from LocalStorage to IndexedDB
export async function migrateFromLocalStorage() {
  const isMigrated = localStorage.getItem("ayurkaya_indexeddb_migrated");
  if (isMigrated === "true") return;

  console.log("Starting data migration to IndexedDB (v4 with 8-digit patientId sequence)...");

  try {
    // 1. Migrate Cases with 8-digit sequence (PAT-00000001)
    const migratedCases = [];
    const localCasesStr = localStorage.getItem("ayurkaya_patient_cases");
    if (localCasesStr) {
      const cases = JSON.parse(localCasesStr);
      if (Array.isArray(cases)) {
        let count = 1;
        for (const c of cases) {
          if (c.name || c.mobile) {
            const logicalId = `PAT-${String(count++).padStart(8, "0")}`;
            const updatedCase = { ...c, patientId: logicalId };
            await putItem("cases", updatedCase);
            migratedCases.push(updatedCase);
          }
        }
      }
    }

    // 2. Migrate Registry
    const localRegistryStr = localStorage.getItem("ayurkaya_patient_registry");
    if (localRegistryStr) {
      const registry = JSON.parse(localRegistryStr);
      if (typeof registry === "object" && registry !== null) {
        let count = migratedCases.length + 1;
        for (const mobile in registry) {
          const item = registry[mobile];
          if (item) {
            // Find if there is a migrated case with the same mobile and name
            const matchingCase = migratedCases.find(
              c => {
                const cMobile = (c.mobile || "").replace(/[^0-9]/g, "");
                const rMobile = mobile.replace(/[^0-9]/g, "");
                return cMobile === rMobile && 
                       (c.name || "").trim().toLowerCase() === (item.name || "").trim().toLowerCase();
              }
            );

            // Re-use logical patientId from matching case if it exists, otherwise generate next in sequence
            const patientId = matchingCase ? matchingCase.patientId : `PAT-${String(count++).padStart(8, "0")}`;

            await putItem("registry", {
              patientId,
              name: item.name || "",
              age: item.age || "",
              gender: item.gender || "Male",
              mobile: mobile.replace(/[^0-9]/g, ""),
              occupation: item.occupation || "",
              updatedAt: item.updatedAt || new Date().toISOString()
            });
          }
        }
      }
    }

    // 3. Migrate Live Queue
    const localQueueStr = localStorage.getItem("ayurkaya_live_queue");
    if (localQueueStr) {
      const queue = JSON.parse(localQueueStr);
      if (Array.isArray(queue)) {
        for (const q of queue) {
          if (q.id) {
            await putItem("queue", q);
          }
        }
      }
    }

    // Mark as migrated
    localStorage.setItem("ayurkaya_indexeddb_migrated", "true");
    console.log("Migration to IndexedDB v4 completed successfully.");
  } catch (err) {
    console.error("Migration error:", err);
  }
}

export async function migrateToV5() {
  const isMigrated = localStorage.getItem("ayurkaya_v5_migrated");
  if (isMigrated === "true") return;

  console.log("Starting data migration to IndexedDB v5 (normalized patients and visits)...");

  try {
    const oldCases = await getAllItems("cases").catch(() => []);
    const oldRegistry = await getAllItems("registry").catch(() => []);

    // 1. Migrate patients from cases
    for (const c of oldCases) {
      if (c.patientId) {
        const patientRecord = {
          patientId: c.patientId,
          name: c.name || "",
          age: c.age || "",
          dateOfBirth: c.dateOfBirth || "",
          gender: c.gender || "Male",
          mobile: (c.mobile || "").replace(/[^0-9]/g, ""),
          occupation: c.occupation || "",
          email: c.email || "",
          address: c.address || "",
          status: c.status || "Active",
          createdAt: c.createdAt || c.visitDate || new Date().toISOString(),
          updatedAt: c.updatedAt || new Date().toISOString()
        };
        await putItem("patients", patientRecord);

        // Extract active visit
        const visitDate = c.visitDate || new Date().toISOString();
        const visitId = `VIS-${c.patientId}-${Date.parse(visitDate)}`;
        const activeVisit = {
          visitId,
          patientId: c.patientId,
          visitDate,
          visitNumber: (c.visits || []).length + 1,
          status: "active",
          chiefComplaints: c.chiefComplaints || c.chief_complaints || [],
          kshudha: c.kshudha || "",
          mutra: c.mutra || "",
          mala: c.mala || "",
          koshtha: c.koshtha || "",
          nidra: c.nidra || "",
          avastha: c.avastha || "",
          pastHistory: c.pastHistory || c.past_history || [],
          drugHistory: c.drugHistory || c.drug_history || [],
          familyHistory: c.familyHistory || c.family_history || [],
          addiction: c.addiction || "",
          examinationNotes: c.examinationNotes || c.examination_notes || "",
          bloodPressure: c.bloodPressure || c.blood_pressure || "",
          heartRate: c.heartRate || c.heart_rate || "",
          temperature: c.temperature || "",
          labTests: c.labTests || c.lab_tests || [],
          medications: c.medications || [],
          diagnosis: c.diagnosis || "",
          treatmentPlan: c.treatmentPlan || c.treatment_plan || "",
          followUpDate: c.followUpDate || c.follow_up_date || "",
          outcomeScore: c.outcomeScore || "No Improvement",
          nextPlan: c.nextPlan || "Continue Same Treatment",
          notes: c.notes || "",
          doctorsNotes: c.doctorsNotes || c.doctors_notes || "",
          followUpSymptoms: c.followUpSymptoms || "Same",
          followUpAgni: c.followUpAgni || "Same",
          followUpTreatment: c.followUpTreatment || "Continued",
          visitNumberDropdown: c.visitNumber || "",
          panchakarmaAdvice: c.panchakarmaAdvice || [],
          pathyaApathya: c.pathyaApathya || ""
        };
        await putItem("visits", activeVisit);

        // Extract historical visits
        if (Array.isArray(c.visits)) {
          for (let i = 0; i < c.visits.length; i++) {
            const pv = c.visits[i];
            const pvDate = pv.visitDate || new Date(Date.now() - (i + 1) * 86400000).toISOString();
            const pvId = pv.visitId || `VIS-${c.patientId}-${Date.parse(pvDate)}-${i}`;
            const historicalVisit = {
              ...pv,
              visitId: pvId,
              patientId: c.patientId,
              visitDate: pvDate,
              visitNumber: c.visits.length - i,
              status: "completed"
            };
            delete historicalVisit.visits;
            await putItem("visits", historicalVisit);
          }
        }
      }
    }

    // 2. Migrate patients from registry who are not in cases
    const patients = await getAllItems("patients").catch(() => []);
    const patientIds = new Set(patients.map(p => p.patientId));
    for (const r of oldRegistry) {
      if (r.patientId && !patientIds.has(r.patientId)) {
        await putItem("patients", {
          patientId: r.patientId,
          name: r.name || "",
          age: r.age || "",
          dateOfBirth: r.dateOfBirth || "",
          gender: r.gender || "Male",
          mobile: (r.mobile || "").replace(/[^0-9]/g, ""),
          occupation: r.occupation || "",
          email: r.email || "",
          address: r.address || "",
          status: "Active",
          createdAt: r.updatedAt || new Date().toISOString(),
          updatedAt: r.updatedAt || new Date().toISOString()
        });
      }
    }

    localStorage.setItem("ayurkaya_v5_migrated", "true");
    console.log("Migration to IndexedDB v5 completed successfully.");
  } catch (err) {
    console.error("V5 Migration error:", err);
  }
}
