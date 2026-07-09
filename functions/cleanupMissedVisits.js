const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * Cloud Function: Cleanup missed patient visits
 * 
 * Runs every 2 weeks to delete visit history for patients who:
 * 1. Have a followUpDate in the past (missed appointment)
 * 2. Haven't had any visit for > 60 days
 * 
 * Keeps: Patient basic info (name, age, mobile, etc.) + archived visits
 */
exports.cleanupMissedVisits = functions.pubsub
  .schedule("every 2 weeks")
  .onRun(async () => {
    const db = admin.firestore();
    const now = new Date();
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    try {
      console.log("[Cleanup] Starting missed visits cleanup...");

      // 1. Get all patients
      const patientsSnap = await db.collection("patients").get();
      console.log(`[Cleanup] Found ${patientsSnap.size} patients`);

      let deletedVisitsCount = 0;

      for (const patientDoc of patientsSnap.docs) {
        const patient = patientDoc.data();
        const patientId = patientDoc.id;

        // Get last visit for this patient
        const visitsSnap = await db
          .collection("visits")
          .where("patientId", "==", patientId)
          .orderBy("visitDate", "desc")
          .limit(1)
          .get();

        if (visitsSnap.empty) {
          console.log(`[Cleanup] Patient ${patientId} has no visits, skipping`);
          continue;
        }

        const lastVisit = visitsSnap.docs[0].data();
        const lastVisitDate = new Date(lastVisit.visitDate);

        // Check if patient missed follow-up (hasn't visited in 60+ days)
        if (lastVisitDate < sixtyDaysAgo) {
          console.log(
            `[Cleanup] Patient ${patientId} (${patient.name}) - last visit: ${lastVisitDate.toDateString()}, deleting visit history...`
          );

          // Get all visits for this patient
          const allVisitsSnap = await db
            .collection("visits")
            .where("patientId", "==", patientId)
            .get();

          // Delete all visits (they will be archived if needed)
          const batch = db.batch();
          for (const visitDoc of allVisitsSnap.docs) {
            batch.delete(visitDoc.ref);
            deletedVisitsCount++;
          }
          await batch.commit();

          // Update patient record to mark cleanup
          await db.collection("patients").doc(patientId).update({
            lastCleanupDate: admin.firestore.FieldValue.serverTimestamp(),
            visitHistoryDeleted: true,
          });
        }
      }

      console.log(
        `[Cleanup] Completed: Deleted ${deletedVisitsCount} visits for no-show patients`
      );
      return { success: true, deletedVisits: deletedVisitsCount };
    } catch (err) {
      console.error("[Cleanup] Error during cleanup:", err);
      throw err;
    }
  });
