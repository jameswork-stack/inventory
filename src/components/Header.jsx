import "../styles/header.css";
import { getUser, logout, isAuthenticated } from "../auth";
import { useNavigate } from "react-router-dom";
import logo from "/images/logo.png";

const Header = () => {
  const navigate = useNavigate();
  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const user = isAuthenticated() ? getUser() : null;

  return (
    <header className="header">
      <img src={logo} alt="Logo" style={{ height: "40px", marginRight: "12px" }} />
      <h1>Boy Paint Center Inventory</h1>
      <div style={{ marginLeft: "auto" }}>
        {user ? (
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span>Welcome, {user.name}</span>
            <button onClick={handleLogout}>Logout</button>
          </div>
        ) : null}
      </div>
    </header>
  );
};

export default Header;
