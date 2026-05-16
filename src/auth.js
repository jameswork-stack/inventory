import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { ref, get, set } from "firebase/database";
import { auth, db } from "./firebase";

// Initialize auth state listener
let currentUser = null;
let userRole = null;

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    // Fetch user role from database
    const roleRef = ref(db, `users/${user.uid}/role`);
    const snapshot = await get(roleRef);
    userRole = snapshot.exists() ? snapshot.val() : "user";
    
    // Store in sessionStorage for persistence
    const userData = {
      uid: user.uid,
      email: user.email,
      name: user.displayName || user.email,
      role: userRole
    };
    sessionStorage.setItem("authUser", JSON.stringify(userData));
  } else {
    userRole = null;
    sessionStorage.removeItem("authUser");
  }
  // Trigger storage event to notify other tabs/windows
  window.dispatchEvent(new Event("storage"));
});

export async function login(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Check if user has a role in database, if not set default
    const roleRef = ref(db, `users/${user.uid}/role`);
    const snapshot = await get(roleRef);
    
    if (!snapshot.exists()) {
      // Set default role for new users
      await set(roleRef, "user");
      userRole = "user";
    } else {
      userRole = snapshot.val();
    }
    
    return true;
  } catch (error) {
    console.error("Login error:", error);
    return false;
  }
}

export async function logout() {
  try {
    await signOut(auth);
    return true;
  } catch (error) {
    console.error("Logout error:", error);
    return false;
  }
}

export function isAuthenticated() {
  return !!currentUser;
}

export function getUser() {
  if (!currentUser) return null;
  const u = sessionStorage.getItem("authUser");
  return u ? JSON.parse(u) : null;
}

export function getUserRole() {
  return userRole;
}

export function isAdmin() {
  return userRole === "admin";
}

export default { login, logout, isAuthenticated, getUser, getUserRole, isAdmin };