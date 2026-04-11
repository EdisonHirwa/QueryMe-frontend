import React, { useEffect, useState } from 'react';
import { courseApi, examApi, sandboxApi, type Exam } from '../../api';
import { useToast } from '../../components/ToastProvider';
import { extractErrorMessage } from '../../utils/errorUtils';
import { getCourseName, normalizeExamStatus } from '../../utils/queryme';

const SystemSettings: React.FC = () => {
  const { showToast } = useToast();
  const [exams, setExams] = useState<Exam[]>([]);
  const [sandboxExamId, setSandboxExamId] = useState('');
  const [sandboxStudentId, setSandboxStudentId] = useState('');
  const [sandboxInfo, setSandboxInfo] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadExams = async (signal?: AbortSignal) => {
    const courses = await courseApi.getCourses(signal);
    const examLists = await Promise.all(
      courses.map((course) => examApi.getExamsByCourse(String(course.id), signal).catch(() => [] as Exam[])),
    );
    setExams(examLists.flat());
  };

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    void loadExams(controller.signal)
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(extractErrorMessage(err, 'Failed to load administrative exam controls.'));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  const runExamAction = async (examId: string, action: 'publish' | 'unpublish' | 'close' | 'delete') => {
    setError(null);

    try {
      if (action === 'publish') {
        await examApi.publishExam(examId);
      } else if (action === 'unpublish') {
        await examApi.unpublishExam(examId);
      } else if (action === 'close') {
        await examApi.closeExam(examId);
      } else {
        await examApi.deleteExam(examId);
      }

      await loadExams();
      showToast('success', 'Administrative action complete', `Exam action "${action}" completed successfully.`);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to complete the requested exam action.'));
    }
  };

  const inspectSandbox = async () => {
    if (!sandboxExamId || !sandboxStudentId) {
      return;
    }

    setError(null);
    setSandboxInfo('');

    try {
      const sandbox = await sandboxApi.getSandbox(sandboxExamId, sandboxStudentId);
      setSandboxInfo(JSON.stringify(sandbox, null, 2));
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load sandbox details.'));
    }
  };

  const destroySandbox = async () => {
    if (!sandboxExamId || !sandboxStudentId) {
      return;
    }

    setError(null);

    try {
      await sandboxApi.deleteSandbox(sandboxExamId, sandboxStudentId);
      setSandboxInfo('Sandbox deleted successfully.');
      showToast('success', 'Sandbox deleted', 'The selected sandbox was removed.');
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to delete the selected sandbox.'));
    }
  };

  if (loading) {
    return <div style={{ padding: '24px' }}>Loading admin controls...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>System Settings & Controls</h1>
        <p>Administrative controls backed by real exam and sandbox management endpoints.</p>
      </div>

      {error && <div style={{ marginBottom: '16px', color: '#e53e3e' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '22px' }}>
        <div className="content-card">
          <div className="content-card-header">
            <h2>Sandbox Inspector</h2>
          </div>
          <div className="content-card-body">
            <div style={{ display: 'grid', gap: '12px' }}>
              <input className="form-input" value={sandboxExamId} onChange={(event) => setSandboxExamId(event.target.value)} placeholder="Exam ID" />
              <input className="form-input" value={sandboxStudentId} onChange={(event) => setSandboxStudentId(event.target.value)} placeholder="Student ID" />
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-secondary" onClick={() => void inspectSandbox()}>Inspect</button>
                <button className="btn btn-secondary" onClick={() => void destroySandbox()}>Delete Sandbox</button>
              </div>
              <textarea className="form-input" value={sandboxInfo} readOnly style={{ minHeight: '220px', fontFamily: 'monospace' }} />
            </div>
          </div>
        </div>

        <div className="content-card">
          <div className="content-card-header">
            <h2>Runtime Notes</h2>
          </div>
          <div className="content-card-body">
            <p style={{ fontSize: '13px', color: '#666', lineHeight: 1.7 }}>
              The backend documentation available to the frontend exposes operational controls for exams and sandboxes, but not direct mutation APIs for JVM settings, query engine blocklists, or log streaming. This screen therefore limits itself to the secure controls the backend actually publishes.
            </p>
          </div>
        </div>

        <div className="content-card" style={{ gridColumn: '1 / -1' }}>
          <div className="content-card-header">
            <h2>Global Exam Administration</h2>
          </div>
          <div className="content-card-body" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Exam</th>
                  <th>Course</th>
                  <th>Status</th>
                  <th>Visibility</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {exams.map((exam) => (
                  <tr key={String(exam.id)}>
                    <td>{exam.title}</td>
                    <td>{getCourseName(exam.course, exam.courseId)}</td>
                    <td>{normalizeExamStatus(exam.status) || 'N/A'}</td>
                    <td>{String(exam.visibilityMode || 'N/A')}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {normalizeExamStatus(exam.status) === 'DRAFT' && (
                          <>
                            <button className="btn btn-sm btn-primary" onClick={() => void runExamAction(String(exam.id), 'publish')}>Publish</button>
                            <button className="btn btn-sm btn-secondary" onClick={() => void runExamAction(String(exam.id), 'delete')}>Delete</button>
                          </>
                        )}
                        {normalizeExamStatus(exam.status) === 'PUBLISHED' && (
                          <>
                            <button className="btn btn-sm btn-secondary" onClick={() => void runExamAction(String(exam.id), 'unpublish')}>Unpublish</button>
                            <button className="btn btn-sm btn-secondary" onClick={() => void runExamAction(String(exam.id), 'close')}>Close</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {exams.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: '#666' }}>
                      No exams are available for administrative control.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemSettings;
