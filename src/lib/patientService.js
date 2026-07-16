import { getAllItems } from "./db.js";

// Check if a patient already exists with the same phone and DOB
export async function findDuplicatePatient(mobile, dob) {
  if (!mobile || !dob) return null;
  const cleanMobile = mobile.replace(/[^0-9]/g, "");
  
  try {
    const { collection, getDocs, query, where } = await import("firebase/firestore");
    const { db: fdb } = await import("./firebase.js");

    const q = query(
      collection(fdb, "patients"),
      where("mobile", "==", cleanMobile),
      where("dateOfBirth", "==", dob)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    }
    return null;
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

// Fetch patient details by Firebase Auth UID
export async function getPatientByUid(uid) {
  if (!uid) return null;
  try {
    const { collection, getDocs, query, where } = await import("firebase/firestore");
    const { db: fdb } = await import("./firebase.js");

    const q = query(collection(fdb, "patients"), where("uid", "==", uid));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return { patientId: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    }
    return null;
  } catch (err) {
    console.error("Error fetching patient by uid:", err);
    return null;
  }
}

// Link an existing patient document to a Firebase Auth UID
export async function linkPatientToUid(patientId, uid, email) {
  if (!patientId || !uid) return false;
  try {
    const { doc, updateDoc } = await import("firebase/firestore");
    const { db: fdb } = await import("./firebase.js");

    const patientRef = doc(fdb, "patients", patientId);
    await updateDoc(patientRef, {
      uid: uid,
      email: email,
      linkedAt: new Date().toISOString()
    });
    return true;
  } catch (err) {
    console.error("Error linking patient to uid:", err);
    return false;
  }
}

// Verify if an email is an authorized doctor
export async function isDoctorAuthorized(email) {
  if (!email) return false;
  try {
    const { collection, getDocs, query, where } = await import("firebase/firestore");
    const { db: fdb } = await import("./firebase.js");

    const q = query(collection(fdb, "doctors"), where("email", "==", email.toLowerCase().trim()));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (err) {
    console.error("Error checking doctor authorization:", err);
    return false;
  }
}

// Seed doctor accounts into Firestore if none exist
export async function seedDoctorsIfEmpty() {
  try {
    const { doc, setDoc, getDoc } = await import("firebase/firestore");
    const { db: fdb } = await import("./firebase.js");

    const defaults = ["drneha@ayurkaya.com", "deep2006deep@gmail.com"];
    for (const email of defaults) {
      const cleanEmail = email.toLowerCase().trim();
      const docRef = doc(fdb, "doctors", cleanEmail);
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        await setDoc(docRef, {
          email: cleanEmail,
          role: "doctor",
          createdAt: new Date().toISOString()
        });
        console.log(`Seeded default doctor account in Firestore: ${cleanEmail}`);
      }
    }
  } catch (err) {
    console.error("Error seeding doctors:", err);
  }
}


// Fetch all patient profiles linked to a Firebase Auth UID
export async function getPatientsByUid(uid) {
  if (!uid) return [];
  try {
    const { collection, getDocs, query, where } = await import("firebase/firestore");
    const { db: fdb } = await import("./firebase.js");

    const q = query(collection(fdb, "patients"), where("uid", "==", uid));
    const snapshot = await getDocs(q);
    const list = [];
    snapshot.forEach((docSnap) => {
      list.push({ patientId: docSnap.id, ...docSnap.data() });
    });
    return list;
  } catch (err) {
    console.error("Error fetching patients by uid:", err);
    return [];
  }
}

// Link an existing family member record by setting its uid
export async function linkFamilyMemberToUid(patientId, uid, relation) {
  if (!patientId || !uid) return false;
  try {
    const { doc, updateDoc } = await import("firebase/firestore");
    const { db: fdb } = await import("./firebase.js");

    const patientRef = doc(fdb, "patients", patientId);
    await updateDoc(patientRef, {
      uid: uid,
      relation: relation || "Family Member",
      linkedAt: new Date().toISOString()
    });
    return true;
  } catch (err) {
    console.error("Error linking family member to uid:", err);
    return false;
  }
}
