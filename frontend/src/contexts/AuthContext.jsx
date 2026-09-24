import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authApi from '../api/authApi';
import { SEED_PERSONAS } from '../constants/personas';

const AuthContext = createContext(null);
export { SEED_PERSONAS };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('ef_token'));
  const [loading, setLoading] = useState(true);

  // Initialize and verify existing token
  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      const storedToken = localStorage.getItem('ef_token');
      if (!storedToken) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const response = await authApi.getMe();
        if (isMounted) {
          setUser(response.user);
        }
      } catch (err) {
        console.warn('Session expired or invalid token:', err.message);
        localStorage.removeItem('ef_token');
        if (isMounted) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    checkAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const result = await authApi.login({ email, password });
      localStorage.setItem('ef_token', result.token);
      setToken(result.token);
      setUser(result.user);
      return result.user;
    } finally {
      setLoading(false);
    }
  }, []);

  const loginAsSeed = useCallback(async (roleKey) => {
    const persona = SEED_PERSONAS.find((p) => p.roleKey === roleKey) || SEED_PERSONAS[0];
    return login(persona.email, 'Password123!');
  }, [login]);

  const register = useCallback(async (userData) => {
    setLoading(true);
    try {
      const result = await authApi.register(userData);
      localStorage.setItem('ef_token', result.token);
      setToken(result.token);
      setUser(result.user);
      return result.user;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('ef_token');
    setToken(null);
    setUser(null);
  }, []);

  const isPlatformAdmin = user?.globalRole === 'platform_admin';
  const isOrganizer = isPlatformAdmin || user?.email?.includes('organizer') || user?.email?.includes('owner');
  const isStaff = isPlatformAdmin || isOrganizer || user?.email?.includes('staff');

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        loginAsSeed,
        register,
        logout,
        isAuthenticated: !!user,
        isPlatformAdmin,
        isOrganizer,
        isStaff,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
