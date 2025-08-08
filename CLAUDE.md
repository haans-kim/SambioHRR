# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
HR Dashboard for organizational work analysis and rebalancing, built with React + Next.js and SQLite database.

## Tech Stack
- **Frontend**: React + Next.js (App Router)
- **UI Framework**: shadcn/ui (clean design, no emojis)
- **Database**: SQLite with better-sqlite3
- **Language**: TypeScript

## Key Database Tables
- `daily_work_data`: Individual employee daily work metrics
- `shift_work_data`: Employee shift timing data  
- `organization_summary`: Aggregated organization-level metrics
- `organization_master`: Organization hierarchy (center → team → group)
- `organization_daily_stats`: Daily organization statistics
- `organization_monthly_stats`: Monthly organization statistics

## Organization Hierarchy
```
center (센터)
  └── team (팀)
      └── group (그룹)
```

## Core Metrics
- **근태기록시간** (Clock-in/out time)
- **실제 작업시간** (Actual work time)
- **작업시간 추정률** (Work time efficiency ratio)
- **회의시간** (Meeting time)
- **식사시간** (Meal time)
- **이동시간** (Travel time)
- **휴식시간** (Rest time)
- **데이터 신뢰도** (Data reliability score)

## Development Commands
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Database operations
sqlite3 sambio_human.db

# Type checking
npm run type-check

# Linting
npm run lint
```

## Project Structure
```
HR_Dashboard/
├── app/                    # Next.js app router pages
│   ├── layout.tsx         # Root layout with navigation
│   ├── page.tsx           # Center view (default)
│   ├── team/[id]/page.tsx # Team detail view
│   └── group/[id]/page.tsx # Group detail view
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── dashboard/         # Dashboard-specific components
│   │   ├── CenterView.tsx
│   │   ├── TeamView.tsx
│   │   └── GroupView.tsx
│   └── navigation/
│       └── Breadcrumb.tsx # Center > Team > Group navigation
├── lib/
│   ├── db.ts              # Database connection and utilities
│   └── queries/           # SQL query functions
│       ├── organization.ts
│       └── workData.ts
└── types/                 # TypeScript type definitions
```

## Key Features & UI Requirements
1. **Three-level hierarchy views** with drill-down navigation:
   - Center view: Stock market-style display with markers and colors
   - Team view: Shows teams within selected center
   - Group view: Shows groups within selected team

2. **Color-coded performance indicators**:
   - Based on work hours
   - Based on efficiency ratio (actual work time / clocked time)
   - User-selectable metric display

3. **Breadcrumb navigation**: Easy navigation between center/team/group levels

4. **Data aggregation**: 
   - Daily and monthly aggregation
   - Selective organization analysis
   - Real-time database updates

## Database Connection Example
```typescript
import Database from 'better-sqlite3';

const db = new Database('./sambio_human.db', { readonly: false });

// Get organization data
const getOrganizationData = (orgLevel: 'center' | 'team' | 'group') => {
  return db.prepare(`
    SELECT * FROM organization_master 
    WHERE org_level = ? AND is_active = 1
    ORDER BY display_order
  `).all(orgLevel);
};
```

## API Routes Structure
```
/api/
├── organizations/
│   ├── centers/       # GET all centers
│   ├── teams/[id]     # GET teams by center
│   └── groups/[id]    # GET groups by team
└── work-data/
    ├── daily/         # GET daily aggregated data
    └── monthly/       # GET monthly aggregated data
```

## Component Patterns
- Use server components for data fetching
- Client components for interactive elements (metric selection, drill-down)
- Implement loading states with React Suspense
- Use shadcn/ui components consistently (no custom styling)

## Performance Considerations
- Implement database indices on frequently queried columns
- Use SQL aggregation instead of JavaScript for large datasets
- Cache organization hierarchy data
- Implement pagination for historical data views

## Data Flow
1. SQLite database → better-sqlite3 queries
2. Server components fetch data via db utilities
3. Pass data to client components as props
4. User interactions trigger navigation or metric changes
5. Breadcrumb maintains navigation state

## Testing Approach
- Unit tests for database queries
- Component tests for UI elements
- E2E tests for navigation flow
- Performance tests for large dataset handling