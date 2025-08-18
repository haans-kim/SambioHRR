# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
HR Dashboard for organizational work analysis and rebalancing, built with React + Next.js and SQLite database.

## Tech Stack
- **Frontend**: React + Next.js (App Router)
- **UI Framework**: 
  - shadcn/ui (base components)
  - Magic UI (interactive components)
    - bento-grid (layout system)
    - magic-card (spotlight effects)
    - number-ticker (animated numbers)
    - animated-circular-progress-bar (performance gauges)
    - neon-gradient-card (alerts)
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
  └── division (담당) - optional, some centers have this level
      └── team (팀)
          └── group (그룹)
```

Note: The database currently uses 3 levels (center/team/group) where "담당" appears as names within team/group levels. The application should handle both 3-level and 4-level hierarchies flexibly.

## Core Metrics
- **근태기록시간** (Clock-in/out time)
- **실제 근무시간** (Actual work time)
- **근무시간 추정률** (Work time efficiency ratio)
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
│   ├── division/[id]/page.tsx # Division detail view (optional level)
│   ├── team/[id]/page.tsx # Team detail view
│   └── group/[id]/page.tsx # Group detail view
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── dashboard/         # Dashboard-specific components
│   │   ├── CenterView.tsx
│   │   ├── DivisionView.tsx
│   │   ├── TeamView.tsx
│   │   └── GroupView.tsx
│   └── navigation/
│       └── Breadcrumb.tsx # Center > Division > Team > Group navigation
├── lib/
│   ├── db.ts              # Database connection and utilities
│   └── queries/           # SQL query functions
│       ├── organization.ts
│       └── workData.ts
└── types/                 # TypeScript type definitions
```

## Key Features & UI Requirements
1. **Four-level hierarchy views** with drill-down navigation:
   - Center view: Stock market-style display with markers and colors
   - Division view: Shows divisions within selected center (optional level)
   - Team view: Shows teams within selected division or center
   - Group view: Shows groups within selected team

2. **Color-coded performance indicators**:
   - Based on work hours
   - Based on efficiency ratio (actual work time / clocked time)
   - User-selectable metric display

3. **Breadcrumb navigation**: Easy navigation between center/division/team/group levels (handles both 3 and 4 level hierarchies)

4. **Data aggregation**: 
   - Daily and monthly aggregation
   - Selective organization analysis
   - Real-time database updates

## Database Connection Example
```typescript
import Database from 'better-sqlite3';

const db = new Database('./sambio_human.db', { readonly: false });

// Get organization data
const getOrganizationData = (orgLevel: 'center' | 'division' | 'team' | 'group') => {
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
│   ├── divisions/[id] # GET divisions by center (optional)
│   ├── teams/[id]     # GET teams by division or center
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