import { getAllItems } from "./db.js";
import { collection, getDocs, query, where, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db as fdb, auth } from "./firebase.js";

// Check if a patient already exists with the same phone and DOB
export async function findDuplicatePatient(mobile, dob) {
  if (!mobile || !dob) return null;
  const cleanMobile = mobile.replace(/[^0-9]/g, "");
  
  try {
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

    for (let i = 1; i <= maxNum; i++) {
      if (!nums.has(i)) {
        return `PAT-${String(i).padStart(8, "0")}`;
      }
    }

    return `PAT-${String(maxNum + 1).padStart(8, "0")}`;
  } catch (err) {
    console.error("Error generating sequential patient ID:", err);
    return "PAT-" + Math.floor(10000000 + Math.random() * 90000000);
  }
}

// Fetch patient details by Firebase Auth UID
export async function getPatientByUid(uid) {
  if (!uid) return null;
  try {
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
  if (!email) return null;
  try {
    const cleanEmail = email.toLowerCase().trim();
    // 1. Try to read by document ID (which might be the email)
    const docRef = doc(fdb, "doctors", cleanEmail);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() };
    }

    // 2. Fallback to query by email field (for older numeric doc IDs)
    const q = query(collection(fdb, "doctors"), where("email", "==", cleanEmail));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    }
    return null;
  } catch (err) {
    console.error("Error checking doctor authorization:", err);
    return null;
  }
}



