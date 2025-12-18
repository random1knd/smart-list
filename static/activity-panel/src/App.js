import React, { useEffect, useState } from 'react';
import { invoke, view } from '@forge/bridge';
import Spinner from '@atlaskit/spinner';
import Lozenge from '@atlaskit/lozenge';
import EmptyState from '@atlaskit/empty-state';
import '@atlaskit/css-reset';
import './App.css';

function App() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        const context = await view.getContext();
        const issueKey = context.extension.issue.key;

        // Fetch public notes for this issue
        const response = await invoke('getPublicNotesByIssue', { issueKey });
        setNotes(response.notes || []);
      } catch (err) {
        console.error('Failed to load public notes:', err);
        setError('Failed to load notes.');
      } finally {
        setLoading(false);
      }
    };

    initialize();
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

  const isDeadlineApproaching = (deadlineString) => {
    if (!deadlineString) return false;
    const deadline = new Date(deadlineString);
    const now = new Date();
    const daysDiff = (deadline - now) / (1000 * 60 * 60 * 24);
    return daysDiff <= 2 && daysDiff > 0;
  };

  const isDeadlinePassed = (deadlineString) => {
    if (!deadlineString) return false;
    const deadline = new Date(deadlineString);
    return deadline < new Date();
  };

  const getDeadlineText = (deadlineString) => {
    if (!deadlineString) return null;
    const deadline = new Date(deadlineString);
    return deadline.toLocaleDateString() + ' ' + deadline.toLocaleTimeString();
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

  if (notes.length === 0) {
    return (
      <div className="activity-empty">
        <EmptyState
          header="No public notes"
          description="Public notes will appear here when created"
          size="narrow"
        />
      </div>
    );
  }

  return (
    <div className="activity-container">
      {notes.map((note) => (
        <div key={note.id} className="activity-note">
          <div className="activity-header">
            <div className="activity-title">
              <strong>{note.title}</strong>
            </div>
            <div className="activity-badges">
              {note.status === 'completed' && (
                <Lozenge appearance="success">Completed</Lozenge>
              )}
              {note.deadline && (
                <Lozenge
                  appearance={
                    isDeadlinePassed(note.deadline)
                      ? 'removed'
                      : isDeadlineApproaching(note.deadline)
                      ? 'moved'
                      : 'default'
                  }
                >
                  {getDeadlineText(note.deadline)}
                </Lozenge>
              )}
            </div>
          </div>

          <div
            className="activity-content"
            dangerouslySetInnerHTML={{ __html: note.content }}
          />

          <div className="activity-meta">
            <span className="activity-time">
              {formatDate(note.createdAt)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default App;
