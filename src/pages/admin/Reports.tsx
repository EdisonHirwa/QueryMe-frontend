import React, { useEffect, useMemo, useState } from 'react';
import { courseApi, examApi, resultApi } from '../../api';
import { extractErrorMessage } from '../../utils/errorUtils';
import type { Course, Exam, TeacherResultRow } from '../../api';

interface CourseMetrics {
  course: Course;
  exams: Exam[];
  resultRows: TeacherResultRow[];
}

const Reports: React.FC = () => {
  const [selectedCourseId, setSelectedCourseId] = useState('ALL');
  const [metrics, setMetrics] = useState<CourseMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadReports = async () => {
      setLoading(true);
      setError(null);

      try {
        const courses = await courseApi.getCourses(controller.signal);
        const reportRows = await Promise.all(
          courses.map(async (course) => {
            const exams = await examApi.getExamsByCourse(String(course.id), controller.signal).catch(() => [] as Exam[]);
            const resultRows = await Promise.all(
              exams.map((exam) => resultApi.getExamDashboard(String(exam.id), controller.signal).catch(() => [] as TeacherResultRow[])),
            );

            return {
              course,
              exams,
              resultRows: resultRows.flat(),
            } satisfies CourseMetrics;
          }),
        );

        if (!controller.signal.aborted) {
          setMetrics(reportRows);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(extractErrorMessage(err, 'Failed to load platform reports.'));
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void loadReports();
    return () => controller.abort();
  }, []);

  const activeMetrics = useMemo(() => {
    const selected = selectedCourseId === 'ALL'
      ? metrics
      : metrics.filter((metric) => String(metric.course.id) === selectedCourseId);

    const exams = selected.flatMap((metric) => metric.exams);
    const resultRows = selected.flatMap((metric) => metric.resultRows);
    const averageScore = resultRows.length
      ? Math.round(
          resultRows.reduce((sum, row) => sum + (((row.score || 0) / (row.maxScore || 1)) * 100), 0) / resultRows.length,
        )
      : 0;

    const correctRate = resultRows.length
      ? Math.round((resultRows.filter((row) => row.isCorrect).length / resultRows.length) * 100)
      : 0;

    return {
      exams: exams.length,
      resultRows: resultRows.length,
      averageScore,
      correctRate,
    };
  }, [metrics, selectedCourseId]);

  if (loading) {
    return <div style={{ padding: '24px' }}>Loading reports...</div>;
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Platform Reports</h1>
          <p>Course-by-course metrics derived from exams and latest result dashboard rows.</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => setSelectedCourseId('ALL')}>
          Reset View
        </button>
      </div>

      {error && <div style={{ marginBottom: '16px', color: '#e53e3e' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '22px' }}>
        <div className="content-card" style={{ gridColumn: '1 / -1' }}>
          <div className="content-card-header">
            <h2>Course Performance Overview</h2>
          </div>
          <div className="content-card-body" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Exams</th>
                  <th>Result Rows</th>
                  <th>Average Score</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((metric) => {
                  const averageScore = metric.resultRows.length
                    ? Math.round(
                        metric.resultRows.reduce((sum, row) => sum + (((row.score || 0) / (row.maxScore || 1)) * 100), 0) / metric.resultRows.length,
                      )
                    : 0;

                  return (
                    <tr key={String(metric.course.id)}>
                      <td style={{ fontWeight: 600 }}>{metric.course.name}</td>
                      <td>{metric.exams.length}</td>
                      <td>{metric.resultRows.length}</td>
                      <td>{averageScore}%</td>
                      <td>
                        <button className="btn btn-sm btn-secondary" onClick={() => setSelectedCourseId(String(metric.course.id))}>
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="content-card">
          <div className="content-card-header">
            <h2>Key Indicators</h2>
          </div>
          <div className="content-card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="metric-box"><div style={{ fontSize: '24px', fontWeight: 700 }}>{activeMetrics.exams}</div><div style={{ fontSize: '11px', opacity: 0.7 }}>Exams</div></div>
              <div className="metric-box"><div style={{ fontSize: '24px', fontWeight: 700 }}>{activeMetrics.resultRows}</div><div style={{ fontSize: '11px', opacity: 0.7 }}>Result Rows</div></div>
              <div className="metric-box"><div style={{ fontSize: '24px', fontWeight: 700 }}>{activeMetrics.averageScore}%</div><div style={{ fontSize: '11px', opacity: 0.7 }}>Average Score</div></div>
              <div className="metric-box"><div style={{ fontSize: '24px', fontWeight: 700 }}>{activeMetrics.correctRate}%</div><div style={{ fontSize: '11px', opacity: 0.7 }}>Correct Rate</div></div>
            </div>
          </div>
        </div>

        <div className="content-card">
          <div className="content-card-header">
            <h2>Active Scope</h2>
          </div>
          <div className="content-card-body">
            <div style={{ fontSize: '14px' }}>
              Viewing: <strong>{selectedCourseId === 'ALL' ? 'All Courses' : metrics.find((metric) => String(metric.course.id) === selectedCourseId)?.course.name || 'Selected Course'}</strong>
            </div>
            <p style={{ marginTop: '12px', fontSize: '12px', color: '#666' }}>
              These metrics are computed from the latest teacher dashboard rows returned by the backend, not from mock analytics.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
