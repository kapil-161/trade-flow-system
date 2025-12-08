# Nexus TMS - Trading Management System

## Overview

Nexus TMS is a professional-grade trading management system designed for tracking and managing multi-asset portfolios across stocks and cryptocurrencies. The application provides real-time market data, portfolio analytics, risk monitoring, and trade execution capabilities through a modern, responsive web interface.

The system follows a full-stack architecture with a React-based frontend, Express backend, PostgreSQL database using Drizzle ORM, and integrates with Yahoo Finance API for market data.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- **React 18** with TypeScript for type-safe component development
- **Vite** as the build tool and development server, providing fast HMR and optimized production builds
- **Wouter** for lightweight client-side routing instead of React Router
- **TanStack Query (React Query)** for server state management, caching, and data synchronization

**UI & Styling**
- **Tailwind CSS v4** with custom theme configuration via CSS variables
- **shadcn/ui** component library built on Radix UI primitives
- Custom design system with:
  - Inter font for UI text
  - JetBrains Mono for numerical data display
  - Neutral color palette with dark theme optimized for financial data
  - Animated components using custom CSS animations
- Background imagery and gradient overlays for visual depth

**State Management Pattern**
- Server state managed through TanStack Query with automatic refetching and caching
- Local UI state managed via React hooks
- No global state management library (Redux/Zustand) - relies on composition and prop drilling with context where needed

**Component Architecture**
- Dashboard-based layout with sidebar navigation
- Modular dashboard widgets (Portfolio Summary, Financial Chart, Active Positions, Risk Monitor, Market Ticker)
- Reusable UI components from shadcn/ui library
- Form management using React Hook Form with Zod validation

### Backend Architecture

**Framework & Runtime**
- **Express.js** on Node.js for HTTP server
- **TypeScript** throughout with ES modules
- Development server uses `tsx` for TypeScript execution
- Production builds bundle to CommonJS using esbuild

**API Design**
- RESTful endpoints under `/api` namespace
- Market data proxy endpoints to Yahoo Finance
- CRUD operations for holdings, trades, and watchlist
- Response format: JSON with appropriate HTTP status codes

**Database Layer**
- **Drizzle ORM** for type-safe database queries and schema management
- **PostgreSQL** as the primary database (connection via `pg` driver)
- Schema-first approach with TypeScript types generated from Drizzle schema
- Database migrations stored in `/migrations` directory

**Data Models**
- `users` - Authentication and user management
- `holdings` - Current asset positions with quantity and average price
- `trades` - Transaction history with buy/sell records
- `watchlist` - Tracked assets without positions
- All tables use UUID primary keys via `gen_random_uuid()`
- Decimal fields for precise financial calculations (18,8 for quantities, 18,2 for prices)

**Build & Deployment**
- Custom build script bundles server and client separately
- Server bundled with esbuild, selectively bundling dependencies to reduce syscalls
- Client built with Vite to `dist/public`
- Static file serving in production mode

### Data Flow Architecture

**Market Data Integration**
- Yahoo Finance API used as primary market data source
- Server-side proxy endpoints prevent CORS issues and enable caching
- Quote data refreshed every 30 seconds via TanStack Query
- Historical data fetched on-demand with configurable timeframes

**Portfolio Calculations**
- Real-time P&L calculated client-side by combining holdings with current prices
- Portfolio statistics (total equity, win rate, Sharpe ratio) computed server-side
- Risk metrics (VaR, max drawdown) calculated on backend

**Trading Workflow**
1. User submits order via OrderDialog component
2. Frontend validates input with Zod schema
3. Trade record created in database
4. Holdings table updated based on trade side (buy/sell)
5. UI refreshes via TanStack Query invalidation

### External Dependencies

**Third-Party Services**
- **Yahoo Finance API** (query1.finance.yahoo.com) - Real-time and historical market data for stocks and cryptocurrencies
- **Replit Infrastructure** - Deployment domain detection via environment variables for OpenGraph meta tags

**Key NPM Packages**
- **drizzle-orm** & **drizzle-kit** - Database ORM and migration tooling
- **pg** - PostgreSQL client
- **express** - Web server framework
- **@tanstack/react-query** - Async state management
- **zod** - Schema validation
- **recharts** - Financial charting components
- **date-fns** - Date manipulation utilities
- **@radix-ui/** - Headless UI component primitives
- **lucide-react** - Icon library
- **tailwindcss** - Utility-first CSS framework

**Development Tools**
- **@replit/vite-plugin-*** - Replit-specific development tooling (cartographer, dev banner, runtime error overlay)
- Custom Vite plugin for meta image URL generation based on deployment domain

**Database Infrastructure**
- Expects `DATABASE_URL` environment variable for PostgreSQL connection
- Uses `connect-pg-simple` for session storage (imported but not actively used in current codebase)
- Database schema managed via Drizzle Kit migrations

**Font & Asset Hosting**
- Google Fonts CDN for Inter and JetBrains Mono typefaces
- Local assets stored in `attached_assets` directory
- Public static files served from `client/public`