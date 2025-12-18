/**
 * Main entry point for Private Notes Forge app
 * Exports all resolver handlers
 */

const Resolver = require('@forge/resolver').default;
const notesService = require('./domain/services/notes-service');
const { ensureMigrationsApplied } = require('./migrations/runner');

const resolver = new Resolver();

// Ensure database migrations are applied on first use
let migrationsChecked = false;
async function ensureDbInitialized() {
  if (!migrationsChecked) {
    try {
      await ensureMigrationsApplied();
      migrationsChecked = true;
      console.log('Database migrations check completed');
    } catch (error) {
      console.error('Database migrations failed:', error);
      throw error;
    }
  }
}

// ===== Notes Resolvers =====

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

// ===== Notification Resolvers (placeholders) =====

resolver.define('getMyNotifications', async (req) => {
  try {
    const userId = req.context.accountId;
    return { notifications: [], success: true };
  } catch (error) {
    console.error('Error in getMyNotifications resolver:', error);
    return { error: error.message, success: false, notifications: [] };
  }
});

resolver.define('markNotificationAsRead', async (req) => {
  try {
    const { notificationId } = req.payload;
    const userId = req.context.accountId;
    return { success: true };
  } catch (error) {
    console.error('Error in markNotificationAsRead resolver:', error);
    return { error: error.message, success: false };
  }
});

resolver.define('markAllAsRead', async (req) => {
  try {
    const userId = req.context.accountId;
    return { success: true };
  } catch (error) {
    console.error('Error in markAllAsRead resolver:', error);
    return { error: error.message, success: false };
  }
});

exports.handler = resolver.getDefinitions();
