import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCwRpolAxApLT5VMH_jz2UKciCBh1pQ6cg",
  authDomain: "ayurkaya-dbms.firebaseapp.com",
  projectId: "ayurkaya-dbms",
  storageBucket: "ayurkaya-dbms.firebasestorage.app",
  messagingSenderId: "515755632183",
  appId: "1:515755632183:web:810ae828278e0d9fba01b2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkPatients() {
  try {
    console.log("Querying all patients in Firestore...");
    const snapshot = await getDocs(collection(db, "patients"));
    console.log(`Found ${snapshot.size} patients total.`);
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      console.log(`Document ID: ${docSnap.id} | Name: ${data.name} | UID: ${data.uid} | familyId: ${data.familyId} | mobile: ${data.mobile} | Relation: ${data.relation}`);
    });
  } catch (err) {
    console.error("Error querying patients:", err);
  }
}

checkPatients();
