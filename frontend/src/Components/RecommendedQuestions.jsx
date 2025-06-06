import React from 'react';
import mockRecommendedQuestions from '../mockRecommendedQuestions';

const RecommendedQuestions = () => (
  <div style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'sans-serif' }}>
    <h2 style={{ textAlign: 'center', marginBottom: 24 }}>Recommended Questions (Mock Data)</h2>
    <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px #eee' }}>
      <thead>
        <tr style={{ background: '#f0f0f0' }}>
          <th>Topic</th>
          <th>Question</th>
          <th>Difficulty</th>
          <th>Priority</th>
          <th>Link</th>
        </tr>
      </thead>
      <tbody>
        {mockRecommendedQuestions.map(q => (
          <tr key={q._id}>
            <td>{q.topic}</td>
            <td>{q.question}</td>
            <td>{q.difficultylevel}</td>
            <td>{q.priority}</td>
            <td>
              <a href={q.link} target="_blank" rel="noopener noreferrer">View</a>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default RecommendedQuestions;
