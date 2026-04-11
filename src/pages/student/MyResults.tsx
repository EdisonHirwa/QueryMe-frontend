import React, { useEffect, useMemo, useState } from 'react';
import { examApi, resultApi, sessionApi, type StudentExamResult } from '../../api';
import { useAuth } from '../../contexts';
import { extractErrorMessage } from '../../utils/errorUtils';
import { formatDateTime, getCourseName } from '../../utils/queryme';

interface ResultRow {
  sessionId: string;
  examId: string;
  title: string;
  course: string;
  submittedAt: string;
  visible: boolean;
  totalScore: number;
  totalMaxScore: number;
  visibilityMode: string;
  questions: NonNullable<StudentExamResult['questions']>;
}

const MyResults: React.FC = () => {
  const { user } = useAuth();
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadResults = async () => {
      if (!user) {
        setError('Please sign in to view your results.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const sessions = await sessionApi.getSessionsByStudent(user.id, controller.signal);

        const rows = await Promise.all(
          sessions.map(async (session) => {
            const [exam, sessionResult] = await Promise.all([
              examApi.getExam(String(session.examId), controller.signal).catch(() => null),
              resultApi.getSessionResult(String(session.id), controller.signal).catch(() => null),
            ]);

            return {
              sessionId: String(session.id),
              examId: String(session.examId),
              title: exam?.title || 'Exam',
              course: getCourseName(exam?.course, exam?.courseId),
              submittedAt: session.submittedAt || session.startedAt || '',
              visible: sessionResult?.visible ?? false,
              totalScore: sessionResult?.totalScore ?? 0,
              totalMaxScore: sessionResult?.totalMaxScore ?? 0,
              visibilityMode: String(sessionResult?.visibilityMode || exam?.visibilityMode || 'N/A'),
              questions: sessionResult?.questions || [],
            } satisfies ResultRow;
          }),
        );

        if (!controller.signal.aborted) {
          setResults(
            rows.sort(
              (left, right) => new Date(right.submittedAt || 0).getTime() - new Date(left.submittedAt || 0).getTime(),
            ),
          );
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(extractErrorMessage(err, 'Failed to load your results.'));
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void loadResults();

    return () => controller.abort();
  }, [user]);

  const visibleResults = useMemo(
    () => results.filter((result) => result.visible && result.totalMaxScore > 0),
    [results],
  );

  const averageScore = useMemo(() => {
    if (visibleResults.length === 0) {
      return 0;
    }

    return Math.round(
      visibleResults.reduce((sum, result) => sum + (result.totalScore / result.totalMaxScore) * 100, 0) / visibleResults.length,
    );
  }, [visibleResults]);

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <h1>My Results</h1>
          <p>Loading the session results released to your account.</p>
        </div>
        <div style={{ textAlign: 'center', padding: '40px' }}>Loading results...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="page-header">
          <h1>My Results</h1>
          <p>View your exam scores and released feedback.</p>
        </div>
        <div style={{ textAlign: 'center', padding: '40px', color: 'red' }}>{error}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>My Results</h1>
        <p>Only the results the backend marks as visible are shown in detail.</p>
      </div>

      <div className="stat-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-card-value">{results.length}</div>
          <div className="stat-card-label">Total Sessions</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value">{visibleResults.length}</div>
          <div className="stat-card-label">Visible Results</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value">{averageScore}%</div>
          <div className="stat-card-label">Average Visible Score</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value">{results.length - visibleResults.length}</div>
          <div className="stat-card-label">Awaiting Release</div>
        </div>
      </div>

      <div className="content-card">
        <div className="content-card-header">
          <h2>Session History</h2>
        </div>
        <div className="content-card-body" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Exam</th>
                <th>Submitted</th>
                <th>Visibility</th>
                <th>Score</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => (
                <React.Fragment key={result.sessionId}>
                  <tr style={{ cursor: result.visible ? 'pointer' : 'default' }} onClick={() => result.visible && setExpandedSessionId(expandedSessionId === result.sessionId ? null : result.sessionId)}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#1a1a2e' }}>{result.title}</div>
                      <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{result.course}</div>
                    </td>
                    <td style={{ fontSize: '12px', color: '#666' }}>{formatDateTime(result.submittedAt)}</td>
                    <td>
                      <span className={`badge ${result.visible ? 'badge-green' : 'badge-gray'}`}>
                        {result.visible ? result.visibilityMode : 'Hidden'}
                      </span>
                    </td>
                    <td>
                      {result.visible ? (
                        <span style={{ fontWeight: 700, color: '#1a1a2e' }}>
                          {result.totalScore}/{result.totalMaxScore}
                        </span>
                      ) : (
                        <span style={{ color: '#888' }}>Awaiting release</span>
                      )}
                    </td>
                    <td>{result.visible ? '▶' : ''}</td>
                  </tr>
                  {expandedSessionId === result.sessionId && (
                    <tr>
                      <td colSpan={5} style={{ background: '#fafafe', padding: '16px 24px' }}>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                          {result.questions.map((question, index) => (
                            <div
                              key={String(question.questionId)}
                              style={{
                                padding: '10px 16px',
                                borderRadius: '10px',
                                background: '#fff',
                                border: '1px solid #e8e8ee',
                                minWidth: '140px',
                              }}
                            >
                              <div style={{ fontSize: '10px', fontWeight: 700, color: '#888', marginBottom: '4px', textTransform: 'uppercase' }}>
                                Question {index + 1}
                              </div>
                              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>{question.prompt}</div>
                              <div style={{ fontSize: '12px', color: '#666' }}>
                                Score: {question.score ?? 0}/{question.maxScore ?? 0}
                              </div>
                              <div style={{ fontSize: '12px', color: question.isCorrect ? '#38a169' : '#dd6b20', marginTop: '4px' }}>
                                {question.isCorrect ? 'Correct' : 'Reviewed'}
                              </div>
                            </div>
                          ))}
                          {result.questions.length === 0 && (
                            <div style={{ color: '#666' }}>No question breakdown was returned for this session.</div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {results.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: '#666' }}>
                    No exam sessions have been recorded yet.
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

export default MyResults;
