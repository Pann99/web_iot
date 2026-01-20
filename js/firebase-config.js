// ===============================
// FIREBASE CONFIGURATION
// ===============================
// Import Firebase modules from CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase configuration object
const firebaseConfig = {
  apiKey: "AIzaSyAiocwIqUr6fulkqJPyib2uq4vEJfYbjU8",
  authDomain: "monitoringtanah-4b61a.firebaseapp.com",
  projectId: "monitoringtanah-4b61a",
  storageBucket: "monitoringtanah-4b61a.firebasestorage.app",
  messagingSenderId: "167540095624",
  appId: "1:167540095624:web:3063bfae6e5727a67a7d3d",
  measurementId: "G-3XPWX8ZC4G"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
const auth = getAuth(app);

// Initialize Cloud Firestore
const db = getFirestore(app);

// Export for use in other modules
export { auth, db };