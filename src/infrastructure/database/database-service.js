const { sql } = require('@forge/sql');

/**
 * Database service for managing notes and permissions
 */
class DatabaseService {
  /**
   * Check if database tables exist (migrations should handle table creation)
   */
  async checkTablesExist() {
    try {
      // Simple check to see if tables exist by trying to count rows
      await sql`SELECT 1 FROM notes LIMIT 1`;
      await sql`SELECT 1 FROM note_permissions LIMIT 1`;
      await sql`SELECT 1 FROM notifications LIMIT 1`;
      console.log('Database tables are ready');
      return true;
    } catch (error) {
      console.log('Database tables not found - please run migrations first');
      console.log('Use: forge migrations run');
      return false;
    }
  }

  /**
   * Create a new note
   */
  async createNote({ issueKey, title, content, createdBy, deadline, isPublic }) {
    try {
      console.log('createNote called with deadline:', deadline, 'Type:', typeof deadline);
      
      const query = `INSERT INTO notes (issue_key, title, content, created_by, deadline, is_public) VALUES (?, ?, ?, ?, ?, ?)`;
      const result = await sql.prepare(query)
        .bindParams(issueKey, title, content || '', createdBy, deadline, isPublic || false)
        .execute();

      console.log('Insert result:', JSON.stringify(result, null, 2));

      if (result && result.rows && result.rows.insertId) {
        const newNote = await this.getNoteById(result.rows.insertId);
        console.log('Retrieved new note, deadline:', newNote.deadline);
        return newNote;
      }

      throw new Error('Failed to create note');
    } catch (error) {
      console.error('Error creating note:', error);
      throw error;
    }
  }

  /**
   * Get a note by ID
   */
  async getNoteById(noteId) {
    try {
      const query = `SELECT * FROM notes WHERE id = ?`;
      const result = await sql.prepare(query).bindParams(noteId).execute();

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error getting note by ID:', error);
      throw error;
    }
  }

  /**
   * Get all notes for an issue that the user can access (PRIVATE NOTES ONLY)
   * Public notes are handled separately for the activity panel
   */
  async getNotesByIssue(issueKey, userId) {
    try {
      const query = `
        SELECT DISTINCT n.*
        FROM notes n
        LEFT JOIN note_permissions np ON n.id = np.note_id
        WHERE n.issue_key = ?
          AND (n.created_by = ? OR np.user_account_id = ?)
        ORDER BY n.created_at DESC
      `;
      const result = await sql.prepare(query).bindParams(issueKey, userId, userId).execute();

      console.log('Database getNotesByIssue - Raw result from DB:');
      if (result.rows && result.rows.length > 0) {
        result.rows.forEach(row => {
          console.log(`Row ID: ${row.id}, Deadline: ${row.deadline}, Type: ${typeof row.deadline}`);
        });
      }

      return result.rows || [];
    } catch (error) {
      console.error('Error getting notes by issue:', error);
      throw error;
    }
  }

  /**
   * Get all notes created by a user
   */
  async getMyNotes(userId) {
    try {
      const query = `SELECT * FROM notes WHERE created_by = ? ORDER BY created_at DESC`;
      const result = await sql.prepare(query).bindParams(userId).execute();

      return result.rows || [];
    } catch (error) {
      console.error('Error getting user notes:', error);
      throw error;
    }
  }

  /**
   * Update a note
   */
  async updateNote(noteId, updates) {
    try {
      console.log('updateNote called with updates:', JSON.stringify(updates, null, 2));
      
      const setParts = [];
      const values = [];

      if (updates.title !== undefined) {
        setParts.push('title = ?');
        values.push(updates.title);
      }
      if (updates.content !== undefined) {
        setParts.push('content = ?');
        values.push(updates.content);
      }
      if (updates.deadline !== undefined) {
        console.log('Updating deadline to:', updates.deadline, 'Type:', typeof updates.deadline);
        setParts.push('deadline = ?');
        values.push(updates.deadline);
      }
      if (updates.isPublic !== undefined) {
        setParts.push('is_public = ?');
        values.push(updates.isPublic);
      }
      if (updates.status !== undefined) {
        setParts.push('status = ?');
        values.push(updates.status);
      }

      if (setParts.length === 0) {
        return await this.getNoteById(noteId);
      }

      values.push(noteId);
      const setClause = setParts.join(', ');
      const query = `UPDATE notes SET ${setClause} WHERE id = ?`;

      console.log('Update query:', query);
      console.log('Update values:', values);

      await sql.prepare(query).bindParams(...values).execute();

      const updatedNote = await this.getNoteById(noteId);
      console.log('Updated note deadline:', updatedNote.deadline);
      return updatedNote;
    } catch (error) {
      console.error('Error updating note:', error);
      throw error;
    }
  }

