import type { AuthSessionUser } from '../types/queryme';

export const AUTH_TOKEN_KEY = 'qm_token';
export const AUTH_USER_KEY = 'qm_user';
export const AUTH_STORAGE_KEY = 'qm_auth_storage';
export const REMEMBERED_EMAIL_KEY = 'rememberedEmail';

const LEGACY_TOKEN_KEYS = ['token'];
const LEGACY_USER_KEYS = ['queryme_user'];

export type AuthStorageMode = 'local' | 'session';

const allStorages = () => [localStorage, sessionStorage];

const getStorage = (mode: AuthStorageMode) => (mode === 'local' ? localStorage : sessionStorage);

const parseJson = <T>(value: string | null): T | null => {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

export const getStoredUser = (): AuthSessionUser | null => {
  for (const storage of allStorages()) {
    const user = parseJson<AuthSessionUser>(storage.getItem(AUTH_USER_KEY));
    if (user) {
      return user;
    }
  }

  for (const storage of allStorages()) {
    const legacyUser = parseJson<AuthSessionUser>(storage.getItem(LEGACY_USER_KEYS[0]));
    if (legacyUser) {
      return legacyUser;
    }
  }

  return null;
};

export const getStoredToken = (): string | null => {
  for (const storage of allStorages()) {
    const token = storage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      return token;
    }
  }

  for (const key of LEGACY_TOKEN_KEYS) {
    for (const storage of allStorages()) {
      const token = storage.getItem(key);
      if (token) {
        return token;
      }
    }
  }

  return null;
};

export const getStoredAuthMode = (): AuthStorageMode => {
  if (localStorage.getItem(AUTH_TOKEN_KEY)) {
    return 'local';
  }

  if (sessionStorage.getItem(AUTH_TOKEN_KEY)) {
    return 'session';
  }

  const storedMode = localStorage.getItem(AUTH_STORAGE_KEY);
  return storedMode === 'local' ? 'local' : 'session';
};

export const clearAuthState = (): void => {
  for (const storage of allStorages()) {
    storage.removeItem(AUTH_TOKEN_KEY);
    storage.removeItem(AUTH_USER_KEY);

    for (const key of LEGACY_TOKEN_KEYS) {
      storage.removeItem(key);
    }

    for (const key of LEGACY_USER_KEYS) {
      storage.removeItem(key);
    }
  }

  localStorage.removeItem(AUTH_STORAGE_KEY);
};

export const saveAuthState = (token: string, user: AuthSessionUser, remember: boolean): void => {
  const mode: AuthStorageMode = remember ? 'local' : 'session';
  const storage = getStorage(mode);

  clearAuthState();
  storage.setItem(AUTH_TOKEN_KEY, token);
  storage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  localStorage.setItem(AUTH_STORAGE_KEY, mode);
};

export const updateStoredUser = (user: AuthSessionUser): void => {
  const mode = getStoredAuthMode();
  const storage = getStorage(mode);
  storage.setItem(AUTH_USER_KEY, JSON.stringify(user));
};

export const getRememberedEmail = (): string => localStorage.getItem(REMEMBERED_EMAIL_KEY) || '';

export const setRememberedEmail = (email: string): void => {
  localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
};

export const clearRememberedEmail = (): void => {
  localStorage.removeItem(REMEMBERED_EMAIL_KEY);
};
