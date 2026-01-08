// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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
const analytics = getAnalytics(app);