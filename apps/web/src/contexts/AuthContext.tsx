import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  areaId?: string | null;
  area?: { id: string; name: string } | null;
  preferredClientIds: string[];
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  loginWithToken: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  updatePreferredClients: (clientIds: string[]) => Promise<void>;
  updateUserArea: (areaId: string, role?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = api.getToken();
    if (token) {
      api.getMe()
        .then((result) => setUser(result.user))
        .catch(() => api.setToken(null))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const result = await api.login(email, password);
    setUser(result.user);
  };

  const register = async (name: string, email: string, password: string) => {
    const result = await api.register({ name, email, password });
    setUser(result.user);
  };

  const loginWithToken = async (token: string) => {
    const result = await api.loginWithToken(token);
    setUser(result.user);
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  const updatePreferredClients = async (clientIds: string[]) => {
    const result = await api.updateMe({ preferredClientIds: clientIds });
    setUser(result.user);
  };

  const updateUserArea = async (areaId: string, role?: string) => {
    const result = await api.updateMe({ areaId, role });
    setUser(result.user);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithToken, logout, updatePreferredClients, updateUserArea }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
