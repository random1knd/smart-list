/**
 * JQL Function Handlers for Private Notes
 * 
 * This module provides multiple JQL functions for searching issues with notes:
 * 
 * 1. issuesWithNotes() - Find all issues that have notes
 * 2. issuesWithNotesCount(operator, count) - Find issues by note count
 * 3. issuesWithNotesAfter(date) - Find issues with notes after a date
 * 4. issuesWithNotesBefore(date) - Find issues with notes before a date
 * 5. issuesWithNotesInDateRange(startDate, endDate) - Find issues with notes in date range
 * 
 * All functions return JQL fragments that Jira uses to filter issues.
 * Note: JQL functions are not user-specific - they return the same results for all users.
 * Jira applies permission filtering afterwards.
 */

const { sql } = require('@forge/sql');
const { ensureMigrationsApplied } = require('./migrations/runner');

/**
 * Helper function to build JQL fragment from issue keys
 */
function buildJqlFragment(issueKeys, operator) {
  if (issueKeys.length === 0) {
    // No issues match - return a query that matches nothing or everything
    if (operator === 'in') {
      return 'key = "IMPOSSIBLE-MATCH"';
    } else {
      return 'key != "IMPOSSIBLE-MATCH"';
    }
  } else {
    // Build a list of issue keys
    const keysList = issueKeys.map(key => `"${key}"`).join(', ');
    
    if (operator === 'in') {
      return `key in (${keysList})`;
    } else {
      return `key not in (${keysList})`;
    }
  }
}

/**
 * Main handler for issuesWithNotes() JQL function
 * 
 * @param {Object} args - Contains the clause and context
 * @returns {Object} - Object with jql property containing the JQL fragment
 */
exports.handler = async (args) => {
  try {
    console.log('[JQL issuesWithNotes] Handler invoked!');
    console.log('[JQL issuesWithNotes] Args:', JSON.stringify(args, null, 2));

    // Ensure database is initialized
    await ensureMigrationsApplied(false);

    const { clause } = args;
    const { operator } = clause;

    console.log('[JQL issuesWithNotes] Operator:', operator);

    // Get ALL issue keys that have notes
    // JQL functions are NOT user-specific - Jira applies permissions after
    const query = `
      SELECT DISTINCT issue_key
      FROM notes
    `;

    const result = await sql.prepare(query).execute();
    const issueKeys = result.rows ? result.rows.map(row => row.issue_key) : [];

    console.log('[JQL issuesWithNotes] Found', issueKeys.length, 'issues with notes');

    const jqlFragment = buildJqlFragment(issueKeys, operator);
    console.log('[JQL issuesWithNotes] Returning JQL fragment:', jqlFragment);

    return { jql: jqlFragment };
  } catch (error) {
    console.error('[JQL issuesWithNotes] Error:', error);
    console.error('[JQL issuesWithNotes] Stack:', error.stack);
    
    return { 
      error: 'Unable to search notes. Please try again later.',
      storeErrorAsPrecomputation: false 
    };
  }
};

/**
 * Handler for issuesWithNotesCount(operator, count) JQL function
 * Example: issue in issuesWithNotesCount(">", 3)
 * 
 * @param {Object} args - Contains the clause with arguments
 * @returns {Object} - Object with jql property containing the JQL fragment
 */
