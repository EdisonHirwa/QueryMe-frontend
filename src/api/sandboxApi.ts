import axiosInstance from './axiosInstance';
import { unwrapResponse } from './helpers';
import type { SandboxInfo } from '../types/queryme';

export const sandboxApi = {
  async provisionSandbox(examId: string, studentId: string, signal?: AbortSignal): Promise<SandboxInfo> {
    const response = await axiosInstance.post<SandboxInfo>('/sandboxes/provision', { examId, studentId }, { signal });
    return unwrapResponse(response);
  },

  async getSandbox(examId: string, studentId: string, signal?: AbortSignal): Promise<SandboxInfo> {
    const response = await axiosInstance.get<SandboxInfo>(`/sandboxes/${examId}/students/${studentId}`, { signal });
    return unwrapResponse(response);
  },

  async deleteSandbox(examId: string, studentId: string, signal?: AbortSignal): Promise<void> {
    const response = await axiosInstance.delete<void>(`/sandboxes/${examId}/students/${studentId}`, { signal });
    return unwrapResponse(response);
  },
};
