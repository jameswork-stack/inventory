import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyANLKNcrj4JNTyO-xhDY-wVczLUqwe0Ch8",
  authDomain: "inventory-7bce6.firebaseapp.com",
  databaseURL: "https://inventory-7bce6-default-rtdb.asia-southeast1.firebasedatabase.app", // 👈 ADD THIS
  projectId: "inventory-7bce6",
  storageBucket: "inventory-7bce6.firebasestorage.app",
  messagingSenderId: "176504896456",
  appId: "1:176504896456:web:86c1f7b61ac02508135efd",
  measurementId: "G-WK9VS36NLR"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
