import { initDB, putItem, getAllItems, deleteItem } from "./db.js";

const ARCHIVE_THRESHOLD_DAYS = 365; // 1 year retention policy as requested

// Run archival sweep for visits older than 1 year
export async function runArchivalSweep() {
  try {
    const db = await initDB();
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
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("archived_records", "readonly");
      const store = transaction.objectStore("archived_records");
      const index = store.index("patientId");
      const request = index.getAll(patientId);
      
      request.onsuccess = () => {
        // Map to return the original visit records with the archive wrap details
        const results = (request.result || []).map(archive => ({
          ...archive.data,
          archiveId: archive.archiveId,
          archivedAt: archive.archivedAt,
          archivedReason: archive.archivedReason
        })).sort((a, b) => new Date(b.visitDate || 0) - new Date(a.visitDate || 0));
        
        resolve(results);
      };
      
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Error fetching patient archived visits:", err);
    return [];
  }
}

// Restore a previously archived visit back to the visits table
export async function restoreArchivedVisit(archiveId) {
  if (!archiveId) return { success: false, error: "No archiveId provided" };
  
  try {
    const db = await initDB();
    
    // 1. Find archived record
    const archiveRecord = await new Promise((resolve, reject) => {
      const transaction = db.transaction("archived_records", "readonly");
      const store = transaction.objectStore("archived_records");
      const request = store.get(archiveId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
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

// Get metrics about current database storage utilization
export async function getStorageMetrics() {
  try {
    const patients = await getAllItems("patients");
    const visits = await getAllItems("visits");
    const archives = await getAllItems("archived_records").catch(() => []);
    const queue = await getAllItems("queue");
    
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
    
    return {
      totalPatients: patients.length,
      activeVisits: activeVisitsCount,
      warmVisits: warmVisitsCount,
      archivedVisits: archives.length,
      queueItems: queue.length
    };
  } catch (err) {
    console.error("Error getting storage metrics:", err);
    return null;
  }
}
