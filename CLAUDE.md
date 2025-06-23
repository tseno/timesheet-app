# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Frontend (Next.js)
```bash
cd frontend
npm install           # Install dependencies
npm run dev          # Start development server (port 3000) with Turbopack
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Backend (Fastify + SQLite)
```bash
cd backend
npm install          # Install dependencies
npm run dev          # Start development server (listens on port 8000)
npm start            # Start production server
```

## Architecture Overview

### Project Structure
- **Frontend**: Single-page Next.js application in `/frontend/src/app/page.tsx`
- **Backend**: Fastify REST API server with SQLite database
- **Database**: SQLite with two main tables: `timesheets` and `monthly_timesheet_status`

### Key Components

#### Frontend (`/frontend/src/app/page.tsx`)
- **Single Component Architecture**: All timesheet functionality is contained in one React component
- **Two View States**: 
  - `list`: Monthly timesheet selection view
  - `monthly`: Daily timesheet entry form view
- **Status Management**: Draft → Submitted → Approved/Rejected workflow
- **Bulk Operations**: Save multiple days simultaneously via `handleBulkSave()`

#### Backend (`/backend/server.js`)
- **RESTful API**: Handles CRUD operations for timesheets
- **UPSERT Logic**: Uses `ON CONFLICT(date) DO UPDATE` to handle existing records
- **Status Management**: Separate endpoints for timesheet status changes
- **CORS**: Configured for `http://localhost:3000`

#### Database (`/backend/database.js`)
- **Timesheets Table**: Stores daily entries with UNIQUE constraint on date
- **Monthly Status Table**: Tracks submission status per month with UNIQUE constraint on (year, month)

### Data Flow
1. Frontend fetches monthly data by making individual API calls for each day
2. User input is managed in React state via `handleBulkInputChange()`
3. Bulk save operation sends all modified days to backend simultaneously
4. Backend performs UPSERT operations to prevent duplicate entries
5. Frontend refetches data after save operations with 100ms delay to handle async database operations

### Important Implementation Details
- **Japanese Interface**: All user-facing text is in Japanese
- **Time Calculations**: Backend calculates total hours automatically (start - end - break)
- **Status-based Permissions**: UI restricts editing based on timesheet submission status
- **Race Condition Handling**: Uses `setTimeout()` delay before data refetch to ensure database consistency
- **Error Handling**: Includes snackbar notifications and alert dialogs for user feedback

### API Endpoints
- `GET /api/timesheets/:date` - Fetch single day data (returns latest record)
- `POST /api/timesheets` - Create/update timesheet entry
- `GET /api/timesheets/months-with-status` - Get available months with status
- `GET /api/timesheets/status/:year-month` - Get monthly status
- `POST /api/timesheets/status` - Update monthly status

## Git Commit Guidelines
- **Language**: Use Japanese for commit messages
- **Format**: Simple, descriptive messages in Japanese
- **No Signatures**: Do not include Claude Code signatures or co-authored-by tags in commit messages
- **Example**: `勤務表入力画面のヘッダーデザインを修正`