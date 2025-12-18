# Private Notes for Jira

A Jira Forge app that allows users to create and manage private notes on issues with sharing capabilities, deadlines, and public visibility options.

## Overview

Private Notes is a comprehensive Jira Forge application that enables users to:
- Create private notes attached to Jira issues
- Share notes with other users (read/write access)
- Set deadlines for notes
- Mark notes as public to display in the issue activity feed
- Manage note lifecycle (open/completed status)

## Current Development Status

### ✅ Completed

1. **Database Schema & Infrastructure**
   - Designed robust database schema using Forge SQL (MySQL engine)
   - Created two tables: `notes` and `note_permissions`
   - Implemented with Forge SQL limitations in mind:
     - No foreign keys (manual cleanup required)
     - Using AUTO_RANDOM for primary keys (avoiding hotspot issues)
     - Proper indexing on frequently queried columns
   - Location: `src/infrastructure/database/`

2. **Domain Layer**
   - Created domain entities: `Note` and `NotePermission`
   - Implemented business logic in `NotesService`
   - Full CRUD operations with permission checks
   - Location: `src/domain/`

3. **Shared Types**
   - Comprehensive TypeScript type definitions
   - Interfaces for services, database, and API contracts
   - Type-safe communication between layers
   - Location: `src/shared/types/`

4. **Backend Resolvers**
   - Created 9 resolver functions for all operations:
     - `createNote` - Create a new note
     - `getNoteById` - Get a single note
     - `getNotesByIssue` - Get all accessible notes for an issue
     - `getMyNotes` - Get all notes created by user
     - `updateNote` - Update note content/settings
     - `deleteNote` - Delete a note (owner only)
     - `shareNote` - Share note with read/write access
     - `revokeAccess` - Remove user access
     - `getPublicNotesByIssue` - Get public notes for activity panel
   - Location: `src/resolvers/web/`

5. **Manifest Configuration**
   - Configured Forge SQL module
   - Added Issue Panel module (main UI)
   - Added Issue Activity module (public notes display)
   - Set appropriate permissions: `read:jira-work`, `write:jira-work`, `storage:app`
   - Increased memory to 512MB for SQL operations

6. **Project Configuration**
   - TypeScript setup with strict mode
   - Jest testing framework configured
   - ESLint with TypeScript support
   - npm scripts for type-checking, linting, and testing

### 🚧 In Progress / Next Steps

1. **Frontend Development**
   - Need to build React UI for Issue Panel
   - Create components for:
     - Note list view
     - Note creation form
     - Note editing interface
     - Sharing/permissions management
     - Deadline picker
   - Location: `static/hello-world/` (to be refactored)

2. **Testing**
   - Write unit tests for domain services
   - Write integration tests for database operations
   - Write resolver tests
   - Location: `src/**/__tests__/`

3. **Deployment & Installation**
   - Install dependencies: `npm install`
   - Deploy to Forge: `forge deploy`
   - Install on Jira site: `forge install`

## Architecture

The app follows a clean architecture pattern with clear separation of concerns:

```
src/
├── index.ts                      # Main entry point
├── domain/                       # Business logic layer
│   ├── entities/                 # Domain entities
│   │   ├── note.ts
│   │   ├── note-permission.ts
│   │   └── notification.ts
│   └── services/                 # Business logic services
│       ├── notes-service.ts
│       └── notification-service.ts
├── infrastructure/               # External systems integration
│   └── database/
│       └── database-service.ts   # Database operations
├── migrations/                   # Database migrations
│   ├── schema.ts                 # DDL operations (CREATE TABLE statements)
│   └── runner.ts                 # Migration runner using migrationRunner
├── resolvers/                    # Presentation layer
│   └── web/
│       ├── notes-resolver.ts     # Note operations
│       └── notifications-resolver.ts  # Notification operations
└── shared/                       # Shared utilities
    ├── types/                    # TypeScript type definitions
    │   └── index.ts
    └── errors/                   # Custom error types
        └── index.ts
```

## Database Schema

### Notes Table
| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT (AUTO_RANDOM) | Primary key |
| issue_key | VARCHAR(255) | Jira issue key |
| title | VARCHAR(500) | Note title |
| content | TEXT | Note content |
| created_by | VARCHAR(128) | User account ID |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |
| deadline | TIMESTAMP (nullable) | Optional deadline |
| is_public | BOOLEAN | Whether note appears in activity |
| status | VARCHAR(50) | open or completed |

**Indexes:** `issue_key`, `created_by`, `is_public`

### Note Permissions Table
| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT (AUTO_RANDOM) | Primary key |
| note_id | BIGINT | Reference to notes table |
| user_account_id | VARCHAR(128) | User with access |
| permission_type | ENUM | read or write |
| granted_by | VARCHAR(128) | User who granted access |
| granted_at | TIMESTAMP | Grant timestamp |

**Indexes:** `note_id`, `user_account_id`
**Unique Constraint:** `(note_id, user_account_id)`

## Forge SQL Limitations (Important!)

This app uses Forge SQL which has specific limitations:

1. **No Foreign Keys** - Cannot use CASCADE DELETE, must manually clean up related data
2. **Single Query Per Statement** - Each SQL statement can only contain one query
3. **AUTO_RANDOM Preferred** - Used instead of AUTO_INCREMENT to avoid hotspot issues
4. **Storage Limits:**
   - Development: 128 MiB
   - Staging: 256 MiB
   - Production: 1 GiB
