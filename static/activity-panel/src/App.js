import React, { useEffect, useState } from 'react';
import { invoke, view } from '@forge/bridge';
import Spinner from '@atlaskit/spinner';
import Lozenge from '@atlaskit/lozenge';
import EmptyState from '@atlaskit/empty-state';
import '@atlaskit/css-reset';
import './App.css';

function App() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const initialize = async () => {
      try {
        const context = await view.getContext();
        const issueKey = context.extension.issue.key;

        // Get and apply theme from context
        let currentTheme = 'light';
        if (context.theme?.colorMode) {
          currentTheme = context.theme.colorMode;
        } else if (context.theme?.themeMode) {
          currentTheme = context.theme.themeMode;
        }
        setTheme(currentTheme);
        document.documentElement.setAttribute('data-theme', currentTheme);

        // Fetch public note activities for this issue
        const response = await invoke('getPublicNoteActivities', { issueKey });
        setActivities(response.activities || []);
      } catch (err) {
        console.error('Failed to load activities:', err);
        setError('Failed to load activities.');
      } finally {
        setLoading(false);
      }
    };

    initialize();

    // Listen for theme changes
    try {
      if (view.theme && view.theme.onThemeChanged) {
        const themeListener = view.theme.onThemeChanged((newTheme) => {
          const mode = newTheme.colorMode || newTheme.themeMode || 'light';
          setTheme(mode);
          document.documentElement.setAttribute('data-theme', mode);
        });

        return () => {
          if (themeListener && typeof themeListener === 'function') {
            themeListener();
          }
        };
      }
    } catch (err) {
      console.log('Theme change listener not available:', err);
    }
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString();
  };

  const getActivityText = (activity) => {
    const action = activity.action === 'created' ? 'created' : 'updated';
    return `${action} a public note`;
  };

  if (loading) {
    return (
      <div className="activity-loading">
        <Spinner size="medium" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="activity-error">
        <p>{error}</p>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="activity-empty">
        <EmptyState
          header="No activity yet"
          description="Activity for public notes will appear here"
          size="narrow"
        />
      </div>
    );
  }

  return (
    <div className="activity-container">
      {activities.map((activity) => (
        <div key={activity.id} className="activity-item">
          <div className="activity-header">
            <div className="activity-user">
              <strong>{activity.userName}</strong>
            </div>
            <div className="activity-time">
              {formatDate(activity.timestamp)}
            </div>
          </div>
          
          <div className="activity-description">
            {getActivityText(activity)}
            {activity.noteTitle && (
              <span className="activity-note-title">: <em>{activity.noteTitle}</em></span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default App;
