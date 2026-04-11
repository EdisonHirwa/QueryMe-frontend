import axiosInstance from './axiosInstance';
import { unwrapResponse } from './helpers';
import type { QuerySubmissionPayload, QuerySubmissionResponse } from '../types/queryme';

export const queryApi = {
  async submitQuery(payload: QuerySubmissionPayload, signal?: AbortSignal): Promise<QuerySubmissionResponse> {
    const response = await axiosInstance.post<QuerySubmissionResponse>('/query/submit', payload, { signal });
    return unwrapResponse(response);
  },
};
