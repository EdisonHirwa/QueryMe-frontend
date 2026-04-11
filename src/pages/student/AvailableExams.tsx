import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePublishedExams } from '../../hooks/usePublishedExams';
import { getCourseName, getExamTimeLimit } from '../../utils/queryme';

const AvailableExams: React.FC = () => {
  const navigate = useNavigate();
  const { data, loading, error, refresh } = usePublishedExams();
  const exams = data ?? [];

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <h1>Available Exams</h1>
          <p>Loading the exams currently visible to your account.</p>
        </div>
        <div style={{ textAlign: 'center', padding: '40px' }}>Loading exams...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="page-header">
          <h1>Available Exams</h1>
          <p>View and start the exams assigned to you.</p>
        </div>
        <div style={{ textAlign: 'center', padding: '40px', color: 'red' }}>
          <div>{error}</div>
          <button className="btn btn-primary" style={{ marginTop: '18px' }} onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Available Exams</h1>
        <p>These exams are loaded directly from the published exam feed.</p>
      </div>

      {exams.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          No published exams are currently visible to you.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '18px' }}>
          {exams.map((exam) => (
            <div key={String(exam.id)} className="content-card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="content-card-body" style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <span className="badge badge-green">Published</span>
                  <span style={{ fontSize: '11px', color: '#888' }}>
                    {exam.publishedAt ? new Date(exam.publishedAt).toLocaleDateString() : 'No publish date'}
                  </span>
                </div>

                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1a1a2e', margin: '0 0 6px' }}>{exam.title}</h3>
                <p style={{ fontSize: '12px', color: '#888', margin: '0 0 14px', lineHeight: 1.5 }}>
                  {exam.description || 'No description provided.'}
                </p>

                <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#666', marginBottom: '14px' }}>
                  <span>Course: {getCourseName(exam.course, exam.courseId)}</span>
                  <span>Visibility: {String(exam.visibilityMode || 'N/A')}</span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px', fontSize: '12px', color: '#888', padding: '10px 0', borderTop: '1px solid #f0f0f5' }}>
                  <span><strong style={{ color: '#333' }}>{getExamTimeLimit(exam) || 'N/A'}</strong> Min Time</span>
                  <span><strong style={{ color: '#333' }}>{exam.maxAttempts ?? 1}</strong> Max Attempts</span>
                </div>
              </div>

              <div style={{ padding: '0 22px 22px' }}>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => navigate(`/student/exam-session/${exam.id}`)}
                >
                  Start Exam
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AvailableExams;