exports.countHandler = async (args) => {
  try {
    console.log('[JQL issuesWithNotesCount] Handler invoked!');
    console.log('[JQL issuesWithNotesCount] Args:', JSON.stringify(args, null, 2));

    await ensureMigrationsApplied(false);

    const { clause } = args;
    const { operator: jqlOperator, arguments: functionArgs } = clause;

    // Extract comparison operator and count from arguments
    const comparisonOperator = functionArgs[0];
    const targetCount = parseInt(functionArgs[1], 10);

    console.log('[JQL issuesWithNotesCount] Comparison:', comparisonOperator, targetCount);

    if (!comparisonOperator || isNaN(targetCount)) {
      return { 
        error: 'Invalid arguments. Usage: issuesWithNotesCount(">", 3)',
        storeErrorAsPrecomputation: false 
      };
    }

    // Get issue keys with note counts
    const query = `
      SELECT issue_key, COUNT(*) as note_count
      FROM notes
      GROUP BY issue_key
    `;

    const result = await sql.prepare(query).execute();
    
    // Filter based on comparison operator
    const filteredIssues = result.rows ? result.rows.filter(row => {
      const count = row.note_count;
      switch (comparisonOperator) {
        case '>': return count > targetCount;
        case '<': return count < targetCount;
        case '>=': return count >= targetCount;
        case '<=': return count <= targetCount;
        case '=': return count === targetCount;
        default: return false;
      }
    }) : [];

    const issueKeys = filteredIssues.map(row => row.issue_key);
    console.log('[JQL issuesWithNotesCount] Found', issueKeys.length, 'issues matching criteria');

    const jqlFragment = buildJqlFragment(issueKeys, jqlOperator);
    console.log('[JQL issuesWithNotesCount] Returning JQL fragment:', jqlFragment);

    return { jql: jqlFragment };
  } catch (error) {
    console.error('[JQL issuesWithNotesCount] Error:', error);
    console.error('[JQL issuesWithNotesCount] Stack:', error.stack);
    
    return { 
      error: 'Unable to search notes by count. Please try again later.',
      storeErrorAsPrecomputation: false 
    };
  }
};

/**
 * Handler for issuesWithNotesAfter(date) JQL function
 * Example: issue in issuesWithNotesAfter("2025-01-01")
 * 
 * @param {Object} args - Contains the clause with date argument
 * @returns {Object} - Object with jql property containing the JQL fragment
 */
exports.afterHandler = async (args) => {
  try {
    console.log('[JQL issuesWithNotesAfter] Handler invoked!');
    console.log('[JQL issuesWithNotesAfter] Args:', JSON.stringify(args, null, 2));

    await ensureMigrationsApplied(false);

    const { clause } = args;
    const { operator, arguments: functionArgs } = clause;
    const dateStr = functionArgs[0];

    console.log('[JQL issuesWithNotesAfter] Date:', dateStr);

    if (!dateStr) {
      return { 
        error: 'Date is required. Usage: issuesWithNotesAfter("2025-01-01")',
        storeErrorAsPrecomputation: false 
      };
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) {
      return { 
        error: 'Invalid date format. Use YYYY-MM-DD format.',
        storeErrorAsPrecomputation: false 
      };
    }

    // Get issues with notes created after the specified date
    const query = `
      SELECT DISTINCT issue_key
      FROM notes
      WHERE created_at > ?
    `;

    const result = await sql.prepare(query).bindParams(dateStr).execute();
    const issueKeys = result.rows ? result.rows.map(row => row.issue_key) : [];

    console.log('[JQL issuesWithNotesAfter] Found', issueKeys.length, 'issues with notes after', dateStr);

    const jqlFragment = buildJqlFragment(issueKeys, operator);
    console.log('[JQL issuesWithNotesAfter] Returning JQL fragment:', jqlFragment);

    return { jql: jqlFragment };
  } catch (error) {
    console.error('[JQL issuesWithNotesAfter] Error:', error);
    console.error('[JQL issuesWithNotesAfter] Stack:', error.stack);
    
    return { 
      error: 'Unable to search notes by date. Please try again later.',
      storeErrorAsPrecomputation: false 
    };
  }
};

/**
 * Handler for issuesWithNotesBefore(date) JQL function
 * Example: issue in issuesWithNotesBefore("2025-12-31")
 * 
 * @param {Object} args - Contains the clause with date argument
 * @returns {Object} - Object with jql property containing the JQL fragment
 */
