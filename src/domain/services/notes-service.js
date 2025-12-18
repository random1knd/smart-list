const databaseService = require('../../infrastructure/database/database-service');
const api = require('@forge/api');

/**
 * Notes service - handles business logic for notes
 */
class NotesService {
  /**
   * Create a new note
   */
  async createNote({ issueKey, title, content, deadline, isPublic, userId }) {
    if (!title || !title.trim()) {
      throw new Error('Title is required');
    }

    if (!issueKey) {
      throw new Error('Issue key is required');
    }

    const note = await databaseService.createNote({
      issueKey,
      title: title.trim(),
      content: content || '',
      createdBy: userId,
      deadline: deadline || null,
      isPublic: isPublic || false
    });

    return note;
  }

  /**
   * Get a note by ID (with permission check)
   */
  async getNoteById(noteId, userId) {
    const hasAccess = await databaseService.hasPermission(noteId, userId, 'read');

    if (!hasAccess) {
      throw new Error('Access denied');
    }

    return await databaseService.getNoteById(noteId);
  }

  /**
   * Get all notes for an issue that the user can access
   */
  async getNotesByIssue(issueKey, userId) {
    return await databaseService.getNotesByIssue(issueKey, userId);
  }

  /**
   * Get all notes created by the user
   */
  async getMyNotes(userId) {
    return await databaseService.getMyNotes(userId);
  }

  /**
   * Update a note (with permission check)
   */
  async updateNote({ noteId, title, content, deadline, isPublic, status, userId }) {
    const hasAccess = await databaseService.hasPermission(noteId, userId, 'write');

    if (!hasAccess) {
      throw new Error('Access denied - write permission required');
    }

    const updates = {};

    if (title !== undefined) {
      if (!title.trim()) {
        throw new Error('Title cannot be empty');
      }
      updates.title = title.trim();
    }

    if (content !== undefined) {
      updates.content = content;
    }

    if (deadline !== undefined) {
      updates.deadline = deadline;
    }

    if (isPublic !== undefined) {
      updates.isPublic = isPublic;
    }

    if (status !== undefined) {
      if (!['open', 'completed'].includes(status)) {
        throw new Error('Invalid status');
      }
      updates.status = status;
    }

    return await databaseService.updateNote(noteId, updates);
  }

  /**
   * Delete a note (owner only)
   */
  async deleteNote(noteId, userId) {
    const note = await databaseService.getNoteById(noteId);

    if (!note) {
      throw new Error('Note not found');
    }

    if (note.created_by !== userId) {
      throw new Error('Only the note owner can delete it');
    }

    return await databaseService.deleteNote(noteId);
  }

  /**
   * Share a note with another user (owner only)
   */
  async shareNote({ noteId, targetUserId, permissionType, userId }) {
    const note = await databaseService.getNoteById(noteId);

    if (!note) {
      throw new Error('Note not found');
    }

    if (note.created_by !== userId) {
      throw new Error('Only the note owner can share it');
    }

    if (!['read', 'write'].includes(permissionType)) {
      throw new Error('Invalid permission type');
    }

    return await databaseService.shareNote({
      noteId,
      targetUserId,
      permissionType,
      grantedBy: userId
    });
  }

  /**
   * Revoke access to a note (owner only)
   */
  async revokeAccess({ noteId, targetUserId, userId }) {
    const note = await databaseService.getNoteById(noteId);

    if (!note) {
      throw new Error('Note not found');
    }

    if (note.created_by !== userId) {
      throw new Error('Only the note owner can revoke access');
    }

    return await databaseService.revokeAccess(noteId, targetUserId);
  }

  /**
   * Get public notes for an issue (for activity panel)
   */
  async getPublicNotesByIssue(issueKey) {
    return await databaseService.getPublicNotesByIssue(issueKey);
  }

  /**
   * Get users in the project (for sharing)
   */
  async getProjectUsers(issueKey) {
    try {
      console.log('getProjectUsers called with issueKey:', issueKey);
      
      // Get the issue to find the project key - use asUser() for proper permissions
      const issueResponse = await api.asUser().requestJira(api.route`/rest/api/3/issue/${issueKey}`, {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!issueResponse.ok) {
        throw new Error(`Failed to fetch issue: ${issueResponse.status} ${issueResponse.statusText}`);
      }

      const issue = await issueResponse.json();
      console.log('Issue response:', JSON.stringify(issue, null, 2));

      // Check if the issue has the expected structure
      if (!issue || !issue.fields || !issue.fields.project) {
        console.error('Invalid issue structure:', issue);
        throw new Error('Issue does not contain project information');
      }

      const projectKey = issue.fields.project.key;
      console.log('Project key:', projectKey);

      // Get users who can browse the project - use asUser() for proper permissions
      const usersResponse = await api.asUser().requestJira(api.route`/rest/api/3/user/assignable/search?project=${projectKey}`, {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!usersResponse.ok) {
        throw new Error(`Failed to fetch users: ${usersResponse.status} ${usersResponse.statusText}`);
      }

      const users = await usersResponse.json();
      console.log('Users response:', JSON.stringify(users, null, 2));

      return users.map(user => ({
        accountId: user.accountId,
        displayName: user.displayName,
        avatarUrl: user.avatarUrls ? user.avatarUrls['48x48'] : null
      }));
    } catch (error) {
      console.error('Error fetching project users:', error);
      throw new Error('Failed to fetch project users');
    }
  }
}

module.exports = new NotesService();
