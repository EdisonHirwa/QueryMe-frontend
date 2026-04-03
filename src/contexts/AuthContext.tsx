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
  id: string | number;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
}

interface SignInApiResponse {
  token: string;
  type?: string;
  id: string;
  email: string;
  roles: string[];
}

interface SignUpApiResponse {
  message: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
const LOGIN_ENDPOINT = import.meta.env.VITE_AUTH_LOGIN_ENDPOINT ?? '/api/auth/signin';
const SIGNUP_ENDPOINT = import.meta.env.VITE_AUTH_SIGNUP_ENDPOINT ?? '/api/auth/signup';

async function requestAuth<T>(endpoint: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  let data: Partial<T> & { message?: string } = {};
  try {
    data = (await response.json()) as Partial<T> & { message?: string };
  } catch {
    // Ignore JSON parsing errors so we can still throw a consistent error below.
  }

  if (!response.ok) {
    throw new Error(data.message || 'Authentication request failed');
  }

  return data as T;
}

const getRoleFromAuthorities = (roles: string[]): UserRole => {
  const role = roles[0] ?? 'STUDENT';
  const normalized = role.toUpperCase();
  if (normalized === 'ADMIN' || normalized === 'TEACHER' || normalized === 'STUDENT' || normalized === 'GUEST') {
    return normalized;
  }
  return 'STUDENT';
};

const mapSignInResponseToUser = (data: SignInApiResponse): User => {
  return {
    id: data.id,
    email: data.email,
    name: data.email.split('@')[0],
    role: getRoleFromAuthorities(data.roles),
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
    const result = await requestAuth<SignInApiResponse>(LOGIN_ENDPOINT, { email, password });
    if (!result.token || !result.email || !result.id || !result.roles) {
      throw new Error('Invalid authentication response');
    }

    const mappedUser = mapSignInResponseToUser(result);
    localStorage.setItem('queryme_user', JSON.stringify(mappedUser));
    localStorage.setItem('token', result.token);
    setUser(mappedUser);
    setIsAuthenticated(true);
  };

  const signup = async (_name: string, email: string, password: string, role: UserRole = 'STUDENT') => {
    await requestAuth<SignUpApiResponse>(SIGNUP_ENDPOINT, { email, password, role });
    await login(email, password);
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
