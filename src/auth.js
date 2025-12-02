const accounts = [
  { username: "admin", password: "admin123", name: "Admin" },
  { username: "user", password: "user123", name: "User" },
];

export function login(username, password) {
  const user = accounts.find(
    (a) => a.username === username && a.password === password
  );
  if (user) {
    sessionStorage.setItem(
      "authUser",
      JSON.stringify({ username: user.username, name: user.name })
    );
    return true;
  }
  return false;
}

export function logout() {
  sessionStorage.removeItem("authUser");
}

export function isAuthenticated() {
  return !!sessionStorage.getItem("authUser");
}

export function getUser() {
  const u = sessionStorage.getItem("authUser");
  return u ? JSON.parse(u) : null;
}

export default { login, logout, isAuthenticated, getUser };
