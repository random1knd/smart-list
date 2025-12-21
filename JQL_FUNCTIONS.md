# JQL Functions for Private Notes

This app provides powerful JQL (Jira Query Language) functions that allow you to search for issues based on their private notes. These functions can be used in any Jira filter, dashboard, or advanced search.

## 📋 Table of Contents

- [Basic Search](#basic-search)
- [Count-Based Search](#count-based-search)
- [Date-Based Search](#date-based-search)
- [Advanced Examples](#advanced-examples)
- [Important Notes](#important-notes)

---

## Basic Search

### `issuesWithNotes()`

Find all issues that have private notes.

**Syntax:**
```jql
issue in issuesWithNotes()
```

**Examples:**

```jql
# Find all issues with notes
issue in issuesWithNotes()

# Find all issues WITHOUT notes
issue not in issuesWithNotes()

# Combine with other JQL criteria
issue in issuesWithNotes() AND assignee = currentUser() AND status = "In Progress"

# Find bugs with notes
issue in issuesWithNotes() AND type = Bug

# Find issues with notes in a specific project
project = MYPROJ AND issue in issuesWithNotes()
```

---

## Count-Based Search

### `issuesWithNotesCount(operator, count)`

Find issues based on the number of notes they have.

**Syntax:**
```jql
issue in issuesWithNotesCount("operator", count)
```

**Parameters:**
- `operator` - Comparison operator (must be quoted):
  - `">"` - greater than
  - `"<"` - less than
  - `">="` - greater than or equal to
  - `"<="` - less than or equal to
  - `"="` - equal to
- `count` - Number to compare against (integer)

**Examples:**

```jql
# Issues with MORE than 3 notes
issue in issuesWithNotesCount(">", 3)

# Issues with EXACTLY 1 note
issue in issuesWithNotesCount("=", 1)

# Issues with 5 or MORE notes
issue in issuesWithNotesCount(">=", 5)

# Issues with FEWER than 2 notes
issue in issuesWithNotesCount("<", 2)

# Issues with AT MOST 10 notes
issue in issuesWithNotesCount("<=", 10)

# Find heavily discussed issues (more than 5 notes) in the current sprint
issue in issuesWithNotesCount(">", 5) AND sprint in openSprints()

# Find issues with single notes that are unresolved
issue in issuesWithNotesCount("=", 1) AND resolution = Unresolved
```

---

## Date-Based Search

### `issuesWithNotesAfter(date)`

Find issues that have notes created after a specific date.

**Syntax:**
```jql
issue in issuesWithNotesAfter("YYYY-MM-DD")
```

**Parameters:**
- `date` - Date in YYYY-MM-DD format (must be quoted)

**Examples:**

```jql
# Issues with notes created after January 1, 2025
issue in issuesWithNotesAfter("2025-01-01")

# Issues with recent notes (after specific date) that are open
issue in issuesWithNotesAfter("2025-12-01") AND status != Closed

# Combine with assignee
issue in issuesWithNotesAfter("2025-11-15") AND assignee = currentUser()
```

---

### `issuesWithNotesBefore(date)`

Find issues that have notes created before a specific date.

**Syntax:**
```jql
issue in issuesWithNotesBefore("YYYY-MM-DD")
```

**Parameters:**
- `date` - Date in YYYY-MM-DD format (must be quoted)

**Examples:**

```jql
# Issues with notes created before December 31, 2024
issue in issuesWithNotesBefore("2024-12-31")

# Old notes that might need review
issue in issuesWithNotesBefore("2024-01-01") AND status = "In Progress"

# Issues with notes from last year
issue in issuesWithNotesBefore("2025-01-01")
```

---

### `issuesWithNotesInDateRange(startDate, endDate)`

Find issues that have notes created within a specific date range.

**Syntax:**
```jql
issue in issuesWithNotesInDateRange("YYYY-MM-DD", "YYYY-MM-DD")
```

**Parameters:**
- `startDate` - Start date in YYYY-MM-DD format (must be quoted)
- `endDate` - End date in YYYY-MM-DD format (must be quoted)

**Examples:**

```jql
# Issues with notes created in January 2025
issue in issuesWithNotesInDateRange("2025-01-01", "2025-01-31")

# Issues with notes from Q4 2024
issue in issuesWithNotesInDateRange("2024-10-01", "2024-12-31")

# Issues with notes created this year
issue in issuesWithNotesInDateRange("2025-01-01", "2025-12-31")

# Issues with notes from last week (example for December 15-21, 2025)
issue in issuesWithNotesInDateRange("2025-12-15", "2025-12-21") AND project = MYPROJ
```

---

## Advanced Examples

### Combining Multiple Functions

```jql
# Issues with more than 2 notes created after a specific date
issue in issuesWithNotesCount(">", 2) AND issue in issuesWithNotesAfter("2025-01-01")

# High-priority issues with recent notes
priority = High AND issue in issuesWithNotesAfter("2025-12-01")

# Bugs with multiple notes in the current sprint
type = Bug AND issue in issuesWithNotesCount(">=", 3) AND sprint in openSprints()
```

### Using with Dashboards and Filters

```jql
# Create a filter for "Recently Discussed Issues"
issue in issuesWithNotesAfter("2025-12-01") AND assignee = currentUser()

# Create a filter for "Issues Needing Attention" (many notes)
issue in issuesWithNotesCount(">", 5) AND status != Closed

# Create a filter for "Archived Issues with Notes"
issue in issuesWithNotesBefore("2024-01-01") AND status = Closed
```

### Reporting and Analysis

```jql
# Find all epics with notes for planning review
type = Epic AND issue in issuesWithNotes()

# Find issues created this quarter with discussion (notes)
created >= "2024-10-01" AND issue in issuesWithNotesInDateRange("2024-10-01", "2024-12-31")

# Find stale issues (old notes, still open)
issue in issuesWithNotesBefore("2024-06-01") AND status = "In Progress"
```

---

## Important Notes

### How JQL Functions Work

1. **Not User-Specific**: JQL functions return the same results for all users. They show ALL issues that match the criteria, regardless of who created the notes.

2. **Permission Filtering**: Jira automatically applies permission filtering to the results. Users will only see issues they have permission to view, even if those issues have notes.

3. **Precomputation & Caching**: For performance, Jira caches JQL function results (called "precomputations"). These caches are updated:
   - When you create or delete a note
   - Automatically by Jira (within a few minutes)
   - At least every 7 days

4. **Date Format**: Always use `YYYY-MM-DD` format for dates. Other formats will result in an error.

5. **Operator Quoting**: In `issuesWithNotesCount()`, the operator must be quoted (e.g., `">"`, not `>`).

### Performance Tips

- JQL functions are optimized and indexed by Jira for fast performance
- Results are cached, so subsequent searches are very fast
- Combining multiple functions may take slightly longer but is still efficient
- Use specific date ranges when possible for better performance

### Troubleshooting

**Issue: "Function not found" error**
- Make sure the app is installed and up to date
- Check that you're using the exact function name (case-sensitive)

**Issue: No results returned**
- Verify that there are actually notes matching your criteria
- Check that you have permission to view the issues
- Try the basic `issuesWithNotes()` function first

**Issue: Results seem outdated**
- The precomputation cache may be stale
- Create or delete a note to trigger a cache refresh
- Results typically update within a few minutes

---

## Quick Reference

| Function | Purpose | Example |
|----------|---------|---------|
| `issuesWithNotes()` | Find issues with any notes | `issue in issuesWithNotes()` |
| `issuesWithNotesCount(op, n)` | Find by note count | `issue in issuesWithNotesCount(">", 3)` |
| `issuesWithNotesAfter(date)` | Notes after date | `issue in issuesWithNotesAfter("2025-01-01")` |
| `issuesWithNotesBefore(date)` | Notes before date | `issue in issuesWithNotesBefore("2024-12-31")` |
| `issuesWithNotesInDateRange(start, end)` | Notes in range | `issue in issuesWithNotesInDateRange("2025-01-01", "2025-12-31")` |

---

## Support

For issues, feature requests, or questions about the JQL functions, please contact your Jira administrator or the app support team.

**Version**: 1.0.0  
**Last Updated**: December 21, 2025
