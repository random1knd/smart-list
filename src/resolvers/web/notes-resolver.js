const Resolver = require('@forge/resolver').default;
const notesService = require('../../domain/services/notes-service');
const databaseService = require('../../infrastructure/database/database-service');

const resolver = new Resolver();

// Initialize database tables on first run
let dbInitialized = false;
async function ensureDbInitialized() {
  if (!dbInitialized) {
    try {
      await databaseService.initializeTables();
      dbInitialized = true;
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      // Don't set dbInitialized to true so it tries again next time
    }
  }
}

/**
 * Create a new note
 */
resolver.define('createNote', async (req) => {
  try {
    await ensureDbInitialized();

    const { issueKey, title, content, deadline, isPublic } = req.payload;
    const userId = req.context.accountId;

    const note = await notesService.createNote({
      issueKey,
      title,
      content,
      deadline,
      isPublic,
      userId
    });

    return { note, success: true };
  } catch (error) {
    console.error('Error in createNote resolver:', error);
    return { error: error.message, success: false };
  }
});

/**
 * Get a single note by ID
 */
resolver.define('getNoteById', async (req) => {
  try {
    await ensureDbInitialized();

    const { noteId } = req.payload;
    const userId = req.context.accountId;

    const note = await notesService.getNoteById(noteId, userId);

    return { note, success: true };
  } catch (error) {
    console.error('Error in getNoteById resolver:', error);
    return { error: error.message, success: false, note: null };
  }
});

/**
 * Get all notes for an issue that the user can access
 */
resolver.define('getNotesByIssue', async (req) => {
  try {
    await ensureDbInitialized();

    const userId = req.context.accountId;
    const issueKey = req.context.extension.issue.key;

    const notes = await notesService.getNotesByIssue(issueKey, userId);

    return { notes, success: true };
  } catch (error) {
    console.error('Error in getNotesByIssue resolver:', error);
    return { error: error.message, success: false, notes: [] };
  }
});

/**
 * Get all notes created by the current user
 */
resolver.define('getMyNotes', async (req) => {
  try {
    await ensureDbInitialized();

    const userId = req.context.accountId;

    const notes = await notesService.getMyNotes(userId);

    return { notes, success: true };
  } catch (error) {
    console.error('Error in getMyNotes resolver:', error);
    return { error: error.message, success: false, notes: [] };
  }
});

/**
 * Update a note
 */
resolver.define('updateNote', async (req) => {
  try {
    await ensureDbInitialized();

    const { noteId, title, content, deadline, isPublic, status } = req.payload;
    const userId = req.context.accountId;

    const note = await notesService.updateNote({
      noteId,
      title,
      content,
      deadline,
      isPublic,
      status,
      userId
    });

    return { note, success: true };
  } catch (error) {
    console.error('Error in updateNote resolver:', error);
    return { error: error.message, success: false };
  }
});

/**
 * Delete a note
 */
resolver.define('deleteNote', async (req) => {
  try {
    await ensureDbInitialized();

    const { noteId } = req.payload;
    const userId = req.context.accountId;

    const success = await notesService.deleteNote(noteId, userId);

    return { success };
  } catch (error) {
    console.error('Error in deleteNote resolver:', error);
    return { error: error.message, success: false };
  }
});

/**
 * Share a note with another user
 */
resolver.define('shareNote', async (req) => {
  try {
    await ensureDbInitialized();

    const { noteId, targetUserId, permissionType } = req.payload;
    const userId = req.context.accountId;

    const permission = await notesService.shareNote({
      noteId,
      targetUserId,
      permissionType,
      userId
    });

    return { permission, success: true };
  } catch (error) {
    console.error('Error in shareNote resolver:', error);
    return { error: error.message, success: false };
  }
});

/**
 * Revoke access to a note
 */
resolver.define('revokeAccess', async (req) => {
  try {
    await ensureDbInitialized();

    const { noteId, targetUserId } = req.payload;
    const userId = req.context.accountId;

    const success = await notesService.revokeAccess({
      noteId,
      targetUserId,
      userId
    });

    return { success };
  } catch (error) {
    console.error('Error in revokeAccess resolver:', error);
    return { error: error.message, success: false };
  }
});

/**
 * Get public notes for an issue (for activity panel)
 */
resolver.define('getPublicNotesByIssue', async (req) => {
  try {
    await ensureDbInitialized();

    const issueKey = req.context.extension.issue.key;

    const notes = await notesService.getPublicNotesByIssue(issueKey);

    return { notes, success: true };
  } catch (error) {
    console.error('Error in getPublicNotesByIssue resolver:', error);
    return { error: error.message, success: false, notes: [] };
  }
});

/**
 * Get users in the project (for sharing notes)
 */
resolver.define('getProjectUsers', async (req) => {
  try {
    const { issueKey } = req.payload;

    const users = await notesService.getProjectUsers(issueKey);

    return { users, success: true };
  } catch (error) {
    console.error('Error in getProjectUsers resolver:', error);
    return { error: error.message, success: false, users: [] };
  }
});

exports.handler = resolver.getDefinitions();
