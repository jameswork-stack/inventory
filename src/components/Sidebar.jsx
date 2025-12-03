import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import "../styles/sidebar.css";
import { getUser } from "../auth";  // Removed isAuthenticated

const Sidebar = () => {
  const [user, setUser] = useState(() => getUser());

  // Add effect to listen for authentication changes
  useEffect(() => {
    const handleAuthChange = () => {
      setUser(getUser());
    };

    // Listen for storage events to detect login/logout
    window.addEventListener('storage', handleAuthChange);
    
    // Initial check
    handleAuthChange();

    return () => {
      window.removeEventListener('storage', handleAuthChange);
    };
  }, []);

  const showDashboard = user && user.username === "admin@inventory.com";

  return (
    <div className="sidebar">
      <nav className="nav-links">
        {showDashboard && (
          <NavLink 
            to="/" 
            end 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">📊</span>
            <span className="nav-label">Dashboard</span>
          </NavLink>
        )}

        <NavLink 
          to="/product" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon">🎨</span>
          <span className="nav-label">Paint</span>
        </NavLink>

        <NavLink 
          to="/product2" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon">🛠️</span>
          <span className="nav-label">Tools</span>
        </NavLink>

        <NavLink 
          to="/pos" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon">💳</span>
          <span className="nav-label">POS</span>
        </NavLink>

        <NavLink 
          to="/receipt" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon">📋</span>
          <span className="nav-label">Receipt</span>
        </NavLink>
      </nav>
    </div>
  );
};

export default Sidebar;