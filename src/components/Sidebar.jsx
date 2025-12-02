import { NavLink } from "react-router-dom";
import "../styles/sidebar.css";

const Sidebar = () => {
  return (
    <div className="sidebar">

      <nav className="nav-links">
        <NavLink to="/" end className="nav-item">
          <span className="nav-icon">📊</span>
          <span className="nav-label">Dashboard</span>
        </NavLink>

        <NavLink to="/product" className="nav-item">
          <span className="nav-icon">🎨</span>
          <span className="nav-label">Paint</span>
        </NavLink>

        <NavLink to="/product2" className="nav-item">
          <span className="nav-icon">🛠️</span>
          <span className="nav-label">Tools</span>
        </NavLink>

        <NavLink to="/pos" className="nav-item">
          <span className="nav-icon">💳</span>
          <span className="nav-label">POS</span>
        </NavLink>

        <NavLink to="/receipt" className="nav-item">
          <span className="nav-icon">📋</span>
          <span className="nav-label">Receipt</span>
        </NavLink>
      </nav>
    </div>
  );
};

export default Sidebar;
