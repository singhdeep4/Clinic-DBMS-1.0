import { db } from "../src/lib/firebase.js";
import { getPatientsByUid } from "../src/lib/patientService.js";

async function runTest() {
  try {
    const userUid = "vUKcZemIeIOwDLdQg2skm9sQaEQ2";
    const userEmail = "1032240403@tcetmumbai.in";
    console.log(`Running getPatientsByUid for UID: ${userUid}, Email: ${userEmail}...`);
    
    const list = await getPatientsByUid(userUid, userEmail);
    console.log(`Result list length: ${list.length}`);
    list.forEach(p => {
      console.log(`- PatientId: ${p.patientId} | Name: ${p.name} | UID: ${p.uid} | familyId: ${p.familyId} | Relation: ${p.relation}`);
    });
  } catch (err) {
    console.error("Test failed:", err);
  }
}

runTest();
