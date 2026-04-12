import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { courseApi, userApi, type Course, type CourseEnrollment, type PlatformUser } from '../../api';
import { useAuth } from '../../contexts';
import { useToast } from '../../components/ToastProvider';
import { extractErrorMessage } from '../../utils/errorUtils';
import { filterCoursesByTeacher } from '../../utils/queryme';
import './TeacherPages.css';

type MembershipSource = 'ENROLLMENT' | 'DIRECT' | 'BOTH';

interface CourseMemberRow {
  courseId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  enrolledAt?: string;
  source: MembershipSource;
}

const getRecordValue = (record: Record<string, unknown>, keys: string[]): unknown => {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null) {
      return value;
    }
  }

  return undefined;
};

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' ? value as Record<string, unknown> : {}
);

const getEnrollmentStudentId = (enrollment: CourseEnrollment): string => {
  const enrollmentRecord = asRecord(enrollment);
  const studentRecord = asRecord(enrollmentRecord.student);

  const value = getRecordValue(enrollmentRecord, ['studentId', 'student_id'])
    ?? getRecordValue(studentRecord, ['id', 'studentId', 'student_id']);

  return value !== undefined ? String(value) : '';
};

const getEnrollmentCourseId = (enrollment: CourseEnrollment): string => {
  const enrollmentRecord = asRecord(enrollment);
  const courseRecord = asRecord(enrollmentRecord.course);

  const value = getRecordValue(enrollmentRecord, ['courseId', 'course_id'])
    ?? getRecordValue(courseRecord, ['id', 'courseId', 'course_id']);

  return value !== undefined ? String(value) : '';
};

const getEnrollmentEnrolledAt = (enrollment: CourseEnrollment): string | undefined => {
  const enrollmentRecord = asRecord(enrollment);
  const value = getRecordValue(enrollmentRecord, ['enrolledAt', 'enrolled_at', 'createdAt', 'created_at']);
  return typeof value === 'string' && value.trim() ? value : undefined;
};

