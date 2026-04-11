import axiosInstance from './axiosInstance';
import { unwrapResponse } from './helpers';
import type { StudentExamResult, TeacherResultRow } from '../types/queryme';

export const resultApi = {
  async getSessionResult(sessionId: string, signal?: AbortSignal): Promise<StudentExamResult> {
    const response = await axiosInstance.get<StudentExamResult>(`/results/session/${sessionId}`, { signal });
    return unwrapResponse(response);
  },

  async getExamDashboard(examId: string, signal?: AbortSignal): Promise<TeacherResultRow[]> {
    const response = await axiosInstance.get<TeacherResultRow[]>(`/results/exam/${examId}/dashboard`, { signal });
    return unwrapResponse(response);
  },
};