exports.beforeHandler = async (args) => {
  try {
    console.log('[JQL issuesWithNotesBefore] Handler invoked!');
    console.log('[JQL issuesWithNotesBefore] Args:', JSON.stringify(args, null, 2));

    await ensureMigrationsApplied(false);

    const { clause } = args;
    const { operator, arguments: functionArgs } = clause;
    const dateStr = functionArgs[0];

    console.log('[JQL issuesWithNotesBefore] Date:', dateStr);

    if (!dateStr) {
      return { 
        error: 'Date is required. Usage: issuesWithNotesBefore("2025-12-31")',
        storeErrorAsPrecomputation: false 
      };
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) {
      return { 
        error: 'Invalid date format. Use YYYY-MM-DD format.',
        storeErrorAsPrecomputation: false 
      };
    }

    // Get issues with notes created before the specified date
    const query = `
      SELECT DISTINCT issue_key
      FROM notes
      WHERE created_at < ?
    `;

    const result = await sql.prepare(query).bindParams(dateStr).execute();
    const issueKeys = result.rows ? result.rows.map(row => row.issue_key) : [];

    console.log('[JQL issuesWithNotesBefore] Found', issueKeys.length, 'issues with notes before', dateStr);

    const jqlFragment = buildJqlFragment(issueKeys, operator);
    console.log('[JQL issuesWithNotesBefore] Returning JQL fragment:', jqlFragment);

    return { jql: jqlFragment };
  } catch (error) {
    console.error('[JQL issuesWithNotesBefore] Error:', error);
    console.error('[JQL issuesWithNotesBefore] Stack:', error.stack);
    
    return { 
      error: 'Unable to search notes by date. Please try again later.',
      storeErrorAsPrecomputation: false 
    };
  }
};

/**
 * Handler for issuesWithNotesInDateRange(startDate, endDate) JQL function
 * Example: issue in issuesWithNotesInDateRange("2025-01-01", "2025-12-31")
 * 
 * @param {Object} args - Contains the clause with date range arguments
 * @returns {Object} - Object with jql property containing the JQL fragment
 */
exports.rangeHandler = async (args) => {
  try {
    console.log('[JQL issuesWithNotesInDateRange] Handler invoked!');
    console.log('[JQL issuesWithNotesInDateRange] Args:', JSON.stringify(args, null, 2));

    await ensureMigrationsApplied(false);

    const { clause } = args;
    const { operator, arguments: functionArgs } = clause;
    const startDate = functionArgs[0];
    const endDate = functionArgs[1];

    console.log('[JQL issuesWithNotesInDateRange] Date range:', startDate, 'to', endDate);

    if (!startDate || !endDate) {
      return { 
        error: 'Start and end dates are required. Usage: issuesWithNotesInDateRange("2025-01-01", "2025-12-31")',
        storeErrorAsPrecomputation: false 
      };
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return { 
        error: 'Invalid date format. Use YYYY-MM-DD format for both dates.',
        storeErrorAsPrecomputation: false 
      };
    }

    // Get issues with notes created within the date range
    const query = `
      SELECT DISTINCT issue_key
      FROM notes
      WHERE created_at >= ? AND created_at <= ?
    `;

    const result = await sql.prepare(query).bindParams(startDate, endDate).execute();
    const issueKeys = result.rows ? result.rows.map(row => row.issue_key) : [];

    console.log('[JQL issuesWithNotesInDateRange] Found', issueKeys.length, 'issues with notes in range');

    const jqlFragment = buildJqlFragment(issueKeys, operator);
    console.log('[JQL issuesWithNotesInDateRange] Returning JQL fragment:', jqlFragment);

    return { jql: jqlFragment };
  } catch (error) {
    console.error('[JQL issuesWithNotesInDateRange] Error:', error);
    console.error('[JQL issuesWithNotesInDateRange] Stack:', error.stack);
    
    return { 
      error: 'Unable to search notes by date range. Please try again later.',
      storeErrorAsPrecomputation: false 
    };
  }
};
