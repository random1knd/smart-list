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
import SectionMessage from '@atlaskit/section-message';

// Shared components
import StatisticsPanel from './shared-components/StatisticsPanel';
import FilterBar from './shared-components/FilterBar';
import NotesListView from './shared-components/NotesListView';
import CalendarView from './shared-components/CalendarView';
import {
  formatDeadlineForBackend,
  filterNotesByType,
  TIME_INTERVALS_5MIN
} from './shared-components/utils';

import './App.css';

// CKEditor configuration
const editorConfig = {
  toolbar: [
    'undo', 'redo', '|',
    'heading', '|',
    'bold', 'italic', '|',
    'link', 'blockQuote', '|',
    'bulletedList', 'numberedList', '|',
    'insertTable'
  ],
  placeholder: 'Start writing your note...'
};

function App() {
  const [notes, setNotes] = useState([]);
  const [filteredNotes, setFilteredNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [theme, setTheme] = useState('light');
  const [statistics, setStatistics] = useState(null);

  // View and filter states
  const [activeView, setActiveView] = useState('list'); // 'list' or 'calendar'
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'mine', 'shared'

  // Modal states
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

  // Initialize app
  useEffect(() => {
    const initialize = async () => {
      try {
        const context = await view.getContext();
        console.log('Global page context:', context);

        setCurrentUser(context.accountId);

        // Get theme
        let currentTheme = 'light';
        if (context.theme?.colorMode) {
          currentTheme = context.theme.colorMode;
        }
        setTheme(currentTheme);
        document.documentElement.setAttribute('data-theme', currentTheme);

        await fetchGlobalData();
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
          const mode = newTheme.colorMode || 'light';
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
      console.log('Theme listener not available:', err);
    }
  }, []);

  const fetchGlobalData = useCallback(async () => {
    try {
      // Fetch notes and statistics in parallel
      const [notesResponse, statsResponse] = await Promise.all([
        invoke('getGlobalNotes'),
        invoke('getGlobalStatistics')
      ]);

      setNotes(notesResponse.notes || []);
      setStatistics(statsResponse.statistics || null);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch global data:', err);
      setError('Failed to load notes.');
    }
  }, []);

  // Apply filters when notes or filter changes
  useEffect(() => {
    if (!notes || !currentUser) {
      setFilteredNotes([]);
      return;
    }
    const filtered = filterNotesByType(notes, activeFilter, currentUser);
    setFilteredNotes(filtered);
  }, [notes, activeFilter, currentUser]);

  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
  };

  const handleIssueClick = async (issueKey) => {
    try {
      // Open the issue in Jira
      await view.openIssue(issueKey);
    } catch (err) {
      console.error('Failed to open issue:', err);
    }
  };

  const handleEditNote = (note) => {
    setSelectedNote(note);
    setTitle(note.title);
    setContent(note.content);
    setDeadline(note.deadline || '');
    setIsPublic(note.isPublic);
    setIsEditModalOpen(true);
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

      await fetchGlobalData();
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
      await fetchGlobalData();
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
      await fetchGlobalData();
      setError(null);
    } catch (err) {
      console.error('Failed to toggle status:', err);
      setError('Failed to update note status.');
    }
  };

  const handleShareNote = (note) => {
    setSelectedNote(note);
    setIsShareModalOpen(true);
    fetchProjectUsersForSharing(note.issueKey);
  };

  const fetchProjectUsersForSharing = async (issueKey) => {
    setLoadingUsers(true);
    try {
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

  const handleShareSubmit = async () => {
    if (selectedUsers.length === 0) {
      setError('Please select at least one user to share with');
      return;
    }

    setSubmitting(true);
    try {
      await invoke('shareNoteMultiple', {
        noteId: selectedNote.id,
        targetUserIds: selectedUsers.map(u => u.value),
        permissionType,
      });

      setIsShareModalOpen(false);
      setSelectedNote(null);
      setSelectedUsers([]);
      setPermissionType('read');
      setError(null);
    } catch (err) {
      console.error('Failed to share note:', err);
      setError('Failed to share note. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setContent('');
    setDeadline('');
    setIsPublic(false);
  };

  const handleSelectNoteFromCalendar = (note) => {
    handleEditNote(note);
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
        <h2>Global Notes</h2>
        <div className="view-toggle-buttons">
          <Button
            appearance={activeView === 'list' ? 'primary' : 'subtle'}
            onClick={() => setActiveView('list')}
          >
            List View
          </Button>
          <Button
            appearance={activeView === 'calendar' ? 'primary' : 'subtle'}
            onClick={() => setActiveView('calendar')}
          >
            Calendar View
          </Button>
        </div>
      </div>

      {error && (
        <SectionMessage appearance="error">
          <p>{error}</p>
        </SectionMessage>
      )}

      {/* Statistics Panel */}
      <StatisticsPanel statistics={statistics} />

      {/* Filter Bar */}
      <FilterBar activeFilter={activeFilter} onFilterChange={handleFilterChange} />

      {/* Content Area - List or Calendar */}
      {activeView === 'list' ? (
        <NotesListView
          notes={filteredNotes}
          onEdit={handleEditNote}
          onDelete={handleDeleteNote}
          onShare={handleShareNote}
          onToggleStatus={handleToggleStatus}
          currentUser={currentUser}
          showIssueKey={true}
          onIssueClick={handleIssueClick}
        />
      ) : (
        <CalendarView
          notes={filteredNotes}
          onSelectNote={handleSelectNoteFromCalendar}
        />
      )}

      {/* Edit Note Modal */}
      <ModalTransition>
        {isEditModalOpen && (
          <Modal onClose={() => setIsEditModalOpen(false)}>
            <ModalHeader>
              <ModalTitle>Edit Note</ModalTitle>
            </ModalHeader>
            <ModalBody>
              <div className="form-field">
                <label htmlFor="title">Title *</label>
                <TextField
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter note title"
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
                  times={TIME_INTERVALS_5MIN}
                  dateFormat="YYYY-MM-DD"
                  timeFormat="HH:mm"
                  placeholder="Select deadline"
                />
              </div>

              <div className="form-field">
                <label htmlFor="public-toggle">
                  <Toggle
                    id="public-toggle"
                    isChecked={isPublic}
                    onChange={() => setIsPublic(!isPublic)}
                  />
                  <span style={{ marginLeft: '8px' }}>Make this note public</span>
                </label>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button appearance="subtle" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button
                appearance="primary"
                onClick={handleUpdateNote}
                isDisabled={submitting}
              >
                {submitting ? 'Updating...' : 'Update Note'}
              </Button>
            </ModalFooter>
          </Modal>
        )}
      </ModalTransition>

      {/* Share Note Modal */}
      <ModalTransition>
        {isShareModalOpen && (
          <Modal onClose={() => setIsShareModalOpen(false)}>
            <ModalHeader>
              <ModalTitle>Share Note</ModalTitle>
            </ModalHeader>
            <ModalBody>
              <div className="form-field">
                <label htmlFor="users">Select Users</label>
                {loadingUsers ? (
                  <Spinner size="small" />
                ) : (
                  <Select
                    inputId="users"
                    isMulti
                    options={projectUsers}
                    value={selectedUsers}
                    onChange={setSelectedUsers}
                    placeholder="Select users to share with"
                  />
                )}
              </div>

              <div className="form-field">
                <label htmlFor="permission">Permission Type</label>
                <Select
                  inputId="permission"
                  options={[
                    { label: 'Read Only', value: 'read' },
                    { label: 'Can Edit', value: 'write' },
                  ]}
                  value={{ label: permissionType === 'read' ? 'Read Only' : 'Can Edit', value: permissionType }}
                  onChange={(option) => setPermissionType(option.value)}
                />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button appearance="subtle" onClick={() => setIsShareModalOpen(false)}>
                Cancel
              </Button>
              <Button
                appearance="primary"
                onClick={handleShareSubmit}
                isDisabled={submitting || selectedUsers.length === 0}
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
