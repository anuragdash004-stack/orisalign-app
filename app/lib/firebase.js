import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAfvKUCjEcz99n80v0-OJn3kLKMocL7ku4",
  authDomain: "orisalign.firebaseapp.com",
  projectId: "orisalign",
  storageBucket: "orisalign.appspot.com", // ✅ FIXED
  messagingSenderId: "50910477086",
  appId: "1:50910477086:web:35531f74e0b4f7ed02270f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Services
export const auth = getAuth(app);
export const db = getFirestore(app);