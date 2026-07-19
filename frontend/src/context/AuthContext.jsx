import { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [role, setRole] = useState(localStorage.getItem("role"));
  const [identity, setIdentity] = useState(localStorage.getItem("identity"));

  const login = (accessToken, userRole, userIdentity) => {
    localStorage.setItem("token", accessToken);
    localStorage.setItem("role", userRole);
    localStorage.setItem("identity", userIdentity);
    setToken(accessToken);
    setRole(userRole);
    setIdentity(userIdentity);
  };

  const logout = () => {
    localStorage.clear();
    setToken(null);
    setRole(null);
    setIdentity(null);
  };

  return (
    <AuthContext.Provider value={{ token, role, identity, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
