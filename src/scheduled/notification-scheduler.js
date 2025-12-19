/**
 * Scheduled Notification Handler
 * Runs periodically to check for pending notifications and send emails via Jira API
 */

const api = require('@forge/api');
const notificationService = require('../domain/services/notification-service');
const databaseService = require('../infrastructure/database/database-service');
const { ensureMigrationsApplied } = require('../migrations/runner');

/**
 * Main handler for scheduled notification checking
 * This function is triggered by the scheduled trigger in manifest.yml
 */
async function checkAndSendNotifications() {
  try {
    console.log('🔔 [Notification Scheduler] Starting check...');
    
    // Ensure database is ready
    await ensureMigrationsApplied();
    
    // Get pending notifications that should be sent
    const pendingNotifications = await notificationService.getPendingNotifications();
    
    if (pendingNotifications.length === 0) {
      console.log('✅ [Notification Scheduler] No deadlines found - all clear!');
      return { success: true, sent: 0, message: 'No pending notifications' };
    }
    
    // Group notifications by note for compact logging
    const notificationsByNote = {};
    for (const { notification, note, hoursUntilDeadline } of pendingNotifications) {
      if (!notificationsByNote[note.id]) {
        notificationsByNote[note.id] = {
          note,
          users: [],
          hoursUntilDeadline
        };
      }
      notificationsByNote[note.id].users.push(notification.user_account_id);
    }
    
    console.log(`📬 [Notification Scheduler] Found ${pendingNotifications.length} notification(s) for ${Object.keys(notificationsByNote).length} note(s)`);
    
    // Log each note's notification details
    for (const noteId in notificationsByNote) {
      const { note, users, hoursUntilDeadline } = notificationsByNote[noteId];
      const status = hoursUntilDeadline <= 0 ? '🔴 OVERDUE' : hoursUntilDeadline <= 6 ? '🔴 URGENT' : '🟡 APPROACHING';
      const hoursText = hoursUntilDeadline <= 0 ? `${Math.abs(Math.round(hoursUntilDeadline))}h overdue` : `${Math.round(hoursUntilDeadline)}h remaining`;
      console.log(`  ${status} [${note.issue_key}] "${note.title}" (${hoursText}) → ${users.length} user(s): ${users.join(', ')}`);
    }
    
    let successCount = 0;
    let failureCount = 0;
    const sentToUsers = [];
    
    // Process each notification
    for (const { notification, note, hoursUntilDeadline } of pendingNotifications) {
      try {
        // Send email notification via Jira API
        await sendEmailNotification(notification, note, hoursUntilDeadline);
        
        // Mark notification as read/sent
        await databaseService.markNotificationAsRead(notification.id);
        
        successCount++;
        sentToUsers.push(notification.user_account_id);
      } catch (error) {
        console.error(`❌ [Notification Scheduler] Failed to send to ${notification.user_account_id}:`, error.message);
        failureCount++;
      }
    }
    
    if (successCount > 0) {
      console.log(`✅ [Notification Scheduler] Successfully sent ${successCount} notification(s) to: ${[...new Set(sentToUsers)].join(', ')}`);
    }
    
    if (failureCount > 0) {
      console.log(`⚠️ [Notification Scheduler] Failed to send ${failureCount} notification(s)`);
    }
    
    console.log(`🏁 [Notification Scheduler] Complete - Sent: ${successCount}, Failed: ${failureCount}`);
    
    return {
      success: true,
      sent: successCount,
      failed: failureCount,
      total: pendingNotifications.length,
      users: [...new Set(sentToUsers)]
    };
  } catch (error) {
    console.error('❌ [Notification Scheduler] Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Send email notification via Jira's issue notification API
 * Uses POST /rest/api/3/issue/{issueIdOrKey}/notify
 */
async function sendEmailNotification(notification, note, hoursUntilDeadline) {
  try {
    // Format the deadline message
    const deadlineDate = new Date(note.deadline);
    const formattedDeadline = deadlineDate.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Determine urgency level
    let urgencyMessage = '';
    if (hoursUntilDeadline <= 0) {
      urgencyMessage = '⚠️ OVERDUE';
    } else if (hoursUntilDeadline <= 6) {
      urgencyMessage = '🔴 URGENT - Less than 6 hours remaining';
    } else if (hoursUntilDeadline <= 24) {
      urgencyMessage = '🟡 Deadline approaching within 24 hours';
    }
    
    // Create email body
    const subject = `Private Note Deadline Reminder: ${note.title}`;
    const textBody = `
${urgencyMessage}

You have a private note with an approaching deadline on issue ${note.issue_key}.

Note Title: ${note.title}
Deadline: ${formattedDeadline}
Status: ${note.status}

${note.content ? 'Note Content:\n' + note.content : ''}

Please review this note in the Private Notes panel on the issue.
    `.trim();
    
    const htmlBody = `
<p><strong>${urgencyMessage}</strong></p>
<p>You have a private note with an approaching deadline on issue <strong>${note.issue_key}</strong>.</p>
<ul>
  <li><strong>Note Title:</strong> ${note.title}</li>
  <li><strong>Deadline:</strong> ${formattedDeadline}</li>
  <li><strong>Status:</strong> ${note.status}</li>
</ul>
${note.content ? '<p><strong>Note Content:</strong><br>' + note.content.replace(/\n/g, '<br>') + '</p>' : ''}
<p>Please review this note in the Private Notes panel on the issue.</p>
    `.trim();
    
    // Prepare the notification payload
    const notificationPayload = {
      subject: subject,
      textBody: textBody,
      htmlBody: htmlBody,
      to: {
        users: [
          {
            accountId: notification.user_account_id
          }
        ],
        reporter: false,
        assignee: false,
        watchers: false,
        voters: false
      }
    };
    
    // Send notification via Jira API using asApp()
    // We use asApp() because we're sending on behalf of the app, not a specific user
    const response = await api.asApp().requestJira(
      api.route`/rest/api/3/issue/${note.issue_key}/notify`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(notificationPayload)
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Jira API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
  } catch (error) {
    console.error('Error sending email notification:', error);
    throw error;
  }
}

module.exports = {
  checkAndSendNotifications
};
