import React from 'react';
import './styles.css';

/**
 * Statistics Panel Component
 * Displays summary statistics for notes
 */
const StatisticsPanel = ({ statistics }) => {
  if (!statistics) {
    return null;
  }

  return (
    <div className="statistics-panel">
      <div className="stat-card">
        <div className="stat-value">{statistics.totalCount || 0}</div>
        <div className="stat-label">Total Notes</div>
      </div>
      <div className="stat-card">
        <div className="stat-value">{statistics.myCount || 0}</div>
        <div className="stat-label">My Notes</div>
      </div>
      <div className="stat-card">
        <div className="stat-value">{statistics.sharedCount || 0}</div>
        <div className="stat-label">Shared with Me</div>
      </div>
      <div className="stat-card">
        <div className="stat-value">{statistics.upcomingDeadlines || 0}</div>
        <div className="stat-label">Upcoming Deadlines</div>
      </div>
    </div>
  );
};

export default StatisticsPanel;
