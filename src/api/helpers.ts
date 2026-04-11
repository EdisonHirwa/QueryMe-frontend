import type { AxiosResponse } from 'axios';
import type { ApiResponse } from '../types/queryme';

const isApiResponse = <T>(value: unknown): value is ApiResponse<T> => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return 'data' in value && ('success' in value || 'message' in value || 'timestamp' in value);
};

export const unwrapResponse = <T>(response: AxiosResponse<ApiResponse<T> | T>): T => {
  const payload = response.data;
  return isApiResponse<T>(payload) ? payload.data : (payload as T);
};

type BackendUserPayload = {
  fullName?: string;
  name?: string;
};

export const toBackendUserPayload = <T extends BackendUserPayload>(payload: T): Record<string, unknown> => {
  const { name, fullName, ...rest } = payload;
  const normalizedFullName = typeof fullName === 'string' && fullName.trim()
    ? fullName.trim()
    : typeof name === 'string' && name.trim()
      ? name.trim()
      : undefined;

  return normalizedFullName
    ? { ...rest, fullName: normalizedFullName }
    : rest;
};
