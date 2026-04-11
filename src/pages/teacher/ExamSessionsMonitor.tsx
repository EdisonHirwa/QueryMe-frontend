import React, { useEffect, useMemo, useState } from 'react';
import { courseApi, examApi, sessionApi, userApi, type Exam, type PlatformUser, type Session } from '../../api';
import { useAuth } from '../../contexts';
import { extractErrorMessage } from '../../utils/errorUtils';
import { filterCoursesByTeacher, isSessionComplete } from '../../utils/queryme';
import './TeacherPages.css';

type SessionStatus = 'in_progress' | 'submitted' | 'expired';

interface SessionRow {
  id: string;
  studentName: string;
  studentEmail: string;
  startedAt: string;
  submittedAt: string;
  expiresAt: string;
  sandboxSchema: string;
  status: SessionStatus;
}

const ExamSessionsMonitor: React.FC = () => {
  const { user } = useAuth();
  const [examOptions, setExamOptions] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [studentsById, setStudentsById] = useState<Record<string, PlatformUser>>({});
  const [loading, setLoading] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const loadOptions = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [courses, students] = await Promise.all([
          courseApi.getCourses(controller.signal),
          userApi.getStudents(controller.signal),
        ]);

        const accessibleCourses = filterCoursesByTeacher(courses, user.id);
        const examLists = await Promise.all(
          accessibleCourses.map((course) => examApi.getExamsByCourse(String(course.id), controller.signal).catch(() => [] as Exam[])),
        );

        if (!controller.signal.aborted) {
          const byId = Object.fromEntries(students.map((student) => [String(student.id), student]));
          const exams = examLists.flat();
          setStudentsById(byId);
          setExamOptions(exams);
          if (exams[0]) {
            setSelectedExamId((previous) => previous || String(exams[0].id));
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(extractErrorMessage(err, 'Failed to load available exams or students.'));
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void loadOptions();
    return () => controller.abort();
  }, [user]);

  useEffect(() => {
    if (!selectedExamId) {
      setRows([]);
      return;
    }

    const controller = new AbortController();
    setLoadingSessions(true);
    setError(null);

    void sessionApi.getSessionsByExam(selectedExamId, controller.signal)
      .then((sessions) => {
        if (controller.signal.aborted) {
          return;
        }

        setRows(
          sessions.map((session) => {
            const student = studentsById[String(session.studentId)];
            return {
              id: String(session.id),
              studentName: String(student?.name || student?.fullName || session.studentId),
              studentEmail: String(student?.email || 'No email'),
              startedAt: session.startedAt || '',
              submittedAt: session.submittedAt || '',
              expiresAt: session.expiresAt || '',
              sandboxSchema: String(session.sandboxSchema || 'N/A'),
              status: getSessionStatus(session),
            };
          }),
        );
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(extractErrorMessage(err, 'Failed to load exam sessions.'));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingSessions(false);
        }
      });

    return () => controller.abort();
  }, [selectedExamId, studentsById]);

  const counts = useMemo(() => ({
    all: rows.length,
    in_progress: rows.filter((row) => row.status === 'in_progress').length,
    submitted: rows.filter((row) => row.status === 'submitted').length,
    expired: rows.filter((row) => row.status === 'expired').length,
  }), [rows]);

  const forceSubmit = async (sessionId: string) => {
    setError(null);

    try {
      await sessionApi.submitSession(sessionId);
      const refreshed = await sessionApi.getSessionsByExam(selectedExamId);
      setRows(
        refreshed.map((session) => {
          const student = studentsById[String(session.studentId)];
          return {
            id: String(session.id),
            studentName: String(student?.name || student?.fullName || session.studentId),
            studentEmail: String(student?.email || 'No email'),
            startedAt: session.startedAt || '',
            submittedAt: session.submittedAt || '',
            expiresAt: session.expiresAt || '',
            sandboxSchema: String(session.sandboxSchema || 'N/A'),
            status: getSessionStatus(session),
          };
        }),
      );
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to submit that active session.'));
    }
  };

  if (loading) {
    return <div className="teacher-page" style={{ padding: '24px' }}>Loading sessions monitor...</div>;
  }

  return (
    <div className="teacher-page" style={{ overflow: 'hidden' }}>
      <div className="builder-header">
        <div>
          <h1 className="builder-title" style={{ fontSize: '18px' }}>Exam Sessions Monitor</h1>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#666' }}>
            Track active, submitted, and expired sessions returned by the session module.
          </p>
        </div>
      </div>

      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="sess-stat-bar">
          <span className="sess-stat-pill active"><span className="sess-stat-num sess-stat-all">{counts.all}</span><span className="sess-stat-label">All Sessions</span></span>
          <span className="sess-stat-pill"><span className="sess-stat-num sess-stat-in_progress">{counts.in_progress}</span><span className="sess-stat-label">In Progress</span></span>
          <span className="sess-stat-pill"><span className="sess-stat-num sess-stat-submitted">{counts.submitted}</span><span className="sess-stat-label">Submitted</span></span>
          <span className="sess-stat-pill"><span className="sess-stat-num sess-stat-expired">{counts.expired}</span><span className="sess-stat-label">Expired</span></span>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select className="form-input" value={selectedExamId} onChange={(event) => setSelectedExamId(event.target.value)}>
            <option value="">Select exam</option>
            {examOptions.map((exam) => (
              <option key={String(exam.id)} value={String(exam.id)}>
                {exam.title}
              </option>
            ))}
          </select>
        </div>

        {error && <div style={{ color: '#e53e3e' }}>{error}</div>}

        <div className="builder-card" style={{ padding: 0, overflow: 'hidden' }}>
          {loadingSessions ? (
            <div style={{ padding: '24px' }}>Loading sessions...</div>
          ) : rows.length === 0 ? (
            <div className="students-empty" style={{ padding: '60px 20px' }}>
              <p>Select an exam to inspect its session lifecycle.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="sess-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Status</th>
                    <th>Started</th>
                    <th>Submitted</th>
                    <th>Time Remaining</th>
                    <th>Sandbox</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="sess-student-cell">
                          <span className="sess-avatar">{row.studentName[0] || '?'}</span>
                          <div>
                            <div className="sess-student-name">{row.studentName}</div>
                            <div className="sess-student-email">{row.studentEmail}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`sess-status-chip ${row.status === 'in_progress' ? 'sess-status-active' : row.status === 'submitted' ? 'sess-status-submitted' : 'sess-status-expired'}`}>
                          {row.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td>{row.startedAt ? new Date(row.startedAt).toLocaleString() : 'N/A'}</td>
                      <td>{row.submittedAt ? new Date(row.submittedAt).toLocaleString() : '—'}</td>
                      <td>
                        {row.status === 'in_progress' && row.expiresAt
                          ? formatRemaining(Math.max(0, new Date(row.expiresAt).getTime() - now))
                          : row.status === 'expired'
                            ? 'Expired'
                            : '—'}
                      </td>
                      <td><span className="sess-sandbox-badge">{row.sandboxSchema}</span></td>
                      <td>
                        {row.status === 'in_progress' && (
                          <button className="sess-force-btn" onClick={() => void forceSubmit(row.id)}>
                            Force Submit
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const getSessionStatus = (session: Session): SessionStatus => {
  if (session.isExpired || (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now() && !isSessionComplete(session))) {
    return 'expired';
  }
  if (isSessionComplete(session)) {
    return 'submitted';
  }
  return 'in_progress';
};

const formatRemaining = (remainingMs: number): string => {
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
};

export default ExamSessionsMonitor;