// Fetch all patient profiles sharing a familyId associated with a Firebase Auth UID
export async function getPatientsByUid(uid, email = null) {
  if (!uid) return [];
  try {
    // Step 1: Find the patient profile linked to this login UID
    const q = query(collection(fdb, "patients"), where("uid", "==", uid));
    const snapshot = await getDocs(q);
    let primaryProfile = null;
    if (!snapshot.empty) {
      primaryProfile = { patientId: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    }

    // Fallback: check by email if no profile matched UID
    if (!primaryProfile) {
      const targetEmail = email || auth.currentUser?.email;
      if (targetEmail) {
        const cleanEmail = targetEmail.toLowerCase().trim();
        const eq = query(collection(fdb, "patients"), where("email", "==", cleanEmail));
        const emailSnapshot = await getDocs(eq);
        if (!emailSnapshot.empty) {
          const firstDoc = emailSnapshot.docs[0];
          const patientId = firstDoc.id;
          const patientRef = doc(fdb, "patients", patientId);
          const patientData = firstDoc.data();
          
          // Auto-link UID and save
          await updateDoc(patientRef, {
            uid: uid,
            relation: "Self"
          });
          primaryProfile = { patientId, ...patientData, uid: uid, relation: "Self" };
          console.log(`Auto-linked email ${cleanEmail} to UID ${uid}`);
        }
      }
    }

    if (!primaryProfile) {
      return [];
    }

    // Ensure primaryProfile has a familyId initialized
    let familyId = primaryProfile.familyId;
    if (!familyId) {
      familyId = "FAMID-" + primaryProfile.patientId.replace("PAT-", "");
      const patientRef = doc(fdb, "patients", primaryProfile.patientId);
      await updateDoc(patientRef, { familyId: familyId });
      primaryProfile.familyId = familyId;
    }

    // Step 2: Query all profiles sharing this familyId
    const familyQuery = query(collection(fdb, "patients"), where("familyId", "==", familyId));
    const familySnapshot = await getDocs(familyQuery);
    const list = [];
    familySnapshot.forEach((docSnap) => {
      list.push({ patientId: docSnap.id, ...docSnap.data() });
    });

    // Ensure all family members have a familyCode
    for (const p of list) {
      if (!p.familyCode) {
        const newCode = "FAM-" + Math.random().toString(36).substring(2, 8).toUpperCase();
        const patientRef = doc(fdb, "patients", p.patientId);
        await updateDoc(patientRef, { familyCode: newCode });
        p.familyCode = newCode;
      }
    }

    return list;
  } catch (err) {
    console.error("Error fetching patients by uid/familyId:", err);
    return [];
  }
}

// Link an existing family member record by setting its uid
export async function linkFamilyMemberToUid(patientId, uid, relation) {
  if (!patientId || !uid) return false;
  try {
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

// Time-based rotating hash generator (TOTP signature)
export function getRotatingHash(patientId, offsetBlocks = 0) {
  if (!patientId) return "";
  const timeBlock = Math.floor(Date.now() / 30000) + offsetBlocks;
  const str = patientId + "_" + timeBlock + "_ayurkayaSalt1008";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let sig = "";
  let val = Math.abs(hash);
  for (let i = 0; i < 4; i++) {
    sig += chars[val % chars.length];
    val = Math.floor(val / chars.length);
  }
  return sig;
}

// Link an existing family member record by its rotating familyCode
export async function linkPatientByFamilyCode(enteredCode, uid, relation) {
  if (!enteredCode || !uid) return false;
  try {
    const cleanCode = enteredCode.trim().toUpperCase();
    const parts = cleanCode.split("-");
    if (parts.length !== 3 || parts[0] !== "FAM" || !parts[1] || !parts[2]) {
      throw new Error("Invalid Link Code format. Code must be like FAM-00000001-A4B9");
    }

    const patientNum = parts[1];
    const enteredHash = parts[2];
    const targetPatientId = `PAT-${patientNum}`;

    // 1. Fetch target patient record
    const targetRef = doc(fdb, "patients", targetPatientId);
    const targetSnap = await getDoc(targetRef);
    if (!targetSnap.exists()) {
      throw new Error("No profile found matching the ID in the link code.");
    }
    const targetPatient = targetSnap.data();

    // 2. Validate rotating signature (check current and previous 30s blocks for latency)
    const expectedCurrent = getRotatingHash(targetPatientId, 0);
    const expectedPrevious = getRotatingHash(targetPatientId, -1);
    
    if (enteredHash !== expectedCurrent && enteredHash !== expectedPrevious) {
      throw new Error("This Family Link Code has expired. Please copy the fresh code and try again.");
    }

    // 3. Retrieve linking user's profile to copy their familyId
    const linkingUserQuery = query(collection(fdb, "patients"), where("uid", "==", uid));
    const linkingUserSnapshot = await getDocs(linkingUserQuery);
    if (linkingUserSnapshot.empty) {
      throw new Error("Your primary account profile is missing. Please sign up or contact admin.");
    }
    
    const linkingProfileDoc = linkingUserSnapshot.docs[0];
    const linkingProfile = linkingProfileDoc.data();
    
    let currentFamilyId = linkingProfile.familyId;
    if (!currentFamilyId) {
      currentFamilyId = "FAMID-" + linkingProfileDoc.id.replace("PAT-", "");
      await updateDoc(doc(fdb, "patients", linkingProfileDoc.id), { familyId: currentFamilyId });
    }

    // 4. Update the target profile's familyId to link them under the same family
    await updateDoc(targetRef, {
      familyId: currentFamilyId,
      relation: relation || "Family Member",
      linkedAt: new Date().toISOString()
    });

    return { patientId: targetPatientId, ...targetPatient, familyId: currentFamilyId, relation: relation || "Family Member" };
  } catch (err) {
    console.error("Error linking patient by family code:", err);
    throw err;
  }
}

// Unlink a family member into an independent standalone profile (Preserves all medical data)
export async function unlinkFamilyMember(memberPatientId) {
  if (!memberPatientId) return false;
  try {
    const memberRef = doc(fdb, "patients", memberPatientId);
    const snap = await getDoc(memberRef);
    if (!snap.exists()) {
      throw new Error("Patient profile not found.");
    }

    const newSoloFamilyId = "FAMID-" + memberPatientId.replace("PAT-", "") + "-SOLO-" + Math.floor(Math.random() * 1000);

    // Update patient record: set new standalone familyId, set relation to Self, and clear parent UID link
    await updateDoc(memberRef, {
      familyId: newSoloFamilyId,
      relation: "Self",
      isPrimary: true,
      uid: "",
      unlinkedAt: new Date().toISOString()
    });

    return true;
  } catch (err) {
    console.error("Error unlinking family member:", err);
    throw err;
  }
}
