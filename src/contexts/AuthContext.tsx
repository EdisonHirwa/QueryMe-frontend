import React, { useState, ReactNode } from 'react';
import { AuthContext } from './AuthContextContext';

export type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT' | 'GUEST';

export interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  signup: (name: string, email: string, password: string, role?: UserRole) => Promise<void>;
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
}

interface AuthApiResponse {
  token: string;
  user: User;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
const LOGIN_ENDPOINT = import.meta.env.VITE_AUTH_LOGIN_ENDPOINT ?? '/api/auth/login';
const SIGNUP_ENDPOINT = import.meta.env.VITE_AUTH_SIGNUP_ENDPOINT ?? '/api/auth/signup';

const requestAuth = async (endpoint: string, payload: Record<string, unknown>): Promise<AuthApiResponse> => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  let data: Partial<AuthApiResponse> & { message?: string } = {};
  try {
    data = (await response.json()) as Partial<AuthApiResponse> & { message?: string };
  } catch {
    // Ignore JSON parsing errors so we can still throw a consistent error below.
  }

  if (!response.ok) {
    throw new Error(data.message || 'Authentication request failed');
  }

  if (!data.user || !data.token) {
    throw new Error('Invalid authentication response');
  }

  return {
    user: data.user,
    token: data.token,
  };
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('queryme_user');
    if (stored) {
      try {
        return JSON.parse(stored) as User;
      } catch {
        localStorage.removeItem('queryme_user');
        return null;
      }
    }
    return null;
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return user !== null;
  });

  const login = async (email: string, password: string) => {
    const result = await requestAuth(LOGIN_ENDPOINT, { email, password });
    localStorage.setItem('queryme_user', JSON.stringify(result.user));
    localStorage.setItem('token', result.token);
    setUser(result.user);
    setIsAuthenticated(true);
  };

  const signup = async (name: string, email: string, password: string, role: UserRole = 'STUDENT') => {
    const result = await requestAuth(SIGNUP_ENDPOINT, { name, email, password, role });
    localStorage.setItem('queryme_user', JSON.stringify(result.user));
    localStorage.setItem('token', result.token);
    setUser(result.user);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem('queryme_user');
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <AuthContext value={{ isAuthenticated, user, login, logout, signup }}>
      {children}
    </AuthContext>
  );
};
