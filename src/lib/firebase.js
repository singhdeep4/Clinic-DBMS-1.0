import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Ayurkaya-DBMS Firebase Web Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCwRpolAxApLT5VMH_jz2UKciCBh1pQ6cg",
  authDomain: "ayurkaya-dbms.firebaseapp.com",
  projectId: "ayurkaya-dbms",
  storageBucket: "ayurkaya-dbms.firebasestorage.app",
  messagingSenderId: "515755632183",
  appId: "1:515755632183:web:810ae828278e0d9fba01b2",
  measurementId: "G-KH486E7E69"
};

// Initialize Firebase Client
const app = initializeApp(firebaseConfig);

// Export Services
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
