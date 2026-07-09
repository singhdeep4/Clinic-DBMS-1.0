const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore } = require("firebase-admin/firestore");
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = getFirestore();

/**
 * Scheduled Cloud Function (Runs at 00:00 on the 1st of every month)
 * Prunes patient visits older than 180 days (6 months) to save cloud storage space.
 * Crucially, it preserves the single latest visit for each patient even if it is older than 6 months.
 */
exports.pruneOldVisits = onSchedule("0 0 1 * *", async () => {
  const now = new Date();
  // 180 days in milliseconds
  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
  const sixMonthsAgoStr = sixMonthsAgo.toISOString();

  console.log(`[Ayurkaya Cleanup] Starting monthly visit pruning. Checking records older than ${sixMonthsAgoStr}...`);

  try {
    // 1. Fetch all visits older than 6 months
    const oldVisitsSnapshot = await db.collection("visits")
      .where("visitDate", "<", sixMonthsAgoStr)
      .get();

    if (oldVisitsSnapshot.empty) {
      console.log("[Ayurkaya Cleanup] No visits older than 6 months found.");
      return null;
    }

    console.log(`[Ayurkaya Cleanup] Found ${oldVisitsSnapshot.size} visit records older than 6 months.`);

    // Group the matches by patientId to handle them per patient
    const patientVisitsMap = {};
    oldVisitsSnapshot.forEach((doc) => {
      const data = doc.data();
      const pId = data.patientId;
      if (pId) {
        if (!patientVisitsMap[pId]) {
          patientVisitsMap[pId] = [];
        }
        patientVisitsMap[pId].push({ id: doc.id, ...data });
      }
    });

    const batch = db.batch();
    let deleteCount = 0;

    // 2. Loop through each patient's visits to check latest visit exception
    for (const patientId of Object.keys(patientVisitsMap)) {
      // Query the absolute latest visit for this patient from the entire database
      const latestSnapshot = await db.collection("visits")
        .where("patientId", "==", patientId)
        .orderBy("visitDate", "desc")
        .limit(1)
        .get();

      if (latestSnapshot.empty) continue;
      
      const latestVisitDoc = latestSnapshot.docs[0];
      const latestVisitId = latestVisitDoc.id;

      // Queue all old visits for deletion, excluding the latest one
      const oldVisits = patientVisitsMap[patientId];
      oldVisits.forEach((visit) => {
        if (visit.id !== latestVisitId) {
          const docRef = db.collection("visits").doc(visit.id);
          batch.delete(docRef);
          deleteCount++;
        }
      });
    }

    // 3. Commit deletions in batch
    if (deleteCount > 0) {
      await batch.commit();
      console.log(`[Ayurkaya Cleanup] Successfully deleted ${deleteCount} historical visits.`);
    } else {
      console.log("[Ayurkaya Cleanup] All old visits were the latest visits. No records deleted.");
    }

  } catch (err) {
    console.error("[Ayurkaya Cleanup] Error during monthly visit pruning job:", err);
  }

  return null;
});

/**
 * Scheduled Cloud Function (Runs every 2 weeks)
 * Cleans up old visit history for patients who haven't visited in 6+ months (180 days)
 * Preserves the absolute latest visit per patient + patient basic info
 */
exports.cleanupMissedVisits = onSchedule("every 2 weeks", async () => {
  const now = new Date();
  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
  const sixMonthsAgoStr = sixMonthsAgo.toISOString();

  console.log(`[Cleanup] Starting missed visits cleanup. Checking for patients with no visits since ${sixMonthsAgoStr}...`);

  try {
    // 1. Get all patients
    const patientsSnap = await db.collection("patients").get();
    console.log(`[Cleanup] Found ${patientsSnap.size} total patients`);

    let deletedVisitsCount = 0;
    let cleanedPatientsCount = 0;

    for (const patientDoc of patientsSnap.docs) {
      const patient = patientDoc.data();
      const patientId = patientDoc.id;

      // Get the absolute latest visit for this patient
      const latestVisitSnap = await db
        .collection("visits")
        .where("patientId", "==", patientId)
        .orderBy("visitDate", "desc")
        .limit(1)
        .get();

      if (latestVisitSnap.empty) {
        continue;
      }

      const latestVisit = latestVisitSnap.docs[0].data();
      const latestVisitId = latestVisitSnap.docs[0].id;
      const latestVisitDate = new Date(latestVisit.visitDate);

      // Check if patient hasn't visited in 6+ months
      if (latestVisitDate < sixMonthsAgo) {
        console.log(
          `[Cleanup] Patient ${patientId} (${patient.name || "Unknown"}) - last visit: ${latestVisitDate.toDateString()}, cleaning old visit history...`
        );

        // Get all visits for this patient
        const allVisitsSnap = await db
          .collection("visits")
          .where("patientId", "==", patientId)
          .get();

        // Delete all visits EXCEPT the latest one
        const batch = db.batch();
        for (const visitDoc of allVisitsSnap.docs) {
          if (visitDoc.id !== latestVisitId) {
            batch.delete(visitDoc.ref);
            deletedVisitsCount++;
          }
        }
        await batch.commit();

        // Update patient record to mark cleanup
        await db.collection("patients").doc(patientId).update({
          lastCleanupDate: admin.firestore.FieldValue.serverTimestamp(),
          lastVisitKept: latestVisitDate,
        });

        cleanedPatientsCount++;
      }
    }

    console.log(
      `[Cleanup] Completed: Cleaned ${cleanedPatientsCount} patients, deleted ${deletedVisitsCount} old visit records (kept latest visit for each)`
    );
    return { success: true, cleanedPatients: cleanedPatientsCount, deletedVisits: deletedVisitsCount };
  } catch (err) {
    console.error("[Cleanup] Error during missed visits cleanup:", err);
    throw err;
  }
});
