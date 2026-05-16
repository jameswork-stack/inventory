import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/login.css";
import { login } from "../auth";
import logo from "/images/logo.png";


const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || "/";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      setLoading(true);
      const success = await login(username.trim(), password);
      if (success) {
        navigate(from, { replace: true });
      } else {
        setError("Invalid email or password");
      }
    } catch (err) {
      setError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit}>
        <img src={logo} alt="logo" />
        {error && <div className="error">{error}</div>}
        <label>Username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="username"
          autoFocus
        />
        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="password"
        />
        <button type="submit" disabled={loading}>
          {loading ? (
            <>
              <span className="btn-spinner" /> Logging in...
            </>
          ) : (
            "Login"
          )}
        </button>
      </form>
    </div>
  );
};

export default Login;