const getEnrollmentStudentName = (enrollment: CourseEnrollment): string | undefined => {
  const enrollmentRecord = asRecord(enrollment);
  const studentRecord = asRecord(enrollmentRecord.student);
  const studentUserRecord = asRecord(studentRecord.user);

  const value = getRecordValue(enrollmentRecord, ['studentName', 'student_name'])
    ?? getRecordValue(studentRecord, ['name', 'fullName', 'full_name'])
    ?? getRecordValue(studentUserRecord, ['name', 'fullName', 'full_name']);

  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

const getEnrollmentStudentEmail = (enrollment: CourseEnrollment): string | undefined => {
  const enrollmentRecord = asRecord(enrollment);
  const studentRecord = asRecord(enrollmentRecord.student);
  const studentUserRecord = asRecord(studentRecord.user);

  const value = getRecordValue(enrollmentRecord, ['studentEmail', 'student_email', 'email'])
    ?? getRecordValue(studentRecord, ['email'])
    ?? getRecordValue(studentUserRecord, ['email']);

  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

const isNullParseEnrollmentError = (error: unknown): boolean => extractErrorMessage(error).toLowerCase().includes('cannot parse null string');

const getMembershipSourceLabel = (source: MembershipSource): string => {
  if (source === 'DIRECT') {
    return 'Profile assignment';
  }

  if (source === 'BOTH') {
    return 'Enrollment + profile';
  }

  return 'Enrollment record';
};

const CourseEnrollments: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<PlatformUser[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const requestedCourseId = searchParams.get('courseId') || '';

  const loadBaseData = useCallback(async (signal?: AbortSignal) => {
    if (!user) {
      setCourses([]);
      setStudents([]);
      return;
    }

    const [allCourses, allStudents] = await Promise.all([
      courseApi.getCourses(signal),
      userApi.getStudents(signal),
    ]);

    const teacherCourses = filterCoursesByTeacher(allCourses, user.id);
    setCourses(teacherCourses);
    setStudents(allStudents);
    setSelectedCourseId((previous) => {
      if (previous && teacherCourses.some((course) => String(course.id) === previous)) {
        return previous;
      }

      if (requestedCourseId && teacherCourses.some((course) => String(course.id) === requestedCourseId)) {
        return requestedCourseId;
      }

      return teacherCourses[0] ? String(teacherCourses[0].id) : '';
    });
  }, [requestedCourseId, user]);

  const loadCourseEnrollments = useCallback(async (courseId: string, signal?: AbortSignal) => {
    const response = await courseApi.getEnrollmentsByCourse(courseId, signal);
    setEnrollments(response);
  }, []);

  const refreshMembershipState = useCallback(async (courseId: string) => {
    const [allStudents, courseEnrollments] = await Promise.all([
      userApi.getStudents(),
      courseApi.getEnrollmentsByCourse(courseId).catch(() => [] as CourseEnrollment[]),
    ]);

    setStudents(allStudents);
    setEnrollments(courseEnrollments);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    void loadBaseData(controller.signal)
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(extractErrorMessage(err, 'Failed to load courses or students.'));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [loadBaseData]);

  useEffect(() => {
    if (!selectedCourseId) {
      setEnrollments([]);
      return;
    }

    const controller = new AbortController();
    setBusy(true);
    setError(null);

    void loadCourseEnrollments(selectedCourseId, controller.signal)
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(extractErrorMessage(err, 'Failed to load course enrollments.'));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setBusy(false);
        }
      });

    return () => controller.abort();
  }, [loadCourseEnrollments, selectedCourseId]);

  const memberRows = useMemo(() => {
    const rowsByStudentId = new Map<string, CourseMemberRow>();

    enrollments.forEach((enrollment) => {
      const studentId = getEnrollmentStudentId(enrollment);
      const courseId = getEnrollmentCourseId(enrollment) || selectedCourseId;
      const student = students.find((candidate) => String(candidate.id) === studentId);
      const fallbackStudentName = getEnrollmentStudentName(enrollment);
      const fallbackStudentEmail = getEnrollmentStudentEmail(enrollment);

      if (!studentId) {
        return;
      }

      rowsByStudentId.set(studentId, {
        courseId,
        studentId,
        studentName: String(student?.name || student?.fullName || enrollment.studentName || fallbackStudentName || studentId),
        studentEmail: String(student?.email || enrollment.studentEmail || fallbackStudentEmail || 'N/A'),
        enrolledAt: getEnrollmentEnrolledAt(enrollment),
        source: 'ENROLLMENT',
      });
    });

    students.forEach((student) => {
      if (String(student.courseId ?? '') !== selectedCourseId) {
        return;
      }

      const studentId = String(student.id);
      const existing = rowsByStudentId.get(studentId);
      const studentRecord = asRecord(student);
      const studentUserRecord = asRecord(studentRecord.user);
      const nestedStudentName = getRecordValue(studentUserRecord, ['name', 'fullName', 'full_name']);
      const nestedStudentEmail = getRecordValue(studentUserRecord, ['email']);
      const studentName = String(student.name || student.fullName || nestedStudentName || student.email || nestedStudentEmail || studentId);
      const studentEmail = String(student.email || nestedStudentEmail || 'N/A');
      const enrolledAt = student.updatedAt || student.createdAt || existing?.enrolledAt;

      rowsByStudentId.set(studentId, {
        courseId: selectedCourseId,
        studentId,
        studentName,
        studentEmail,
        enrolledAt,
        source: existing ? 'BOTH' : 'DIRECT',
      });
    });

    return [...rowsByStudentId.values()].sort((left, right) => left.studentName.localeCompare(right.studentName));
  }, [enrollments, selectedCourseId, students]);

  const enrolledStudentIds = useMemo(
    () => new Set(memberRows.map((row) => row.studentId)),
    [memberRows],
  );

  const availableStudents = useMemo(
    () => students.filter((student) => !enrolledStudentIds.has(String(student.id))),
    [enrolledStudentIds, students],
  );

  const visibleEnrollments = useMemo(
    () => memberRows.filter((member) => {
      const haystack = `${member.studentName} ${member.studentEmail} ${member.studentId} ${getMembershipSourceLabel(member.source)}`.toLowerCase();
      return haystack.includes(search.toLowerCase());
    }),
    [memberRows, search],
  );

  const handleEnroll = async () => {
    if (!selectedCourseId || !selectedStudentId) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await courseApi.createEnrollment({ courseId: selectedCourseId, studentId: selectedStudentId });
      await refreshMembershipState(selectedCourseId);
      setSelectedStudentId('');
      showToast('success', 'Student enrolled', 'The selected student was added to the course.');
    } catch (err) {
      if (isNullParseEnrollmentError(err)) {
        try {
          await userApi.updateStudent(selectedStudentId, { courseId: selectedCourseId });
          await refreshMembershipState(selectedCourseId);
          setSelectedStudentId('');
          showToast('success', 'Student assigned', 'The enrollment endpoint rejected the request, so the student was linked through the student profile API instead.');
        } catch (fallbackErr) {
          setError(extractErrorMessage(fallbackErr, 'Failed to assign the selected student to the course.'));
        }
      } else {
        setError(extractErrorMessage(err, 'Failed to enroll the selected student.'));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (member: CourseMemberRow) => {
    if (!selectedCourseId) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      let changed = false;

      if (member.source === 'ENROLLMENT' || member.source === 'BOTH') {
        try {
          await courseApi.deleteEnrollment({ courseId: selectedCourseId, studentId: member.studentId });
          changed = true;
        } catch (err) {
          if (!isNullParseEnrollmentError(err) && member.source === 'ENROLLMENT') {
            throw err;
          }
        }
      }

      if (member.source === 'DIRECT' || member.source === 'BOTH') {
        await userApi.updateStudent(member.studentId, { courseId: null, classGroupId: null });
        changed = true;
      }

      if (!changed) {
        throw new Error('The backend did not accept the membership removal request.');
      }

      await refreshMembershipState(selectedCourseId);
      showToast('success', 'Membership removed', 'The student was removed from this course.');
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to remove the selected enrollment.'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="teacher-page" style={{ padding: '24px' }}>Loading course enrollments...</div>;
  }

  return (
    <div className="teacher-page" style={{ overflow: 'hidden', padding: '24px' }}>
      <div className="builder-header">
        <div>
          <h1 className="builder-title" style={{ fontSize: '18px' }}>Course Enrollments</h1>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#666' }}>
            Manage course membership with enrollment records and direct student-course assignments from the backend.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', marginTop: '20px', marginBottom: '20px' }}>
        <select className="form-input" value={selectedCourseId} onChange={(event) => setSelectedCourseId(event.target.value)}>
          <option value="">Select course</option>
          {courses.map((course) => (
            <option key={String(course.id)} value={String(course.id)}>{course.name}</option>
          ))}
        </select>
        <select className="form-input" value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)}>
          <option value="">Select student to enroll</option>
          {availableStudents.map((student) => (
            <option key={String(student.id)} value={String(student.id)}>
              {String(student.name || student.fullName || student.email)}
            </option>
          ))}
        </select>
        <button className="btn btn-primary" onClick={() => void handleEnroll()} disabled={!selectedCourseId || !selectedStudentId || busy}>
          Enroll
        </button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <input className="res-search-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search enrolled students..." />
      </div>

      {error && <div style={{ color: '#e53e3e', marginBottom: '12px' }}>{error}</div>}

      <div className="builder-card" style={{ padding: 0, overflow: 'hidden' }}>
        {busy && memberRows.length === 0 ? (
          <div style={{ padding: '24px' }}>Loading enrollments...</div>
        ) : visibleEnrollments.length === 0 ? (
          <div className="students-empty" style={{ padding: '40px 20px' }}>
            <p>{selectedCourseId ? 'No students are linked to this course yet.' : 'Select a course to view or manage its memberships.'}</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="students-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Email</th>
                  <th>Source</th>
                  <th>Enrolled At</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibleEnrollments.map((member) => {
                  return (
                    <tr key={`${member.courseId}-${member.studentId}`}>
                      <td>{member.studentName}</td>
                      <td>{member.studentEmail}</td>
                      <td>
                        <span className="badge badge-gray">{getMembershipSourceLabel(member.source)}</span>
                      </td>
                      <td>{member.enrolledAt ? new Date(member.enrolledAt).toLocaleString() : 'N/A'}</td>
                      <td>
                        <button className="students-remove-btn" onClick={() => void handleRemove(member)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CourseEnrollments;
