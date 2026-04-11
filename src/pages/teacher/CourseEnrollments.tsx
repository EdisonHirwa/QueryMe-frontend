import React, { useEffect, useMemo, useState } from 'react';
import { courseApi, userApi, type Course, type CourseEnrollment, type PlatformUser } from '../../api';
import { useAuth } from '../../contexts';
import { useToast } from '../../components/ToastProvider';
import { extractErrorMessage } from '../../utils/errorUtils';
import { filterCoursesByTeacher } from '../../utils/queryme';
import './TeacherPages.css';

const CourseEnrollments: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<PlatformUser[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    const loadBaseData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [allCourses, allStudents] = await Promise.all([
          courseApi.getCourses(controller.signal),
          userApi.getStudents(controller.signal),
        ]);

        if (!controller.signal.aborted) {
          const teacherCourses = filterCoursesByTeacher(allCourses, user.id);
          setCourses(teacherCourses);
          setStudents(allStudents);
          if (!selectedCourseId && teacherCourses[0]) {
            setSelectedCourseId(String(teacherCourses[0].id));
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(extractErrorMessage(err, 'Failed to load courses or students.'));
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void loadBaseData();
    return () => controller.abort();
  }, [selectedCourseId, user]);

  useEffect(() => {
    if (!selectedCourseId) {
      setEnrollments([]);
      return;
    }

    const controller = new AbortController();
    setBusy(true);
    setError(null);

    void courseApi.getEnrollmentsByCourse(selectedCourseId, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) {
          setEnrollments(response);
        }
      })
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
  }, [selectedCourseId]);

  const enrolledStudentIds = useMemo(
    () => new Set(enrollments.map((enrollment) => String(enrollment.studentId))),
    [enrollments],
  );

  const availableStudents = useMemo(
    () => students.filter((student) => !enrolledStudentIds.has(String(student.id))),
    [enrolledStudentIds, students],
  );

  const visibleEnrollments = useMemo(
    () => enrollments.filter((enrollment) => {
      const student = students.find((candidate) => String(candidate.id) === String(enrollment.studentId));
      const haystack = `${student?.name || student?.fullName || ''} ${student?.email || ''} ${enrollment.studentId}`.toLowerCase();
      return haystack.includes(search.toLowerCase());
    }),
    [enrollments, search, students],
  );

  const handleEnroll = async () => {
    if (!selectedCourseId || !selectedStudentId) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await courseApi.createEnrollment({ courseId: selectedCourseId, studentId: selectedStudentId });
      const refreshed = await courseApi.getEnrollmentsByCourse(selectedCourseId);
      setEnrollments(refreshed);
      setSelectedStudentId('');
      showToast('success', 'Student enrolled', 'The selected student was added to the course.');
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to enroll the selected student.'));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (studentId: string) => {
    if (!selectedCourseId) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await courseApi.deleteEnrollment({ courseId: selectedCourseId, studentId });
      const refreshed = await courseApi.getEnrollmentsByCourse(selectedCourseId);
      setEnrollments(refreshed);
      showToast('success', 'Enrollment removed', 'The student was removed from this course.');
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
            Manage course membership with the real enrollment endpoints instead of local spreadsheets.
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
        {busy && enrollments.length === 0 ? (
          <div style={{ padding: '24px' }}>Loading enrollments...</div>
        ) : visibleEnrollments.length === 0 ? (
          <div className="students-empty" style={{ padding: '40px 20px' }}>
            <p>Select a course to view or manage its enrollments.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="students-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Email</th>
                  <th>Student ID</th>
                  <th>Enrolled At</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibleEnrollments.map((enrollment) => {
                  const student = students.find((candidate) => String(candidate.id) === String(enrollment.studentId));
                  return (
                    <tr key={`${enrollment.courseId}-${enrollment.studentId}`}>
                      <td>{String(student?.name || student?.fullName || enrollment.studentName || enrollment.studentId)}</td>
                      <td>{String(student?.email || enrollment.studentEmail || 'N/A')}</td>
                      <td>{enrollment.studentId}</td>
                      <td>{enrollment.enrolledAt ? new Date(enrollment.enrolledAt).toLocaleString() : 'N/A'}</td>
                      <td>
                        <button className="students-remove-btn" onClick={() => void handleRemove(String(enrollment.studentId))}>
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
