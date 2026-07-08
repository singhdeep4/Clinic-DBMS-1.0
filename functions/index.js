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
exports.pruneOldVisits = onSchedule("0 0 1 * *", async (event) => {
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
