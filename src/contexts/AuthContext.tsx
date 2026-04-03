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
  token?: string;
  accessToken?: string;
  access_token?: string;
  jwt?: string;
  jwtToken?: string;
  bearerToken?: string;
  type?: string;
  id?: string;
  userId?: string;
  user_id?: string;
  email?: string;
  username?: string;
  userEmail?: string;
  name?: string;
  fullName?: string;
  roles?: string[];
  role?: string;
  userRole?: string;
  authorities?: string[];
  data?: Partial<SignInApiResponse>;
}

interface SignUpApiResponse {
  message: string;
}

interface UserProfileResponse {
  id?: string;
  userId?: string;
  email?: string;
  username?: string;
  name?: string;
  fullName?: string;
  role?: string;
  userRole?: string;
  roles?: string[];
  authorities?: string[];
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
const LOGIN_ENDPOINT = import.meta.env.VITE_AUTH_LOGIN_ENDPOINT ?? '/api/auth/signin';
const SIGNUP_ENDPOINT = import.meta.env.VITE_AUTH_SIGNUP_ENDPOINT ?? '/api/auth/signup';
const PROFILE_ENDPOINT = import.meta.env.VITE_AUTH_PROFILE_ENDPOINT ?? '/api/users/me';

function parseJsonPayload<T>(raw: string): T | null {
  const text = raw.trim();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const candidate = text.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(candidate) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function requestAuth<T>(endpoint: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const rawBody = await response.text();
  const data: Partial<T> & { message?: string } =
    parseJsonPayload<Partial<T> & { message?: string }>(rawBody) ?? {};

  if (!response.ok) {
    throw new Error(data.message || 'Authentication request failed');
  }

  return data as T;
}

const normalizeRole = (value: unknown): UserRole | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.toUpperCase().replace(/^ROLE_/, '');
  if (normalized === 'ADMIN' || normalized === 'TEACHER' || normalized === 'STUDENT' || normalized === 'GUEST') {
    return normalized;
  }
  return null;
};

const getRoleFromAuthorities = (roles: unknown[]): UserRole => {
  const first = roles[0];
  const fromString = normalizeRole(first);
  if (fromString) {
    return fromString;
  }

  if (first && typeof first === 'object') {
    const maybeAuthority = (first as { authority?: unknown }).authority;
    const fromAuthority = normalizeRole(maybeAuthority);
    if (fromAuthority) {
      return fromAuthority;
    }
  }

  return 'STUDENT';
};

const pickString = (data: SignInApiResponse, keys: Array<keyof SignInApiResponse>): string => {
  for (const key of keys) {
    const topLevelValue = data[key];
    if (typeof topLevelValue === 'string' && topLevelValue.trim().length > 0) {
      return topLevelValue;
    }
  }

  if (data.data) {
    for (const key of keys) {
      const nestedValue = data.data[key];
      if (typeof nestedValue === 'string' && nestedValue.trim().length > 0) {
        return nestedValue;
      }
    }
  }

  return '';
};

const getTokenFromResponse = (data: SignInApiResponse): string => {
  return pickString(data, ['token', 'accessToken', 'access_token', 'jwt', 'jwtToken', 'bearerToken']);
};

const getEmailFromResponse = (data: SignInApiResponse): string => {
  return pickString(data, ['email', 'username', 'userEmail']);
};

const getNameFromResponse = (data: SignInApiResponse, fallbackEmail: string): string => {
  const name = pickString(data, ['name', 'fullName']);
  if (name) {
    return name;
  }
  return fallbackEmail.includes('@') ? fallbackEmail.split('@')[0] : fallbackEmail;
};

const getIdFromResponse = (data: SignInApiResponse): string => {
  return pickString(data, ['id', 'userId', 'user_id']);
};

const getRolesFromResponse = (data: SignInApiResponse): unknown[] => {
  if (Array.isArray(data.roles) && data.roles.length > 0) {
    return data.roles;
  }
  if (Array.isArray(data.authorities) && data.authorities.length > 0) {
    return data.authorities;
  }
  if (data.data && Array.isArray(data.data.roles) && data.data.roles.length > 0) {
    return data.data.roles;
  }
  if (data.data && Array.isArray(data.data.authorities) && data.data.authorities.length > 0) {
    return data.data.authorities;
  }
  if (data.role) {
    return [data.role];
  }
  if (data.userRole) {
    return [data.userRole];
  }
  if (data.data?.role) {
    return [data.data.role];
  }
  if (data.data?.userRole) {
    return [data.data.userRole];
  }
  return ['STUDENT'];
};

const getRolesFromProfile = (profile: UserProfileResponse): unknown[] => {
  if (Array.isArray(profile.roles) && profile.roles.length > 0) {
    return profile.roles;
  }
  if (Array.isArray(profile.authorities) && profile.authorities.length > 0) {
    return profile.authorities;
  }
  if (profile.role) {
    return [profile.role];
  }
  if (profile.userRole) {
    return [profile.userRole];
  }
  return ['STUDENT'];
};

const getProfileIdentity = (profile: UserProfileResponse) => {
  const profileId = typeof profile.id === 'string' && profile.id ? profile.id : profile.userId ?? '';
  const profileEmail =
    typeof profile.email === 'string' && profile.email
      ? profile.email
      : typeof profile.username === 'string'
        ? profile.username
        : '';
  const profileName =
    typeof profile.name === 'string' && profile.name
      ? profile.name
      : typeof profile.fullName === 'string'
        ? profile.fullName
        : '';
  return { profileId, profileEmail, profileName };
};

async function fetchUserProfile(token: string): Promise<UserProfileResponse> {
  const response = await fetch(`${API_BASE_URL}${PROFILE_ENDPOINT}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const rawBody = await response.text();
  const data: UserProfileResponse & { message?: string } =
    parseJsonPayload<UserProfileResponse & { message?: string }>(rawBody) ?? {};

  if (!response.ok) {
    const message = (data as { message?: string }).message;
    throw new Error(message || 'Unable to load user profile after login');
  }

  return data as UserProfileResponse;
}

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
    const token = getTokenFromResponse(result);

    if (!token) {
      throw new Error('Invalid authentication response');
    }

    let resolvedId = getIdFromResponse(result);
    let resolvedEmail = getEmailFromResponse(result);
    let resolvedName = getNameFromResponse(result, resolvedEmail || email);
    let resolvedRoles = getRolesFromResponse(result);

    if (!resolvedId || !resolvedEmail) {
      const profile = await fetchUserProfile(token);
      const { profileId, profileEmail, profileName } = getProfileIdentity(profile);

      if (!resolvedId) {
        resolvedId = profileId;
      }
      if (!resolvedEmail) {
        resolvedEmail = profileEmail;
      }
      if (!resolvedName || resolvedName === email.split('@')[0]) {
        resolvedName = profileName || getNameFromResponse(result, resolvedEmail || email);
      }
      resolvedRoles = getRolesFromProfile(profile);
    }

    if (!resolvedId || !resolvedEmail) {
      throw new Error('Invalid authentication response');
    }

    const mappedUser: User = {
      id: resolvedId,
      email: resolvedEmail,
      name: resolvedName || (resolvedEmail.includes('@') ? resolvedEmail.split('@')[0] : resolvedEmail),
      role: getRoleFromAuthorities(resolvedRoles),
    };

    localStorage.setItem('queryme_user', JSON.stringify(mappedUser));
    localStorage.setItem('token', token);
    setUser(mappedUser);
    setIsAuthenticated(true);
  };

  const signup = async (name: string, email: string, password: string, role: UserRole = 'STUDENT') => {
    await requestAuth<SignUpApiResponse>(SIGNUP_ENDPOINT, { name, email, password, role });
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
