const accounts = [
  { username: "admin@inventory.com", password: "Boypaint8526", name: "Admin" },
  { username: "staff@inventory.com", password: "paintstaff90", name: "User" },
];

export function login(username, password) {
  const user = accounts.find(
    (a) => a.username === username && a.password === password
  );
  if (user) {
    const userData = { username: user.username, name: user.name };
    sessionStorage.setItem("authUser", JSON.stringify(userData));
    // Trigger storage event to notify other tabs/windows
    window.dispatchEvent(new Event("storage"));
    return true;
  }
  return false;
}

export function logout() {
  sessionStorage.removeItem("authUser");
  // Trigger storage event to notify other tabs/windows
  window.dispatchEvent(new Event("storage"));
}

export function isAuthenticated() {
  return !!sessionStorage.getItem("authUser");
}

export function getUser() {
  const u = sessionStorage.getItem("authUser");
  return u ? JSON.parse(u) : null;
}

export default { login, logout, isAuthenticated, getUser };