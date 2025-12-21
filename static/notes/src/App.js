import React, { useEffect, useState, useCallback } from 'react';
import { invoke, view } from '@forge/bridge';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

import Button from '@atlaskit/button';
import TextField from '@atlaskit/textfield';
import Select from '@atlaskit/select';
import { DateTimePicker } from '@atlaskit/datetime-picker';
import Toggle from '@atlaskit/toggle';
import Modal, {
  ModalTransition,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
} from '@atlaskit/modal-dialog';
import Spinner from '@atlaskit/spinner';
import Lozenge from '@atlaskit/lozenge';
import EmptyState from '@atlaskit/empty-state';
import SectionMessage from '@atlaskit/section-message';
import '@atlaskit/css-reset';

import './App.css';

// Generate time options in 5-minute intervals (00:00 to 23:55)
const generateTimeIntervals = () => {
  const times = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 5) {
      const h = hour.toString().padStart(2, '0');
      const m = minute.toString().padStart(2, '0');
      times.push(`${h}:${m}`);
    }
  }
  return times;
};

const TIME_INTERVALS_5MIN = generateTimeIntervals();

function App() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [issueKey, setIssueKey] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [theme, setTheme] = useState('light');

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);

  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [deadline, setDeadline] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Share modal states
  const [projectUsers, setProjectUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [permissionType, setPermissionType] = useState('read');
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Quill editor configuration with todo list support
  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }, { 'list': 'check' }],
      ['blockquote', 'code-block'],
      ['link'],
      ['clean']
    ]
  };

  const quillFormats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet', 'check',
    'blockquote', 'code-block',
    'link'
  ];

  // Fetch context and notes on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        const context = await view.getContext();
        console.log('Full context:', context);
        setIssueKey(context.extension.issue.key);
        setCurrentUser(context.accountId);
        
        // Get theme from context - try multiple possible locations
        let currentTheme = 'light';
        if (context.theme?.colorMode) {
          currentTheme = context.theme.colorMode;
          console.log('Theme from context.theme.colorMode:', currentTheme);
        } else if (context.theme?.themeMode) {
          currentTheme = context.theme.themeMode;
          console.log('Theme from context.theme.themeMode:', currentTheme);
        } else if (context.theme) {
          console.log('Theme object exists but no colorMode/themeMode:', context.theme);
        } else {
          console.log('No theme in context, using default light theme');
        }
        
        setTheme(currentTheme);
        
        // Apply theme to document root
        document.documentElement.setAttribute('data-theme', currentTheme);
        console.log('Applied theme:', currentTheme);
        
        await fetchNotes();
      } catch (err) {
        console.error('Failed to initialize:', err);
        setError('Failed to load notes. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };

    initialize();
    
    // Listen for theme changes
    try {
      if (view.theme && view.theme.onThemeChanged) {
        const themeListener = view.theme.onThemeChanged((newTheme) => {
          console.log('Theme changed:', newTheme);
          const mode = newTheme.colorMode || newTheme.themeMode || 'light';
          setTheme(mode);
          document.documentElement.setAttribute('data-theme', mode);
        });

        return () => {
          // Cleanup listener if available
          if (themeListener && typeof themeListener === 'function') {
            themeListener();
          }
        };
      }
    } catch (err) {
      console.log('Theme listener not available:', err);
    }
  }, []);

  const fetchNotes = useCallback(async () => {
    try {
      const response = await invoke('getNotesByIssue', {});
      setNotes(response.notes || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch notes:', err);
      setError('Failed to load notes.');
    }
  }, []);

  const fetchProjectUsers = async () => {
    setLoadingUsers(true);
    try {
      // This will be implemented in backend to fetch Jira project users
      const response = await invoke('getProjectUsers', { issueKey });
      setProjectUsers(
        response.users.map(user => ({
          label: user.displayName,
          value: user.accountId,
        }))
      );
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError('Failed to load project users.');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleCreateNote = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setSubmitting(true);
    try {
      await invoke('createNote', {
        issueKey,
        title,
        content,
        deadline: formatDeadlineForBackend(deadline),
        isPublic,
      });

      await fetchNotes();
      resetForm();
      setIsCreateModalOpen(false);
      setError(null);
    } catch (err) {
      console.error('Failed to create note:', err);
      setError('Failed to create note. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateNote = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setSubmitting(true);
    try {
      await invoke('updateNote', {
        noteId: selectedNote.id,
        title,
        content,
        deadline: formatDeadlineForBackend(deadline),
        isPublic,
      });

      await fetchNotes();
      resetForm();
      setIsEditModalOpen(false);
      setSelectedNote(null);
      setError(null);
    } catch (err) {
      console.error('Failed to update note:', err);
      setError('Failed to update note. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('Are you sure you want to delete this note?')) {
      return;
    }

    try {
      await invoke('deleteNote', { noteId });
      await fetchNotes();
      setError(null);
    } catch (err) {
      console.error('Failed to delete note:', err);
      setError('Failed to delete note. Please try again.');
    }
  };

  const handleToggleStatus = async (note) => {
    try {
      await invoke('updateNote', {
        noteId: note.id,
        status: note.status === 'open' ? 'completed' : 'open',
      });
      await fetchNotes();
      setError(null);
    } catch (err) {
      console.error('Failed to update status:', err);
      setError('Failed to update note status.');
    }
  };

  const handleShareNote = async () => {
    if (!selectedUsers || selectedUsers.length === 0) {
      setError('Please select at least one user');
      return;
    }

    setSubmitting(true);
    try {
      // Share with multiple users
      const userIds = selectedUsers.map(user => user.value);
      
      await invoke('shareNoteMultiple', {
        noteId: selectedNote.id,
        targetUserIds: userIds,
        permissionType,
      });

      setIsShareModalOpen(false);
      setSelectedNote(null);
      setSelectedUsers([]);
      setError(null);
    } catch (err) {
      console.error('Failed to share note:', err);
      setError('Failed to share note. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const openCreateModal = () => {
    resetForm();
    setIsCreateModalOpen(true);
  };

  const openEditModal = (note) => {
    console.log('Opening edit modal for note:', note);
    console.log('Note deadline value:', note.deadline);
    console.log('Note deadline type:', typeof note.deadline);
    
    setSelectedNote(note);
    setTitle(note.title);
    setContent(note.content);
    
    // Format deadline for DateTimePicker - it expects ISO 8601 format
    if (note.deadline) {
      // If deadline is already a valid ISO string, use it directly
      // Otherwise convert it to ISO format
      try {
        const deadlineDate = new Date(note.deadline);
        console.log('Parsed deadline date:', deadlineDate);
        console.log('Is valid date:', !isNaN(deadlineDate.getTime()));
        
        if (!isNaN(deadlineDate.getTime())) {
          const isoDeadline = deadlineDate.toISOString();
          console.log('Setting deadline to ISO format:', isoDeadline);
          setDeadline(isoDeadline);
        } else {
          console.log('Invalid date, setting to empty');
          setDeadline('');
        }
      } catch (e) {
        console.error('Invalid deadline format:', note.deadline, e);
        setDeadline('');
      }
    } else {
      console.log('No deadline on note, setting to empty');
      setDeadline('');
    }
    
    setIsPublic(!!note.isPublic); // Convert to boolean (handles 0/1 from database)
    setIsEditModalOpen(true);
  };

  const openShareModal = async (note) => {
    setSelectedNote(note);
    setIsShareModalOpen(true);
    await fetchProjectUsers();
  };

  const resetForm = () => {
    setTitle('');
    setContent('');
    setDeadline('');
    setIsPublic(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  // Helper function to format deadline for MySQL TIMESTAMP
  const formatDeadlineForBackend = (deadlineString) => {
    if (!deadlineString) return null;
    
    try {
      // Parse the date string (handles various formats including ISO with timezone)
      const date = new Date(deadlineString);
      
      if (isNaN(date.getTime())) {
        console.error('Invalid deadline date:', deadlineString);
        return null;
      }
      
      // Format as MySQL TIMESTAMP: YYYY-MM-DD HH:MM:SS
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      
      const formatted = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      console.log('Formatted deadline for backend:', formatted);
      return formatted;
    } catch (e) {
      console.error('Error formatting deadline:', e);
      return null;
    }
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

  if (loading) {
    return (
      <div className="loading-container">
        <Spinner size="large" />
        <p>Loading notes...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="header">
        <h2>Private Notes</h2>
        <Button appearance="primary" onClick={openCreateModal}>
          Create Note
        </Button>
      </div>

      {error && (
        <SectionMessage appearance="error">
          <p>{error}</p>
        </SectionMessage>
      )}

      {notes.length === 0 ? (
        <EmptyState
          header="No notes yet"
          description="Create your first private note for this issue"
          primaryAction={
            <Button appearance="primary" onClick={openCreateModal}>
              Create Note
            </Button>
          }
        />
      ) : (
        <div className="notes-list">
          {notes.map((note) => (
            <div key={note.id} className="note-card">
              <div className="note-header">
                <div className="note-title-row">
                  <h3>{note.title}</h3>
                  <div className="note-badges">
                    {!!note.isPublic && (
                      <Lozenge appearance="success">Public</Lozenge>
                    )}
                    {note.status === 'completed' && (
                      <Lozenge appearance="default">Completed</Lozenge>
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
                        {formatDate(note.deadline)}
                      </Lozenge>
                    )}
                  </div>
                </div>
                <div className="note-meta">
                  <span>Updated: {formatDate(note.updatedAt)}</span>
                </div>
              </div>

              <div className="note-content ql-editor">
                <div dangerouslySetInnerHTML={{ __html: note.content }} />
              </div>

              <div className="note-actions">
                <Button
                  appearance="subtle"
                  onClick={() => handleToggleStatus(note)}
                >
                  {note.status === 'open' ? 'Mark Complete' : 'Reopen'}
                </Button>
                
                {/* Edit button - show if user has write permissions or is owner */}
                {(note.permissions?.canEdit || note.permissions?.isOwner) && (
                  <Button
                    appearance="subtle"
                    onClick={() => openEditModal(note)}
                  >
                    Edit
                  </Button>
                )}

                {/* Share and Delete - only for owners */}
                {note.permissions?.isOwner && (
                  <>
                    <Button
                      appearance="subtle"
                      onClick={() => openShareModal(note)}
                    >
                      Share
                    </Button>
                    <Button
                      appearance="danger"
                      onClick={() => handleDeleteNote(note.id)}
                    >
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Note Modal */}
      <ModalTransition>
        {isCreateModalOpen && (
          <Modal onClose={() => setIsCreateModalOpen(false)} width="large">
            <ModalHeader>
              <ModalTitle>Create New Note</ModalTitle>
            </ModalHeader>
            <ModalBody>
              <div className="form-field">
                <label htmlFor="title">Title *</label>
                <TextField
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter note title"
                  isRequired
                />
              </div>

              <div className="form-field">
                <label htmlFor="content">Content</label>
                <ReactQuill
                  theme="snow"
                  value={content}
                  onChange={setContent}
                  modules={quillModules}
                  formats={quillFormats}
                  placeholder="Start writing your note..."
                  style={{ height: '200px', marginBottom: '50px' }}
                />
              </div>

              <div className="form-field">
                <label htmlFor="deadline">Deadline</label>
                <DateTimePicker
                  id="deadline"
                  value={deadline}
                  onChange={setDeadline}
                  placeholder="Select deadline"
                  datePickerProps={{
                    minDate: new Date().toISOString().split('T')[0]
                  }}
                  timePickerProps={{
                    times: TIME_INTERVALS_5MIN
                  }}
                />
              </div>

              <div className="form-field">
                <Toggle
                  id="isPublic"
                  isChecked={isPublic}
                  onChange={() => setIsPublic(!isPublic)}
                  label="Make this note public (visible in activity feed)"
                />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                appearance="subtle"
                onClick={() => setIsCreateModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                appearance="primary"
                onClick={handleCreateNote}
                isDisabled={submitting}
              >
                {submitting ? 'Creating...' : 'Create'}
              </Button>
            </ModalFooter>
          </Modal>
        )}
      </ModalTransition>

      {/* Edit Note Modal */}
      <ModalTransition>
        {isEditModalOpen && (
          <Modal onClose={() => setIsEditModalOpen(false)} width="large">
            <ModalHeader>
              <ModalTitle>Edit Note</ModalTitle>
            </ModalHeader>
            <ModalBody>
              <div className="form-field">
                <label htmlFor="edit-title">Title *</label>
                <TextField
                  id="edit-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter note title"
                  isRequired
                />
              </div>

              <div className="form-field">
                <label htmlFor="edit-content">Content</label>
                <ReactQuill
                  theme="snow"
                  value={content}
                  onChange={setContent}
                  modules={quillModules}
                  formats={quillFormats}
                  placeholder="Start writing your note..."
                  style={{ height: '200px', marginBottom: '50px' }}
                />
              </div>

              <div className="form-field">
                <label htmlFor="edit-deadline">Deadline</label>
                <DateTimePicker
                  id="edit-deadline"
                  value={deadline}
                  onChange={setDeadline}
                  placeholder="Select deadline"
                  datePickerProps={{
                    minDate: new Date().toISOString().split('T')[0]
                  }}
                  timePickerProps={{
                    times: TIME_INTERVALS_5MIN
                  }}
                />
              </div>

              <div className="form-field">
                <Toggle
                  id="edit-isPublic"
                  isChecked={isPublic}
                  onChange={() => setIsPublic(!isPublic)}
                  label="Make this note public (visible in activity feed)"
                />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                appearance="subtle"
                onClick={() => setIsEditModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                appearance="primary"
                onClick={handleUpdateNote}
                isDisabled={submitting}
              >
                {submitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </ModalFooter>
          </Modal>
        )}
      </ModalTransition>

      {/* Share Note Modal */}
      <ModalTransition>
        {isShareModalOpen && (
          <Modal onClose={() => setIsShareModalOpen(false)} width="medium">
            <ModalHeader>
              <ModalTitle>Share Note</ModalTitle>
            </ModalHeader>
            <ModalBody>
              <div className="form-field">
                <label htmlFor="user-select">Select Users</label>
                {loadingUsers ? (
                  <Spinner size="medium" />
                ) : (
                  <Select
                    inputId="user-select"
                    options={projectUsers}
                    value={selectedUsers}
                    onChange={setSelectedUsers}
                    placeholder="Choose users to share with"
                    isMulti={true}
                  />
                )}
              </div>

              <div className="form-field">
                <label htmlFor="permission-select">Permission Type</label>
                <Select
                  inputId="permission-select"
                  options={[
                    { label: 'Read Only', value: 'read' },
                    { label: 'Read & Write', value: 'write' },
                  ]}
                  value={{ label: permissionType === 'read' ? 'Read Only' : 'Read & Write', value: permissionType }}
                  onChange={(option) => setPermissionType(option.value)}
                />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                appearance="subtle"
                onClick={() => setIsShareModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                appearance="primary"
                onClick={handleShareNote}
                isDisabled={submitting}
              >
                {submitting ? 'Sharing...' : 'Share'}
              </Button>
            </ModalFooter>
          </Modal>
        )}
      </ModalTransition>
    </div>
  );
}

export default App;
