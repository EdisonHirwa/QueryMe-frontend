import React, { useEffect, useMemo, useState } from 'react';
import { courseApi, examApi, sessionApi, type Session } from '../../api';
import { extractErrorMessage } from '../../utils/errorUtils';

interface ActivityRow {
  sessionId: string;
  examTitle: string;
  studentId: string;
  status: string;
  startedAt: string;
  submittedAt: string;
}

const SystemLogs: React.FC = () => {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadActivity = async () => {
      setLoading(true);
      setError(null);

      try {
        const courses = await courseApi.getCourses(controller.signal);
        const examLists = await Promise.all(
          courses.map((course) => examApi.getExamsByCourse(String(course.id), controller.signal).catch(() => [])),
        );
        const exams = examLists.flat();

        const sessionLists = await Promise.all(
          exams.map(async (exam) => {
            const sessions = await sessionApi.getSessionsByExam(String(exam.id), controller.signal).catch(() => [] as Session[]);
            return sessions.map((session) => ({
              sessionId: String(session.id),
              examTitle: exam.title,
              studentId: String(session.studentId),
              status: session.isExpired ? 'EXPIRED' : session.isSubmitted || session.submittedAt ? 'SUBMITTED' : 'IN_PROGRESS',
              startedAt: session.startedAt || '',
              submittedAt: session.submittedAt || '',
            } satisfies ActivityRow));
          }),
        );

        if (!controller.signal.aborted) {
          setRows(
            sessionLists
              .flat()
              .sort((left, right) => new Date(right.startedAt || 0).getTime() - new Date(left.startedAt || 0).getTime()),
          );
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(extractErrorMessage(err, 'Failed to load operational activity.'));
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void loadActivity();
    return () => controller.abort();
  }, []);

  const filteredRows = useMemo(
    () => rows.filter((row) => `${row.examTitle} ${row.studentId} ${row.status}`.toLowerCase().includes(search.toLowerCase())),
    [rows, search],
  );

  if (loading) {
    return <div style={{ padding: '24px' }}>Loading operational activity...</div>;
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Operational Activity</h1>
          <p>Recent session lifecycle events derived from the exam and session modules.</p>
        </div>
      </div>

      {error && <div style={{ marginBottom: '16px', color: '#e53e3e' }}>{error}</div>}

      <div className="content-card">
        <div className="content-card-header" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input className="form-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by exam, student, or status..." style={{ width: '260px' }} />
          <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#666' }}>{filteredRows.length} entries</span>
        </div>
        <div className="content-card-body" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Session</th>
                <th>Exam</th>
                <th>Student</th>
                <th>Status</th>
                <th>Started</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.sessionId}>
                  <td>{row.sessionId}</td>
                  <td>{row.examTitle}</td>
                  <td>{row.studentId}</td>
                  <td><span className="badge badge-gray">{row.status}</span></td>
                  <td>{row.startedAt ? new Date(row.startedAt).toLocaleString() : 'N/A'}</td>
                  <td>{row.submittedAt ? new Date(row.submittedAt).toLocaleString() : '—'}</td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#666' }}>
                    No operational activity matched the current search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SystemLogs;
