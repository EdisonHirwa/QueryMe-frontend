import React, { useEffect, useMemo, useState } from 'react';
import { courseApi, examApi, resultApi, type Exam, type TeacherResultRow } from '../../api';
import { useAuth } from '../../contexts';
import { extractErrorMessage } from '../../utils/errorUtils';
import { filterCoursesByTeacher, getCourseName, normalizeExamStatus } from '../../utils/queryme';
import './TeacherPages.css';

const ResultsDashboard: React.FC = () => {
  const { user } = useAuth();
  const [examOptions, setExamOptions] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [rows, setRows] = useState<TeacherResultRow[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadExams = async () => {
      if (!user) {
        setLoadingOptions(false);
        return;
      }

      setLoadingOptions(true);
      setError(null);

      try {
        const courses = await courseApi.getCourses(controller.signal);
        const accessibleCourses = filterCoursesByTeacher(courses, user.id);
        const examLists = await Promise.all(
          accessibleCourses.map((course) => examApi.getExamsByCourse(String(course.id), controller.signal).catch(() => [] as Exam[])),
        );

        const availableExams = examLists.flat().filter((exam) => normalizeExamStatus(exam.status) !== 'DRAFT');

        if (!controller.signal.aborted) {
          setExamOptions(availableExams);
          if (!selectedExamId && availableExams[0]) {
            setSelectedExamId(String(availableExams[0].id));
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(extractErrorMessage(err, 'Failed to load exam options.'));
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingOptions(false);
        }
      }
    };

    void loadExams();
    return () => controller.abort();
  }, [selectedExamId, user]);

  useEffect(() => {
    if (!selectedExamId) {
      setRows([]);
      return;
    }

    const controller = new AbortController();
    setLoadingRows(true);
    setError(null);

    void resultApi.getExamDashboard(selectedExamId, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) {
          setRows(response);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(extractErrorMessage(err, 'Failed to load exam results.'));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingRows(false);
        }
      });

    return () => controller.abort();
  }, [selectedExamId]);

  const filteredRows = useMemo(
    () => rows.filter((row) => {
      const haystack = `${row.studentName || ''} ${row.questionPrompt || ''} ${row.submittedQuery || ''}`.toLowerCase();
      return haystack.includes(searchQuery.toLowerCase());
    }),
    [rows, searchQuery],
  );

  const averageScore = useMemo(() => {
    const validRows = filteredRows.filter((row) => typeof row.score === 'number' && typeof row.maxScore === 'number' && row.maxScore > 0);
    if (validRows.length === 0) {
      return 0;
    }

    return Math.round(
      validRows.reduce((sum, row) => sum + ((row.score || 0) / (row.maxScore || 1)) * 100, 0) / validRows.length,
    );
  }, [filteredRows]);

  if (loadingOptions) {
    return <div className="teacher-page" style={{ padding: '24px' }}>Loading results dashboard...</div>;
  }

  return (
    <div className="teacher-page" style={{ padding: '24px', overflow: 'hidden' }}>
      <div className="builder-header">
        <div>
          <h1 className="builder-title" style={{ fontSize: '18px' }}>Results Dashboard</h1>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#666' }}>
            Review the latest graded submission per student and question.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px 220px', gap: '12px', marginBottom: '18px' }}>
        <input
          className="res-search-input"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search students, prompts, or SQL..."
        />
        <select className="form-input" value={selectedExamId} onChange={(event) => setSelectedExamId(event.target.value)}>
          <option value="">Select exam</option>
          {examOptions.map((exam) => (
            <option key={String(exam.id)} value={String(exam.id)}>
              {exam.title} · {getCourseName(exam.course, exam.courseId)}
            </option>
          ))}
        </select>
        <div className="content-card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '12px', color: '#666' }}>Average Score</span>
          <strong>{averageScore}%</strong>
        </div>
      </div>

      {error && <div style={{ color: '#e53e3e', marginBottom: '12px' }}>{error}</div>}

      <div className="results-table-card">
        {loadingRows ? (
          <div style={{ padding: '24px' }}>Loading exam results...</div>
        ) : filteredRows.length === 0 ? (
          <div style={{ padding: '24px', color: '#666' }}>
            Select an exam to view its latest submissions.
          </div>
        ) : (
          <table className="results-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Question</th>
                <th>Score</th>
                <th>Status</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, index) => (
                <tr key={`${row.sessionId}-${row.questionId}-${index}`}>
                  <td>
                    <div className="sess-student-name">{row.studentName || row.studentId}</div>
                    <div className="sess-student-email">Session {row.sessionId}</div>
                  </td>
                  <td>{row.questionPrompt || row.questionId}</td>
                  <td>{row.score ?? 0}/{row.maxScore ?? 0}</td>
                  <td>
                    <span className={`badge ${row.isCorrect ? 'badge-green' : 'badge-gray'}`}>
                      {row.isCorrect ? 'Correct' : 'Reviewed'}
                    </span>
                  </td>
                  <td>{row.submittedAt ? new Date(row.submittedAt).toLocaleString() : 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ResultsDashboard;
