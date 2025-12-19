const databaseService = require('../../infrastructure/database/database-service');
const notificationService = require('./notification-service');
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

    // Create deadline notification if deadline is set
    if (deadline) {
      try {
        await notificationService.createDeadlineNotification(note.id, deadline, userId, issueKey);
      } catch (error) {
        console.error('Failed to create notification:', error);
        // Don't fail the note creation if notification fails
      }
    }

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

    const note = await databaseService.getNoteById(noteId);
    if (!note) {
      throw new Error('Note not found');
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

    const updatedNote = await databaseService.updateNote(noteId, updates);

    // Update notifications if deadline changed
    if (deadline !== undefined) {
      try {
        await notificationService.updateNotificationsForDeadline(
          noteId, 
          deadline, 
          note.created_by, 
          note.issue_key
        );
      } catch (error) {
        console.error('Failed to update notifications:', error);
        // Don't fail the update if notification fails
      }
    }

    return updatedNote;
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

    // Delete associated notifications
    try {
      await notificationService.deleteNotificationsForNote(noteId);
    } catch (error) {
      console.error('Failed to delete notifications:', error);
      // Continue with note deletion even if notification deletion fails
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
   * Share a note with multiple users (owner only)
   */
  async shareNoteMultiple({ noteId, targetUserIds, permissionType, userId }) {
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

    if (!Array.isArray(targetUserIds) || targetUserIds.length === 0) {
      throw new Error('Target user IDs must be a non-empty array');
    }

    // Share with each user individually and collect results
    const results = [];
    const errors = [];

    for (const targetUserId of targetUserIds) {
      try {
        const permission = await databaseService.shareNote({
          noteId,
          targetUserId,
          permissionType,
          grantedBy: userId
        });
        results.push({ targetUserId, success: true, permission });
      } catch (error) {
        console.error(`Failed to share with user ${targetUserId}:`, error);
        errors.push({ targetUserId, success: false, error: error.message });
        results.push({ targetUserId, success: false, error: error.message });
      }
    }

    // Return results with summary
    return {
      totalUsers: targetUserIds.length,
      successfulShares: results.filter(r => r.success).length,
      failedShares: errors.length,
      results: results
    };
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
   * Get public note activities for an issue (for activity feed)
   * Returns activity entries showing when public notes were created/updated
   */
  async getPublicNoteActivities(issueKey) {
    try {
      // Get all public notes for this issue
      const notes = await databaseService.getPublicNotesByIssue(issueKey);
      
      if (!notes || notes.length === 0) {
        return [];
      }

      // Fetch user information for all unique user IDs
      const userIds = [...new Set(notes.map(note => note.created_by))];
      const userMap = {};
      
      for (const userId of userIds) {
        try {
          const userResponse = await api.asUser().requestJira(api.route`/rest/api/3/user?accountId=${userId}`, {
            headers: {
              'Accept': 'application/json'
            }
          });
          
          if (userResponse.ok) {
            const user = await userResponse.json();
            userMap[userId] = user.displayName || 'Unknown User';
          } else {
            userMap[userId] = 'Unknown User';
          }
        } catch (error) {
          console.error(`Failed to fetch user ${userId}:`, error);
          userMap[userId] = 'Unknown User';
        }
      }

      // Create activity entries for each note
      const activities = [];
      
      for (const note of notes) {
        // Add "created" activity
        activities.push({
          id: `${note.id}-created`,
          noteId: note.id,
          noteTitle: note.title,
          action: 'created',
          userName: userMap[note.created_by] || 'Unknown User',
          userId: note.created_by,
          timestamp: note.created_at
        });

        // Add "updated" activity if the note was updated after creation
        if (note.updated_at && note.updated_at !== note.created_at) {
          activities.push({
            id: `${note.id}-updated`,
            noteId: note.id,
            noteTitle: note.title,
            action: 'updated',
            userName: userMap[note.created_by] || 'Unknown User',
            userId: note.created_by,
            timestamp: note.updated_at
          });
        }
      }

      // Sort activities by timestamp (most recent first)
      activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      return activities;
    } catch (error) {
      console.error('Error fetching public note activities:', error);
      throw error;
    }
  }

  /**
   * Get users in the project (for sharing)
   */
  async getProjectUsers(issueKey) {
    try {
      // console.log('getProjectUsers called with issueKey:', issueKey);
      
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
      // console.log('Issue response:', JSON.stringify(issue, null, 2));

      // Check if the issue has the expected structure
      if (!issue || !issue.fields || !issue.fields.project) {
        console.error('Invalid issue structure:', issue);
        throw new Error('Issue does not contain project information');
      }

      const projectKey = issue.fields.project.key;
      // console.log('Project key:', projectKey);

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

      // Filter out non-user accounts (apps, bots, etc.) - only show real users
      const realUsers = users.filter(user => {
        const displayName = user.displayName?.toLowerCase() || '';
        const isBot = displayName.includes('bot') || 
                     displayName.includes('app') || 
                     displayName.includes('provision') ||
                     displayName.includes('oneatlas') ||
                     displayName.includes('bitbucket');
        
        return user.accountType === 'atlassian' && 
               user.active !== false &&
               !isBot;
      });

      return realUsers.map(user => ({
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
