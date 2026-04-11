import axiosInstance from './axiosInstance';
import { unwrapResponse } from './helpers';
import type {
  ClassGroup,
  Course,
  CourseEnrollment,
  CourseEnrollmentPayload,
  CreateClassGroupPayload,
  CreateCoursePayload,
} from '../types/queryme';

export const courseApi = {
  async getCourses(signal?: AbortSignal): Promise<Course[]> {
    const response = await axiosInstance.get<Course[]>('/courses', { signal });
    return unwrapResponse(response);
  },

  async createCourse(payload: CreateCoursePayload, signal?: AbortSignal): Promise<Course> {
    const response = await axiosInstance.post<Course>('/courses', payload, { signal });
    return unwrapResponse(response);
  },

  async getClassGroups(signal?: AbortSignal): Promise<ClassGroup[]> {
    const response = await axiosInstance.get<ClassGroup[]>('/class-groups', { signal });
    return unwrapResponse(response);
  },

  async getClassGroupsByCourse(courseId: string, signal?: AbortSignal): Promise<ClassGroup[]> {
    const response = await axiosInstance.get<ClassGroup[]>(`/class-groups/course/${courseId}`, { signal });
    return unwrapResponse(response);
  },

  async createClassGroup(payload: CreateClassGroupPayload, signal?: AbortSignal): Promise<ClassGroup> {
    const response = await axiosInstance.post<ClassGroup>('/class-groups', payload, { signal });
    return unwrapResponse(response);
  },

  async getEnrollments(signal?: AbortSignal): Promise<CourseEnrollment[]> {
    const response = await axiosInstance.get<CourseEnrollment[]>('/course-enrollments', { signal });
    return unwrapResponse(response);
  },

  async getEnrollmentsByCourse(courseId: string, signal?: AbortSignal): Promise<CourseEnrollment[]> {
    const response = await axiosInstance.get<CourseEnrollment[]>(`/course-enrollments/course/${courseId}`, { signal });
    return unwrapResponse(response);
  },

  async getEnrollmentsByStudent(studentId: string, signal?: AbortSignal): Promise<CourseEnrollment[]> {
    const response = await axiosInstance.get<CourseEnrollment[]>(`/course-enrollments/student/${studentId}`, { signal });
    return unwrapResponse(response);
  },

  async createEnrollment(payload: CourseEnrollmentPayload, signal?: AbortSignal): Promise<CourseEnrollment> {
    const response = await axiosInstance.post<CourseEnrollment>('/course-enrollments', payload, { signal });
    return unwrapResponse(response);
  },

  async deleteEnrollment(payload: CourseEnrollmentPayload, signal?: AbortSignal): Promise<void> {
    const response = await axiosInstance.delete<void>('/course-enrollments', { data: payload, signal });
    return unwrapResponse(response);
  },
};
