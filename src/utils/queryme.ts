import type {
  AuthResponse,
  AuthSessionUser,
  Course,
  Exam,
  Identifier,
  PlatformUser,
  Session,
  UserRole,
} from '../types/queryme';

export const normalizeId = (value: Identifier | null | undefined): string => String(value ?? '');

export const normalizeRole = (value?: string | null, roles?: string[]): UserRole => {
  const source = value || roles?.[0] || 'GUEST';
  const normalized = source.replace('ROLE_', '').toUpperCase();

  if (normalized === 'ADMIN' || normalized === 'TEACHER' || normalized === 'STUDENT' || normalized === 'GUEST') {
    return normalized;
  }

  return 'GUEST';
};

export const getUserDisplayName = (user?: Partial<PlatformUser> | null): string => {
  if (!user) {
    return 'Unknown User';
  }

  if (typeof user.name === 'string' && user.name.trim()) {
    return user.name.trim();
  }

  if (typeof user.fullName === 'string' && user.fullName.trim()) {
    return user.fullName.trim();
  }

  if (typeof user.email === 'string' && user.email.includes('@')) {
    return user.email.split('@')[0];
  }

  return 'Unknown User';
};

export const toAuthSessionUser = (response: AuthResponse, email: string): AuthSessionUser => {
  const backendUser = response.user ?? {
    id: response.id ?? email,
    email: response.email ?? email,
    name: response.name,
    fullName: response.fullName,
    role: response.role,
    roles: response.roles,
  };

  return {
    id: normalizeId(backendUser.id),
    email: backendUser.email || email,
    name: getUserDisplayName(backendUser),
    role: normalizeRole(
      typeof backendUser.role === 'string' ? backendUser.role : undefined,
      backendUser.roles,
    ),
  };
};

export const getInitials = (value?: string | null): string => {
  if (!value) {
    return '??';
  }

  const parts = value
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return '??';
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
};

export const getCourseName = (course?: Partial<Course> | null, fallbackId?: Identifier | null): string => {
  if (course?.name && course.name.trim()) {
    return course.name;
  }

  return fallbackId ? String(fallbackId) : 'Unknown Course';
};

export const filterCoursesByTeacher = (courses: Course[], teacherId?: string | null): Course[] => {
  if (!teacherId) {
    return courses;
  }

  const ownedCourses = courses.filter((course) => !course.teacherId || normalizeId(course.teacherId) === normalizeId(teacherId));
  return ownedCourses.length > 0 ? ownedCourses : courses;
};

export const getExamTimeLimit = (exam: Partial<Exam>): number => exam.timeLimitMins ?? exam.timeLimit ?? 0;

export const getExamQuestionCount = (exam: Partial<Exam>): number => exam.questions?.length ?? 0;

export const normalizeExamStatus = (status?: string | null): string => (status || '').trim().toUpperCase();

export const isExamPublished = (exam: Partial<Exam>): boolean => {
  const status = normalizeExamStatus(exam.status);
  return status === 'PUBLISHED' || status === 'ACTIVE';
};

export const isSessionComplete = (session: Partial<Session>): boolean => {
  const status = (session.status || '').toLowerCase();
  return Boolean(session.isSubmitted || session.isExpired || session.submittedAt || status === 'submitted' || status === 'timed_out' || status === 'expired');
};

export const getSessionRemainingMs = (session?: Partial<Session> | null): number => {
  if (!session?.expiresAt) {
    return 0;
  }

  return Math.max(0, new Date(session.expiresAt).getTime() - Date.now());
};

export const formatDateTime = (value?: string | null): string => {
  if (!value) {
    return 'N/A';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
};
