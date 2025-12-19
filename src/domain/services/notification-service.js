/**
 * Notification Service
 * Handles notification creation, querying, and scheduling logic
 */

const databaseService = require('../../infrastructure/database/database-service');

/**
 * Create a deadline notification for a note
 * This is called when a note with a deadline is created or updated
 */
async function createDeadlineNotification(noteId, deadline, creatorId, issueKey) {
  try {
    // Only create notification if deadline is in the future
    const deadlineDate = new Date(deadline);
    const now = new Date();
    
    if (deadlineDate <= now) {
      console.log('Deadline is in the past, skipping notification creation');
      return null;
    }

    // Calculate notification time (24 hours before deadline)
    const notificationTime = new Date(deadlineDate.getTime() - (24 * 60 * 60 * 1000));
    
    // Only create if notification time is in the future
    if (notificationTime <= now) {
      console.log('Notification time is in the past, will send immediately on next check');
    }

    // Get all users who should be notified (creator + users with permissions)
    const usersToNotify = await getUsersToNotify(noteId, creatorId);
    
    // Create notification records for each user
    const notifications = [];
    for (const userId of usersToNotify) {
      const notification = await databaseService.createNotification({
        user_account_id: userId,
        note_id: noteId,
        type: 'deadline_reminder',
        title: 'Note Deadline Approaching',
        message: `Your note deadline is approaching. Issue: ${issueKey}`,
        is_read: false
      });
      notifications.push(notification);
    }

    return notifications;
  } catch (error) {
    console.error('Error creating deadline notification:', error);
    throw error;
  }
}

/**
 * Get all users who should receive notifications for a note
 * Includes creator and users with read or write permissions
 */
async function getUsersToNotify(noteId, creatorId) {
  try {
    const users = new Set([creatorId]); // Always include creator
    
    // Get all users with permissions to this note
    const permissions = await databaseService.getNotePermissions(noteId);
    
    for (const permission of permissions) {
      users.add(permission.user_account_id);
    }
    
    return Array.from(users);
  } catch (error) {
    console.error('Error getting users to notify:', error);
    throw error;
  }
}

/**
 * Get pending notifications that need to be sent
 * Returns notifications for deadlines that are within 24 hours or have passed
 */
async function getPendingNotifications() {
  try {
    // Get all unread notifications
    const notifications = await databaseService.getPendingNotifications();
    
    // Filter to only those that should be sent now
    const now = new Date();
    const pendingToSend = [];
    
    for (const notification of notifications) {
      // Get the associated note to check deadline
      const note = await databaseService.getNoteById(notification.note_id);
      
      if (!note || !note.deadline) {
        continue;
      }
      
      const deadline = new Date(note.deadline);
      const hoursUntilDeadline = (deadline - now) / (1000 * 60 * 60);
      
      // Send if deadline is within 24 hours or has passed
      if (hoursUntilDeadline <= 24) {
        pendingToSend.push({
          notification,
          note,
          hoursUntilDeadline
        });
      }
    }
    
    return pendingToSend;
  } catch (error) {
    console.error('Error getting pending notifications:', error);
    throw error;
  }
}

/**
 * Delete notifications for a specific note
 * Called when a note is deleted or deadline is removed
 */
async function deleteNotificationsForNote(noteId) {
  try {
    await databaseService.deleteNotificationsByNoteId(noteId);
  } catch (error) {
    console.error('Error deleting notifications:', error);
    throw error;
  }
}

/**
 * Update notifications when note deadline changes
 */
async function updateNotificationsForDeadline(noteId, newDeadline, creatorId, issueKey) {
  try {
    // Delete existing notifications for this note
    await deleteNotificationsForNote(noteId);
    
    // Create new notifications if deadline exists
    if (newDeadline) {
      return await createDeadlineNotification(noteId, newDeadline, creatorId, issueKey);
    }
    
    return null;
  } catch (error) {
    console.error('Error updating notifications for deadline:', error);
    throw error;
  }
}

module.exports = {
  createDeadlineNotification,
  getPendingNotifications,
  deleteNotificationsForNote,
  updateNotificationsForDeadline,
  getUsersToNotify
};