  /**
   * Delete a note and its permissions
   */
  async deleteNote(noteId) {
    try {
      // Delete permissions first
      await sql.prepare('DELETE FROM note_permissions WHERE note_id = ?').bindParams(noteId).execute();

      // Then delete the note
      const result = await sql.prepare('DELETE FROM notes WHERE id = ?').bindParams(noteId).execute();

      return result && result.rows && result.rows.affectedRows > 0;
    } catch (error) {
      console.error('Error deleting note:', error);
      throw error;
    }
  }

  /**
   * Share a note with another user
   */
  async shareNote({ noteId, targetUserId, permissionType, grantedBy }) {
    try {
      const query = `
        INSERT INTO note_permissions (note_id, user_account_id, permission_type, granted_by)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE permission_type = ?
      `;
      await sql.prepare(query).bindParams(noteId, targetUserId, permissionType, grantedBy, permissionType).execute();

      return {
        noteId,
        userAccountId: targetUserId,
        permissionType,
        grantedBy
      };
    } catch (error) {
      console.error('Error sharing note:', error);
      throw error;
    }
  }

  /**
   * Revoke access to a note
   */
  async revokeAccess(noteId, targetUserId) {
    try {
      const query = `DELETE FROM note_permissions WHERE note_id = ? AND user_account_id = ?`;
      const result = await sql.prepare(query).bindParams(noteId, targetUserId).execute();

      return result && result.rows && result.rows.affectedRows > 0;
    } catch (error) {
      console.error('Error revoking access:', error);
      throw error;
    }
  }

  /**
   * Get public notes for an issue (for future activity panel)
   * Returns only metadata for collaboration signals - NO CONTENT
   */
  async getPublicNotesByIssue(issueKey) {
    try {
      const query = `
        SELECT n.id, n.title, n.created_by, n.created_at, n.deadline, n.status
        FROM notes n
        WHERE n.issue_key = ? AND n.is_public = TRUE 
        ORDER BY n.created_at DESC
      `;
      const result = await sql.prepare(query).bindParams(issueKey).execute();

      return result.rows || [];
    } catch (error) {
      console.error('Error getting public notes:', error);
      throw error;
    }
  }

  /**
   * Check if user has permission to access a note
   */
  async hasPermission(noteId, userId, requiredPermission = 'read') {
    try {
      const note = await this.getNoteById(noteId);

      if (!note) {
        return false;
      }

      // Owner has all permissions
      if (note.created_by === userId) {
        return true;
      }

      // Check if note is public (read-only access)
      if (note.is_public && requiredPermission === 'read') {
        return true;
      }

      // Check permissions table
      const query = `SELECT permission_type FROM note_permissions WHERE note_id = ? AND user_account_id = ?`;
      const permissions = await sql.prepare(query).bindParams(noteId, userId).execute();

      if (permissions.rows.length === 0) {
        return false;
      }

      const userPermission = permissions.rows[0].permission_type;

      if (requiredPermission === 'write') {
        return userPermission === 'write';
      }

      return true; // read permission is sufficient
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  /**
   * Create a new notification
   */
  async createNotification(notificationData) {
    try {
      const query = `
        INSERT INTO notifications (user_account_id, note_id, type, title, message, is_read)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      const result = await sql.prepare(query).bindParams(
        notificationData.user_account_id,
        notificationData.note_id,
        notificationData.type,
        notificationData.title,
        notificationData.message,
        notificationData.is_read || false
      ).execute();

      return {
        id: result.lastInsertId,
        ...notificationData
      };
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Get all pending (unread) notifications
   */
  async getPendingNotifications() {
    try {
      const query = `
        SELECT * FROM notifications 
        WHERE is_read = FALSE 
        ORDER BY created_at ASC
      `;
      const result = await sql.prepare(query).execute();
      return result.rows || [];
    } catch (error) {
      console.error('Error getting pending notifications:', error);
      throw error;
    }
  }

  /**
   * Get note permissions for notification purposes
   */
  async getNotePermissions(noteId) {
    try {
      const query = `SELECT * FROM note_permissions WHERE note_id = ?`;
      const result = await sql.prepare(query).bindParams(noteId).execute();
      return result.rows || [];
    } catch (error) {
      console.error('Error getting note permissions:', error);
      throw error;
    }
  }

  /**
   * Delete all notifications for a specific note
   */
  async deleteNotificationsByNoteId(noteId) {
    try {
      const query = `DELETE FROM notifications WHERE note_id = ?`;
      await sql.prepare(query).bindParams(noteId).execute();
    } catch (error) {
      console.error('Error deleting notifications by note id:', error);
      throw error;
    }
  }

  /**
   * Mark a notification as read
   */
  async markNotificationAsRead(notificationId) {
    try {
      const query = `UPDATE notifications SET is_read = TRUE WHERE id = ?`;
      await sql.prepare(query).bindParams(notificationId).execute();
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }
}

module.exports = new DatabaseService();
