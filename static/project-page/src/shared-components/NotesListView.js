import React from 'react';
import Button from '@atlaskit/button';
import Lozenge from '@atlaskit/lozenge';
import EmptyState from '@atlaskit/empty-state';
import { formatDate, isDeadlineApproaching, isDeadlinePassed } from './utils';
import './styles.css';

/**
 * Notes List View Component
 * Displays notes in a list format with action buttons
 */
const NotesListView = ({
  notes,
  onEdit,
  onDelete,
  onShare,
  onToggleStatus,
  currentUser,
  showIssueKey = false,
  onIssueClick
}) => {
  if (!notes || notes.length === 0) {
    return (
      <EmptyState
        header="No notes found"
        description="Create a new note to get started."
      />
    );
  }

  return (
    <div className="notes-list">
      {notes.map((note) => (
        <div key={note.id} className="note-card">
          <div className="note-header">
            <div className="note-title-row">
              <h3 className="note-title">{note.title}</h3>
              <div className="note-badges">
                {showIssueKey && note.issueKey && (
                  <Lozenge
                    appearance="default"
                    onClick={() => onIssueClick && onIssueClick(note.issueKey)}
                    style={{ cursor: onIssueClick ? 'pointer' : 'default' }}
                  >
                    {note.issueKey}
                  </Lozenge>
                )}
                <Lozenge appearance={note.status === 'completed' ? 'success' : 'default'}>
                  {note.status === 'completed' ? 'Completed' : 'Open'}
                </Lozenge>
                {note.isPublic && <Lozenge appearance="inprogress">Public</Lozenge>}
              </div>
            </div>
          </div>

          <div
            className="note-content"
            dangerouslySetInnerHTML={{ __html: note.content || '<em>No content</em>' }}
          />

          <div className="note-footer">
            <div className="note-meta">
              {note.deadline && (
                <div className="note-deadline-wrapper">
                  <Lozenge
                    appearance={
                      isDeadlinePassed(note.deadline)
                        ? 'removed'
                        : isDeadlineApproaching(note.deadline)
                        ? 'moved'
                        : 'default'
                    }
                  >
                    Deadline: {formatDate(note.deadline)}
                  </Lozenge>
                </div>
              )}
              <span>Updated: {formatDate(note.updatedAt)}</span>
            </div>

            <div className="note-actions">
              <Button
                appearance="subtle"
                onClick={() => onToggleStatus && onToggleStatus(note)}
              >
                {note.status === 'open' ? 'Mark Complete' : 'Reopen'}
              </Button>
              {note.permissions?.canEdit && (
                <Button appearance="subtle" onClick={() => onEdit && onEdit(note)}>
                  Edit
                </Button>
              )}
              {note.permissions?.isOwner && (
                <>
                  <Button appearance="subtle" onClick={() => onShare && onShare(note)}>
                    Share
                  </Button>
                  <Button
                    appearance="subtle"
                    onClick={() => onDelete && onDelete(note.id)}
                  >
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default NotesListView;
