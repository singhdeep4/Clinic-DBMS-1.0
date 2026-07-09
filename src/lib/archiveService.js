import { putItem, getAllItems, deleteItem } from "./db.js";

const ARCHIVE_THRESHOLD_DAYS = 365; // 1 year retention policy as requested

// Run archival sweep for visits older than 1 year
export async function runArchivalSweep() {
  try {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - ARCHIVE_THRESHOLD_DAYS);
    
    // Fetch all visits
    const visits = await getAllItems("visits");
    
    let archiveCount = 0;
    
    for (const visit of visits) {
      const visitDate = new Date(visit.visitDate);
      
      // If visit is older than the retention threshold and is not already archived/active
      if (visitDate < thresholdDate && visit.status !== "archived") {
        console.log(`Archiving visit ${visit.visitId} for patient ${visit.patientId} (date: ${visit.visitDate})...`);
        
        // Prepare archive wrapper record
        const archiveRecord = {
          originalTable: "visits",
          originalId: visit.visitId,
          patientId: visit.patientId,
          data: {
            ...visit,
            status: "archived" // mark the internal status as archived
          },
          archivedAt: new Date().toISOString(),
          archivedReason: "retention_policy_1_year"
        };
        
        // 1. Put into archived_records
        await putItem("archived_records", archiveRecord);
        
        // 2. Delete from active visits
        await deleteItem("visits", visit.visitId);
        
        archiveCount++;
      }
    }
    
    // Log the run date to avoid running it repeatedly on every render/mount
    localStorage.setItem("ayurkaya_last_archival_sweep", new Date().toISOString());
    
    return {
      success: true,
      archivedCount: archiveCount
    };
  } catch (err) {
    console.error("Failed to run archival sweep:", err);
    return { success: false, error: err.message };
  }
}

// Fetch all archived records for a specific patient
export async function getPatientArchivedVisits(patientId) {
  if (!patientId) return [];
  try {
    const { collection, getDocs, query, where } = await import("firebase/firestore");
    const { db: fdb } = await import("./firebase.js");
    const visitsQuery = query(collection(fdb, "archived_records"), where("patientId", "==", patientId));
    const querySnapshot = await getDocs(visitsQuery);
    const results = querySnapshot.docs.map(docSnap => {
      const archive = docSnap.data();
      return {
        ...archive.data,
        archiveId: archive.archiveId || docSnap.id,
        archivedAt: archive.archivedAt,
        archivedReason: archive.archivedReason
      };
    }).sort((a, b) => new Date(b.visitDate || 0) - new Date(a.visitDate || 0));
    return results;
  } catch (err) {
    console.error("Error fetching patient archived visits:", err);
    return [];
  }
}

// Restore a previously archived visit back to the visits table
export async function restoreArchivedVisit(archiveId) {
  if (!archiveId) return { success: false, error: "No archiveId provided" };
  
  try {
    const { doc, getDoc } = await import("firebase/firestore");
    const { db: fdb } = await import("./firebase.js");
    
    // 1. Find archived record
    const archiveSnapshot = await getDoc(doc(fdb, "archived_records", archiveId));
    const archiveRecord = archiveSnapshot.exists() ? archiveSnapshot.data() : null;
    
    if (!archiveRecord) {
      return { success: false, error: "Archived record not found" };
    }
    
    // Restore visit object
    const visitToRestore = {
      ...archiveRecord.data,
      status: "completed" // Set restored visits back to completed status
    };
    
    // Remove injected archive fields
    delete visitToRestore.archiveId;
    delete visitToRestore.archivedAt;
    delete visitToRestore.archivedReason;
    
    // 2. Put back into visits store
    await putItem("visits", visitToRestore);
    
    // 3. Delete wrapper from archived_records
    await deleteItem("archived_records", archiveId);
    
    console.log(`Restored visit ${visitToRestore.visitId} for patient ${visitToRestore.patientId}`);
    return { success: true };
  } catch (err) {
    console.error("Error restoring archived visit:", err);
    return { success: false, error: err.message };
  }
}

// Official Google Cloud Firestore Billing specification for document storage calculation
export function calculateFirestoreDocSize(item, collectionName, docId) {
  if (!item) return 0;
  
  // Base document cost (32 bytes) + Document name (database ID '(default)' (9 bytes) + path size + 16 bytes)
  const dbIdSize = 9;
  const pathSize = (collectionName || "").length + 1 + (docId || "").length;
  let totalBytes = dbIdSize + pathSize + 16 + 32;

  function calculateValueSize(val) {
    if (val === null || val === undefined) return 1;
    if (typeof val === "boolean") return 1;
    if (typeof val === "number") return 8;
    if (typeof val === "string") {
      return new TextEncoder().encode(val).length + 1;
    }
    if (val instanceof Date) return 8;
    // Check if timestamp (like Firestore Timestamp { seconds, nanoseconds })
    if (val && typeof val === "object" && "seconds" in val && "nanoseconds" in val) {
      return 8;
    }
    if (Array.isArray(val)) {
      let arraySize = 0;
      val.forEach(member => {
        arraySize += calculateValueSize(member);
      });
      return arraySize;
    }
    if (typeof val === "object") {
      // Map size: 32 bytes + sum of key-value pairs
      let mapSize = 32;
      for (const key in val) {
        if (Object.prototype.hasOwnProperty.call(val, key)) {
          const keySize = new TextEncoder().encode(key).length + 1;
          mapSize += keySize + calculateValueSize(val[key]);
        }
      }
      return mapSize;
    }
    return 0;
  }

  // Calculate fields size (excluding the client-only 'id' attribute)
  for (const key in item) {
    if (Object.prototype.hasOwnProperty.call(item, key) && key !== "id") {
      const keySize = new TextEncoder().encode(key).length + 1;
      totalBytes += keySize + calculateValueSize(item[key]);
    }
  }

  return totalBytes;
}

// Get metrics about current database storage utilization
export async function getStorageMetrics() {
  try {
    const patients = await getAllItems("patients");
    const visits = await getAllItems("visits");
    const archives = await getAllItems("archived_records").catch(() => []);
    const queue = await getAllItems("queue");
    const registry = await getAllItems("registry").catch(() => []);
    
    // Group active/warm visits
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - 180); // 6 months active limit
    
    let activeVisitsCount = 0;
    let warmVisitsCount = 0;
    
    visits.forEach(v => {
      const vDate = new Date(v.visitDate);
      if (vDate >= thresholdDate) {
        activeVisitsCount++;
      } else {
        warmVisitsCount++;
      }
    });
    
    // Calculate 100% accurate size in bytes based on official Firestore formula
    let totalBytes = 0;
    patients.forEach(p => { totalBytes += calculateFirestoreDocSize(p, "patients", p.id); });
    visits.forEach(v => { totalBytes += calculateFirestoreDocSize(v, "visits", v.id); });
    archives.forEach(a => { totalBytes += calculateFirestoreDocSize(a, "archived_records", a.id); });
    queue.forEach(q => { totalBytes += calculateFirestoreDocSize(q, "queue", q.id); });
    registry.forEach(r => { totalBytes += calculateFirestoreDocSize(r, "registry", r.id); });
    
    return {
      totalPatients: patients.length,
      activeVisits: activeVisitsCount,
      warmVisits: warmVisitsCount,
      archivedVisits: archives.length,
      queueItems: queue.length,
      totalBytes
    };
  } catch (err) {
    console.error("Error getting storage metrics:", err);
    return null;
  }
}
