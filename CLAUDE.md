# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
SambioHRR - HR analytics dashboard for organizational work analysis and rebalancing, built with Next.js and SQLite.

## Tech Stack
- **Framework**: Next.js 15.4 (App Router) with TypeScript
- **UI Components**: 
  - shadcn/ui components
  - Magic UI components (bento-grid, magic-card, number-ticker, animated-circular-progress-bar, neon-gradient-card)
- **Database**: SQLite with better-sqlite3
- **State Management**: Zustand
- **Data Fetching**: React Query (TanStack Query)
- **Styling**: Tailwind CSS v4

## Development Commands
```bash
# Run development server (default port 3003)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

## Database Configuration
- Database file: `sambio_human.db` (symlinked from `../NewAnalysis/data/`)
- Connection configured in `/lib/db.ts` with optimizations
- Key tables:
  - `daily_work_data`: Individual employee daily metrics
  - `daily_analysis_results`: Analyzed work patterns
  - `organization_master`: Organization hierarchy
  - `organization_monthly_stats`: Monthly aggregated stats
  - `employee_info`: Employee details
  - `tag_data`: Activity tracking data

## Project Architecture

### Organization Hierarchy
```
center (센터)
  └── division (담당) - optional level
      └── team (팀) 
          └── group (그룹)
```

### Core Features
1. **Individual Analysis** (`/individual`): Employee-level work pattern analysis
2. **Organization Analysis** (`/organization`): Batch analysis with Miller column navigation
3. **Dashboard Views**: Center, Division, Team, Group hierarchical displays
4. **Insights**: Salary-worktime analysis, pattern analysis

### API Routes Structure
- `/api/organization/`: Organization data and batch analysis
- `/api/employees/`: Individual employee analytics
- `/api/insights/`: Advanced analytics and patterns
- `/api/statistics/`: Aggregated statistics

### Key Analysis Metrics
- 총 체류시간 (Total presence time)
- 실제 작업시간 (Actual work time)  
- 추정작업시간 (Estimated work time)
- 작업추정률 (Work efficiency ratio)
- 집중작업시간 (Focused work time)
- 회의시간 (Meeting time)
- 식사시간 (Meal time)
- 이동시간 (Transit time)
- 비업무시간 (Rest/non-work time)
- 데이터 신뢰도 (Data reliability score)

## Analysis Components

### WorkHourCalculator (`/lib/analytics/WorkHourCalculator.ts`)
Core analysis engine that processes tag data to calculate work metrics using state machine logic.

### Miller Column Navigation
Interactive organization selector with breadcrumb navigation supporting 3-4 level hierarchies.

### Batch Analysis Features
- Resumable analysis with DB checkpointing
- Progress tracking and elapsed time display
- Excel export functionality
- Handles large datasets with chunked processing

## Important Configuration
- Server components fetch data directly via database queries
- Client components use React Query for data fetching
- All pages set to `force-dynamic` for real-time data
- Database uses DELETE journal mode (not WAL) for better compatibility