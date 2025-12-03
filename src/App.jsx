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
import Header from "./components/Header";
import Product2 from "./pages/Product2";
import Login from "./pages/Login";
import { isAuthenticated } from "./auth";


function App() {
  // In App.jsx
const [authChecked, setAuthChecked] = useState(false);

// Use it in the component or in effects
useEffect(() => {
  // This effect will run when authChecked changes
}, [authChecked]);

  const RequireAuth = ({ children }) => {
    const location = useLocation();
    if (isAuthenticated()) {
      return children;
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  };

  // Add effect to listen for auth changes
  useEffect(() => {
    const handleAuthChange = () => {
      setAuthChecked(prev => !prev); // Toggle to force re-render
    };

    window.addEventListener('storage', handleAuthChange);
    return () => {
      window.removeEventListener('storage', handleAuthChange);
    };
  }, []);

  return (
    <Router>
      <div style={{ display: "flex" }}>
        <Sidebar />
        <div style={{ marginLeft: "240px", padding: "0", width: "100%" }}>
          <Header />
          <div style={{ padding: "20px" }}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/"
                element={
                  <RequireAuth>
                    <Dashboard />
                  </RequireAuth>
                }
              />
              <Route
                path="/product"
                element={
                  <RequireAuth>
                    <Product />
                  </RequireAuth>
                }
              />
              <Route
                path="/product2"
                element={
                  <RequireAuth>
                    <Product2 />
                  </RequireAuth>
                }
              />
              <Route
                path="/pos"
                element={
                  <RequireAuth>
                    <POS />
                  </RequireAuth>
                }
              />
              <Route
                path="/receipt"
                element={
                  <RequireAuth>
                    <Receipt />
                  </RequireAuth>
                }
              />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
}

export default App;