5. **Rate Limits:**
   - 150 DML requests/second
   - 25 DDL requests/minute
6. **Query Timeouts:**
   - SELECT: 5 seconds
   - INSERT/UPDATE/DELETE: 10 seconds
   - DDL: 20 seconds

## API Endpoints (Resolvers)

### Create Note
```typescript
resolver: createNote
payload: {
  issueKey: string
  title: string
  content: string
  deadline?: string | null
  isPublic?: boolean
}
```

### Get Notes by Issue
```typescript
resolver: getNotesByIssue
payload: {
  issueKey: string
}
```

### Update Note
```typescript
resolver: updateNote
payload: {
  noteId: string
  title?: string
  content?: string
  deadline?: string | null
  isPublic?: boolean
  status?: 'open' | 'completed'
}
```

### Share Note
```typescript
resolver: shareNote
payload: {
  noteId: string
  targetUserId: string
  permissionType: 'read' | 'write'
}
```

### Revoke Access
```typescript
resolver: revokeAccess
payload: {
  noteId: string
  targetUserId: string
}
```

### Delete Note
```typescript
resolver: deleteNote
payload: {
  noteId: string
}
```

## Development Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Type Check**
   ```bash
   npm run type-check
   ```

3. **Lint Code**
   ```bash
   npm run lint
   npm run lint:fix  # Auto-fix issues
   ```

4. **Run Tests**
   ```bash
   npm run test
   npm run test:watch    # Watch mode
   npm run test:coverage # With coverage
   ```

5. **Run All Checks**
   ```bash
   npm run ci
   ```

## Deployment

1. **Deploy to Forge**
   ```bash
   forge deploy
   ```

2. **Install on Jira Site**
   ```bash
   forge install
   ```

3. **View Logs**
   ```bash
   forge logs --follow
   ```

## Modules

### 1. Issue Panel (`private-notes-panel`)
- **Location:** Right panel on issue view
- **Purpose:** Main interface for creating and managing notes
- **Viewport Size:** Large
- **Features:** Full CRUD operations, sharing, deadline management

### 2. Issue Activity (`private-notes-activity`)
- **Location:** Activity feed on issue view
- **Purpose:** Display public notes in the issue timeline
- **Features:** Read-only view of public notes

## Permissions & Scopes

- `read:jira-work` - Read Jira issues and projects
- `write:jira-work` - Create and update notes (using Jira API if needed)
- `storage:app` - Access Forge SQL database

## Security Considerations

1. **User Authentication** - All resolvers verify user context
2. **Permission Checks** - Read/write access enforced at service layer
3. **Owner-Only Operations** - Delete and share restricted to note owner
4. **Data Isolation** - Users can only access their own notes or shared notes

## Technology Stack

- **Platform:** Atlassian Forge
- **Language:** TypeScript (strict mode)
- **Database:** Forge SQL (MySQL-compatible)
- **Frontend:** React (UI Kit - to be implemented)
- **Testing:** Jest
- **Linting:** ESLint with TypeScript support

## Project Status Summary

**Phase 1: Backend & Database** ✅ COMPLETE
- Database schema designed and implemented
- Domain entities and services created
- Backend resolvers implemented
- Manifest configured with modules and permissions

**Phase 2: Frontend Development** 🚧 NEXT
- Build React UI components
- Integrate with backend resolvers
- Implement note management interface
- Create activity feed display

**Phase 3: Testing & Polish** ⏳ PENDING
- Write comprehensive tests
- Handle edge cases
- Optimize performance
- Add error handling improvements

**Phase 4: Deployment** ⏳ PENDING
- Deploy to development environment
- Test on real Jira instance
- Fix bugs and iterate
- Deploy to production

## Database Migrations

This app uses **Forge SQL's migration system** with automatic tracking:

- **Migration Files**: `src/migrations/schema.ts` and `src/migrations/runner.ts`
- **Execution**: Runs hourly via scheduled trigger (defined in manifest.yml)
- **Tracking**: Forge SQL tracks which migrations have run on each installation
- **Installation**: Migrations run automatically within 1 hour of app installation

### Migration System Features

- ✅ Automatic execution via scheduled trigger
- ✅ Per-installation tracking
- ✅ Failed migration retry
- ✅ Ordered execution
- ✅ Comprehensive logging

**See [MIGRATIONS.md](./MIGRATIONS.md) for complete migration documentation.**

## Notes for Developers

1. **Database Migrations** - Use `migrationRunner` for all schema changes; migrations run automatically via scheduled trigger
2. **Type Safety** - Never use `any` or `unknown` types; always define proper interfaces
3. **Error Handling** - Custom error types in `src/shared/errors/`
4. **Testing** - Tests go in `__tests__/` folders next to source files
5. **Forge SQL** - Remember the limitations (no foreign keys, single query per statement)

## Future Enhancements

- Rich text editor for note content
- Note templates
- Bulk operations
- Export notes functionality
- Search and filter capabilities
- Email notifications for shared notes
- Integration with Jira notifications

## Support

See [Get help](https://developer.atlassian.com/platform/forge/get-help/) for how to get help and provide feedback.

---

**Last Updated:** Backend complete with proper Forge SQL migrations - Ready for frontend development

## Important Files

- `MIGRATIONS.md` - Complete database migration documentation
- `manifest.yml` - Forge app configuration with scheduled trigger for migrations
- `src/migrations/` - Database migration system
- `src/shared/types/` - TypeScript type definitions
