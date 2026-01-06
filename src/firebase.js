import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBxZsV0-nxrGnr4xHGDWjBno67tNYzDWo8",
  authDomain: "paint-inventory-46003.firebaseapp.com",
  databaseURL: "https://paint-inventory-46003-default-rtdb.asia-southeast1.firebasedatabase.app", // ✅ NEW DB URL
  projectId: "paint-inventory-46003",
  storageBucket: "paint-inventory-46003.firebasestorage.app",
  messagingSenderId: "404843464620",
  appId: "1:404843464620:web:817c9ef49d70f863d45c09",
  measurementId: "G-GX2N6RTNT5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Realtime Database
export const db = getDatabase(app);

// (Optional) Analytics – only works in browser
export const analytics = getAnalytics(app);
