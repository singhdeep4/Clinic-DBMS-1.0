// NOTE: This project now uses Firestore as the primary and only persistent store.
// Legacy IndexedDB initialization and migration helpers were removed as part of
// the cloud-only migration. If you need offline/local features in future,
// reintroduce an initDB() implementation and migration helpers here.

export async function getAllItems(storeName) {
  try {
    const { collection, getDocs } = await import("firebase/firestore");
    const { db: fdb } = await import("./firebase.js");
    const querySnapshot = await getDocs(collection(fdb, storeName));
    return querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (err) {
    console.error("Firestore getAllItems error:", err);
    return [];
  }
}

export async function putItem(storeName, item) {
  try {
    const { doc, setDoc } = await import("firebase/firestore");
    const { db: fdb } = await import("./firebase.js");

    let docId = null;
    if (storeName === "patients") docId = item.patientId;
    else if (storeName === "visits") docId = item.visitId;
    else if (storeName === "queue") docId = String(item.id || item.queueId || Date.now());
    else if (storeName === "archived_records") docId = String(item.archiveId || item.id || Date.now());
    else if (storeName === "cases") docId = item.patientId || String(Date.now());
    else if (storeName === "registry") docId = item.patientId || String(Date.now());

    if (!docId) {
      docId = String(Date.now());
    }

    await setDoc(doc(fdb, storeName, docId), JSON.parse(JSON.stringify(item)));
    return { ...item, id: docId };
  } catch (err) {
    console.error("Firestore putItem error:", err);
    throw err;
  }
}

export async function deleteItem(storeName, key) {
  try {
    const { doc, deleteDoc, getDoc } = await import("firebase/firestore");
    const { db: fdb } = await import("./firebase.js");
    const docId = String(key);

    console.log(`[db.deleteItem] Attempting delete: store=${storeName} id=${docId}`);

    // Check if document exists before deleting to aid debugging
    try {
      const docRef = doc(fdb, storeName, docId);
      const snapshot = await getDoc(docRef);
      if (!snapshot.exists()) {
        console.warn(`[db.deleteItem] Document not found: ${storeName}/${docId}`);
      } else {
        console.log(`[db.deleteItem] Document exists. Deleting now: ${storeName}/${docId}`);
      }
      await deleteDoc(docRef);
      console.log(`[db.deleteItem] Delete completed: ${storeName}/${docId}`);
    } catch (innerErr) {
      console.error(`[db.deleteItem] Error deleting ${storeName}/${docId}:`, innerErr);
      throw innerErr;
    }
  } catch (err) {
    console.error("Firestore deleteItem error:", err);
    throw err;
  }
}

// Cloud-only mode: no local IndexedDB synchronization is required
export async function syncFromCloud() {
  console.log("Direct Firestore mode enabled; no local sync required.");
  return true;
}

export async function clearStore(storeName) {
  try {
    const { collection, getDocs, deleteDoc, doc } = await import("firebase/firestore");
    const { db: fdb } = await import("./firebase.js");
    const querySnapshot = await getDocs(collection(fdb, storeName));
    const deletes = querySnapshot.docs.map((docSnap) => deleteDoc(doc(fdb, storeName, docSnap.id)));
    await Promise.all(deletes);
  } catch (err) {
    console.error("Firestore clearStore error:", err);
    throw err;
  }
}

// Migration helpers removed — project is cloud-only
