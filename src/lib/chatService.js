import { 
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, 
  query, where, orderBy, onSnapshot, serverTimestamp 
} from "firebase/firestore";
import { db as fdb } from "./firebase.js";

const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;

// Subscribe to real-time messages for a specific patient chat
export function subscribeToPatientChat(patientId, callback) {
  if (!patientId) return () => {};

  const messagesRef = collection(fdb, "chats", patientId, "messages");
  
  // Trigger cleanup check in background
  cleanupExpiredMessages(patientId).catch(err => {
    console.error("Error running 15-day message cleanup:", err);
  });

  const unsub = onSnapshot(messagesRef, (snapshot) => {
    const msgs = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));

    // Filter locally in case cleanup is pending, and sort chronologically
    const now = Date.now();
    const validMsgs = msgs.filter(m => {
      if (m.type === "prescription") return true; // Prescriptions never expire!
      if (!m.createdAt) return true;
      const msgTime = new Date(m.createdAt).getTime();
      return (now - msgTime) <= FIFTEEN_DAYS_MS;
    });

    validMsgs.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    callback(validMsgs);
  }, (err) => {
    console.error(`Error subscribing to chat for ${patientId}:`, err);
  });

  return unsub;
}

// Delete text messages older than 15 days (Prescriptions are preserved!)
export async function cleanupExpiredMessages(patientId) {
  if (!patientId) return;
  try {
    const messagesRef = collection(fdb, "chats", patientId, "messages");
    const snapshot = await getDocs(messagesRef);
    const now = Date.now();
    const deletePromises = [];

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      // NEVER delete prescriptions
      if (data.type === "prescription") return;

      if (data.createdAt) {
        const msgTime = new Date(data.createdAt).getTime();
        if ((now - msgTime) > FIFTEEN_DAYS_MS) {
          deletePromises.push(deleteDoc(doc(fdb, "chats", patientId, "messages", docSnap.id)));
        }
      }
    });

    if (deletePromises.length > 0) {
      await Promise.all(deletePromises);
      console.log(`[ChatService] Cleaned up ${deletePromises.length} expired chat messages for patient ${patientId}`);
    }
  } catch (err) {
    console.error("Failed to cleanup expired chat messages:", err);
  }
}

// Send a chat message (Patient or Doctor)
export async function sendChatMessage(patientId, patientName, senderRole, senderName, text, extra = {}) {
  if (!patientId || (!text && !extra.prescriptionData)) return false;

  const nowIso = new Date().toISOString();
  const roomRef = doc(fdb, "chats", patientId);

  // 1. Ensure room metadata exists / is updated
  await setDoc(roomRef, {
    patientId: patientId,
    patientName: patientName || "Patient",
    lastMessage: text || (extra.type === "prescription" ? "📋 Prescription Issued" : ""),
    lastSenderRole: senderRole,
    lastSenderName: senderName,
    updatedAt: nowIso,
    hasUnreadDoctor: senderRole === "patient",
    hasUnreadPatient: senderRole === "doctor"
  }, { merge: true });

  // 2. Add message document
  const messagesRef = collection(fdb, "chats", patientId, "messages");
  const msgDoc = {
    patientId,
    senderRole, // "patient" | "doctor"
    senderName,
    text: text || "",
    type: extra.type || "text", // "text" | "prescription"
    prescriptionData: extra.prescriptionData || null,
    createdAt: nowIso
  };

  await addDoc(messagesRef, msgDoc);
  return true;
}

// Save a prescription to database AND post to chat feed
export async function saveAndSendPrescription(patientId, patientName, doctorName, prescriptionDetails) {
  if (!patientId) return null;

  const rxId = "RX-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
  const nowIso = new Date().toISOString();

  const prescriptionRecord = {
    prescriptionId: rxId,
    patientId: patientId,
    patientName: patientName || "Patient",
    doctorName: doctorName || "Doctor",
    diagnosis: prescriptionDetails.diagnosis || "",
    medicines: prescriptionDetails.medicines || [],
    notes: prescriptionDetails.notes || "",
    createdAt: nowIso,
    status: "Prescribed"
  };

  // 1. Permanently save to `prescriptions` collection
  await setDoc(doc(fdb, "prescriptions", rxId), prescriptionRecord);

  // 2. Post as a permanent prescription card message in chat
  await sendChatMessage(
    patientId,
    patientName,
    "doctor",
    doctorName,
    `📋 Prescription issued on ${new Date().toLocaleDateString("en-IN")}`,
    {
      type: "prescription",
      prescriptionData: prescriptionRecord
    }
  );

  return prescriptionRecord;
}

// Fetch all historical prescriptions for a list of patient IDs (supports family profiles)
export async function getPrescriptionHistory(patientIds) {
  if (!patientIds || (Array.isArray(patientIds) && patientIds.length === 0)) return [];
  const ids = Array.isArray(patientIds) ? patientIds : [patientIds];

  try {
    const rxRef = collection(fdb, "prescriptions");
    const snapshot = await getDocs(rxRef);
    const results = [];

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (ids.includes(data.patientId)) {
        results.push({ id: docSnap.id, ...data });
      }
    });

    results.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return results;
  } catch (err) {
    console.error("Error fetching prescription history:", err);
    return [];
  }
}

// Subscribe to all chat rooms for Doctor Dashboard
export function subscribeToAllChatRooms(callback) {
  const chatsRef = collection(fdb, "chats");
  return onSnapshot(chatsRef, (snapshot) => {
    const rooms = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    rooms.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    callback(rooms);
  }, (err) => {
    console.error("Error subscribing to all chat rooms:", err);
  });
}

// Mark room as read for doctor
export async function markChatReadByDoctor(patientId) {
  if (!patientId) return;
  try {
    await updateDoc(doc(fdb, "chats", patientId), {
      hasUnreadDoctor: false
    });
  } catch (e) {
    // Ignore update error if doc doesn't exist yet
  }
}

// Mark room as read for patient
export async function markChatReadByPatient(patientId) {
  if (!patientId) return;
  try {
    await updateDoc(doc(fdb, "chats", patientId), {
      hasUnreadPatient: false
    });
  } catch (e) {
    // Ignore
  }
}
