import { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/Pos";
import Product from "./pages/Product";
import Receipt from "./pages/Receipt";
import Expense from "./pages/Expense";
import Header from "./components/Header";
import Product2 from "./pages/Product2";
import Login from "./pages/Login";
import { isAuthenticated } from "./auth";

function RequireAuth({ children, location }) {
  if (isAuthenticated()) {
    return children;
  }

  return <Navigate to="/login" state={{ from: location }} replace />;
}

function AppContent() {
  const location = useLocation();

  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const handleAuthChange = () => {
      setAuthChecked((prev) => !prev);
    };

    window.addEventListener("storage", handleAuthChange);

    return () => {
      window.removeEventListener("storage", handleAuthChange);
    };
  }, []);

  return (
    <div>
      {location.pathname !== "/login" && <Sidebar />}

      <div>
        {location.pathname !== "/login" && <Header />}

        <div style={{ padding: "20px" }}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <RequireAuth location={location}>
                  <Dashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/product"
              element={
                <RequireAuth location={location}>
                  <Product />
                </RequireAuth>
              }
            />

            <Route
              path="/product2"
              element={
                <RequireAuth location={location}>
                  <Product2 />
                </RequireAuth>
              }
            />

            <Route
              path="/pos"
              element={
                <RequireAuth location={location}>
                  <POS />
                </RequireAuth>
              }
            />

            <Route
              path="/receipt"
              element={
                <RequireAuth location={location}>
                  <Receipt />
                </RequireAuth>
              }
            />

            <Route
              path="/expense"
              element={
                <RequireAuth location={location}>
                  <Expense />
                </RequireAuth>
              }
            />
          </Routes>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;