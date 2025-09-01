// components/UserContext.js
import { createContext, useState, useContext, useEffect } from 'react';

const UserContext = createContext(null);

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar sesión al iniciar
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedAuth = localStorage.getItem('isAuthenticated');
    
    if (storedUser && storedAuth === 'true') {
      setUser(JSON.parse(storedUser));
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const authenticateWithCode = async (type, codigo, email = null) => {
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, codigo, email })
      });

      const result = await response.json();

      if (response.ok) {
        if (result.user) {
          // Login directo (admin o usuario específico)
          setUser(result.user);
          setIsAuthenticated(true);
          localStorage.setItem('user', JSON.stringify(result.user));
          localStorage.setItem('isAuthenticated', 'true');
          return { success: true, user: result.user };
        } else if (result.requiresUserSelection) {
          // Código del sistema correcto, requiere selección de usuario
          setIsAuthenticated(true);
          localStorage.setItem('isAuthenticated', 'true');
          return { success: true, requiresUserSelection: true };
        }
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      return { success: false, error: 'Error de conexión' };
    }
  };

  // Mantener compatibilidad con código existente
  const authenticateWithPassword = async (password) => {
    const result = await authenticateWithCode('sistema', password);
    return result.success && result.requiresUserSelection;
  };

  const login = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('isAuthenticated', 'true');
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('user');
    localStorage.removeItem('isAuthenticated');
  };

  return (
    <UserContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoading,
      login, 
      logout, 
      authenticateWithPassword, // Mantener compatibilidad
      authenticateWithCode // Nueva función
    }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  return useContext(UserContext);
};
