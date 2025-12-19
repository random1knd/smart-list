/**
 * Scheduled Function Entry Point
 * Handles scheduled triggers for the app
 */

const { checkAndSendNotifications } = require('./scheduled/notification-scheduler');

/**
 * Main handler for scheduled triggers
 * This is invoked by the scheduled trigger defined in manifest.yml
 */
exports.handler = async (event, context) => {
  console.log('Scheduled trigger invoked:', JSON.stringify(event, null, 2));
  
  try {
    const result = await checkAndSendNotifications();
    console.log('Scheduled task completed:', result);
    return result;
  } catch (error) {
    console.error('Error in scheduled handler:', error);
    throw error;
  }
};
