/**
 * Shared utility functions for Private Notes app
 */

/**
 * Format date for display
 */
export const formatDate = (dateString) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
};

/**
 * Format deadline for backend (MySQL TIMESTAMP format)
 */
export const formatDeadlineForBackend = (deadlineString) => {
  if (!deadlineString) return null;

  try {
    const date = new Date(deadlineString);

    if (isNaN(date.getTime())) {
      console.error('Invalid deadline date:', deadlineString);
      return null;
    }

    // Format as MySQL TIMESTAMP: YYYY-MM-DD HH:MM:SS
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch (e) {
    console.error('Error formatting deadline:', e);
    return null;
  }
};

/**
 * Check if deadline is approaching (within 2 days)
 */
export const isDeadlineApproaching = (deadlineString) => {
  if (!deadlineString) return false;
  const deadline = new Date(deadlineString);
  const now = new Date();
  const daysDiff = (deadline - now) / (1000 * 60 * 60 * 24);
  return daysDiff <= 2 && daysDiff > 0;
};

/**
 * Check if deadline has passed
 */
export const isDeadlinePassed = (deadlineString) => {
  if (!deadlineString) return false;
  const deadline = new Date(deadlineString);
  return deadline < new Date();
};

/**
 * Map note from backend (snake_case to camelCase)
 */
export const mapNoteFromBackend = (note) => {
  return {
    id: note.id,
    issueKey: note.issue_key,
    title: note.title,
    content: note.content,
    createdBy: note.created_by,
    createdAt: note.created_at,
    updatedAt: note.updated_at,
    deadline: note.deadline,
    isPublic: note.is_public,
    status: note.status,
    permissions: note.permissions
  };
};

/**
 * Filter notes by type
 */
export const filterNotesByType = (notes, filterType, userId) => {
  switch (filterType) {
    case 'mine':
      return notes.filter(note => note.createdBy === userId);
    case 'shared':
      return notes.filter(note => note.createdBy !== userId);
    case 'all':
    default:
      return notes;
  }
};

/**
 * Generate time intervals in 5-minute increments (00:00 to 23:55)
 */
export const generateTimeIntervals = () => {
  const times = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 5) {
      const h = hour.toString().padStart(2, '0');
      const m = minute.toString().padStart(2, '0');
      times.push(`${h}:${m}`);
    }
  }
  return times;
};

export const TIME_INTERVALS_5MIN = generateTimeIntervals();
