import axiosInstance from './axiosInstance';
import { toBackendUserPayload, unwrapResponse } from './helpers';
import type { AuthResponse, SignupPayload } from '../types/queryme';

export const authApi = {
  async signIn(email: string, password: string, signal?: AbortSignal): Promise<AuthResponse> {
    const response = await axiosInstance.post<AuthResponse>('/auth/signin', { email, password }, { signal });
    return unwrapResponse(response);
  },

  async signUp(payload: SignupPayload, signal?: AbortSignal): Promise<unknown> {
    const response = await axiosInstance.post('/auth/signup', { ...toBackendUserPayload(payload), role: 'STUDENT' }, { signal });
    return unwrapResponse(response);
  },
};
