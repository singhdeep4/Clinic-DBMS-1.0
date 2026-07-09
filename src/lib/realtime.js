// Lightweight Firestore real-time listeners helper
export function startRealtimeListeners(onChange) {
  // onChange(storeName, docsArray)
  const unsubscribers = [];
  console.log("[Realtime] Starting Firestore listeners...");
  
  import("firebase/firestore").then(({ collection, onSnapshot }) => {
    import("./firebase.js").then(({ db: fdb }) => {
      const stores = ["patients", "visits", "queue", "archived_records", "registry"];
      for (const storeName of stores) {
        try {
          const colRef = collection(fdb, storeName);
          const unsub = onSnapshot(colRef, (snapshot) => {
            const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            console.log(`[Realtime] ${storeName} updated: ${docs.length} docs`);
            try { onChange(storeName, docs); } catch (e) { console.error("onChange handler error:", e); }
          }, (err) => console.error(`[Realtime] Listener error for ${storeName}:`, err));
          unsubscribers.push(unsub);
          console.log(`[Realtime] Listener started for ${storeName}`);
        } catch (err) {
          console.error(`[Realtime] Failed to start listener for ${storeName}:`, err);
        }
      }
    }).catch(err => console.error("[Realtime] Failed to import firebase.js:", err));
  }).catch(err => console.error("[Realtime] Failed to import firebase/firestore:", err));

  return () => {
    console.log("[Realtime] Unsubscribing all listeners...");
    for (const u of unsubscribers) {
      try { u(); } catch {
        // Ignore unsubscribe error
      }
    }
  };
}
