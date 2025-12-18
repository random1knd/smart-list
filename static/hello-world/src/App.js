import React, { useEffect, useState, useCallback } from 'react';
import { invoke, view } from '@forge/bridge';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic';

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

function App() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [issueKey, setIssueKey] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

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
  const [selectedUser, setSelectedUser] = useState(null);
  const [permissionType, setPermissionType] = useState('read');
  const [loadingUsers, setLoadingUsers] = useState(false);

  // CKEditor configuration
  // const editorConfig = {
  //   toolbar: [
  //     'undo', 'redo', '|',
  //     'heading', '|',
  //     'bold', 'italic', '|',
  //     'link', 'blockQuote', '|',
  //     'bulletedList', 'numberedList', '|',
  //     'insertTable'
  //   ],
  //   placeholder: 'Start writing your note...'
  // };
  const editorConfig = {
    licenseKey: 'GPL', // Using GPL license for open source
    toolbar: [
      'undo', 'redo', '|',
      'heading', '|',
      'bold', 'italic', '|',
      'link', 'blockQuote', '|',
      'bulletedList', 'numberedList', 'todoList', '|',
      'insertTable'
    ],
    placeholder: 'Start writing your note...'
  };

  // Fetch context and notes on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        const context = await view.getContext();
        setIssueKey(context.extension.issue.key);
        setCurrentUser(context.accountId);
        await fetchNotes();
      } catch (err) {
        console.error('Failed to initialize:', err);
        setError('Failed to load notes. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };

    initialize();
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
        deadline: deadline || null,
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
        deadline: deadline || null,
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
    if (!selectedUser) {
      setError('Please select a user');
      return;
    }

    setSubmitting(true);
    try {
      await invoke('shareNote', {
        noteId: selectedNote.id,
        targetUserId: selectedUser.value,
        permissionType,
      });

      setIsShareModalOpen(false);
      setSelectedNote(null);
      setSelectedUser(null);
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
    setSelectedNote(note);
    setTitle(note.title);
    setContent(note.content);
    setDeadline(note.deadline || '');
    setIsPublic(note.isPublic);
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
                    {note.isPublic && (
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

              <div
                className="note-content"
                dangerouslySetInnerHTML={{ __html: note.content }}
              />

              <div className="note-actions">
                <Button
                  appearance="subtle"
                  onClick={() => handleToggleStatus(note)}
                >
                  {note.status === 'open' ? 'Mark Complete' : 'Reopen'}
                </Button>
                {note.created_by === currentUser && (
                  <>
                    <Button
                      appearance="subtle"
                      onClick={() => openEditModal(note)}
                    >
                      Edit
                    </Button>
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
                <CKEditor
                  editor={ClassicEditor}
                  config={editorConfig}
                  data={content}
                  onChange={(event, editor) => {
                    const data = editor.getData();
                    setContent(data);
                  }}
                />
              </div>

              <div className="form-field">
                <label htmlFor="deadline">Deadline</label>
                <DateTimePicker
                  id="deadline"
                  value={deadline}
                  onChange={setDeadline}
                  placeholder="Select deadline"
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
                isLoading={submitting}
              >
                Create
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
                <CKEditor
                  editor={ClassicEditor}
                  config={editorConfig}
                  data={content}
                  onChange={(event, editor) => {
                    const data = editor.getData();
                    setContent(data);
                  }}
                />
              </div>

              <div className="form-field">
                <label htmlFor="edit-deadline">Deadline</label>
                <DateTimePicker
                  id="edit-deadline"
                  value={deadline}
                  onChange={setDeadline}
                  placeholder="Select deadline"
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
                isLoading={submitting}
              >
                Save Changes
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
                <label htmlFor="user-select">Select User</label>
                {loadingUsers ? (
                  <Spinner size="medium" />
                ) : (
                  <Select
                    inputId="user-select"
                    options={projectUsers}
                    value={selectedUser}
                    onChange={setSelectedUser}
                    placeholder="Choose a user"
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
                isLoading={submitting}
              >
                Share
              </Button>
            </ModalFooter>
          </Modal>
        )}
      </ModalTransition>
    </div>
  );
}

export default App;
