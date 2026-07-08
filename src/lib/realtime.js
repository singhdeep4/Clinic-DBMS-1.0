// Lightweight Firestore real-time listeners helper
export function startRealtimeListeners(onChange) {
  // onChange(storeName, docsArray)
  const unsubscribers = [];
  import("firebase/firestore").then(({ collection, onSnapshot }) => {
    import("./firebase.js").then(({ db: fdb }) => {
      const stores = ["patients", "visits", "queue", "archived_records", "registry"];
      for (const storeName of stores) {
        try {
          const colRef = collection(fdb, storeName);
          const unsub = onSnapshot(colRef, (snapshot) => {
            const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            try { onChange(storeName, docs); } catch (e) { console.error("onChange handler error:", e); }
          }, (err) => console.error(`Realtime listener error for ${storeName}:`, err));
          unsubscribers.push(unsub);
        } catch (err) {
          console.error(`Failed to start listener for ${storeName}:`, err);
        }
      }
    }).catch(err => console.error("Failed to import firebase.js for realtime:", err));
  }).catch(err => console.error("Failed to import firebase/firestore for realtime:", err));

  return () => {
    for (const u of unsubscribers) {
      try { u(); } catch (e) {}
    }
  };
}
