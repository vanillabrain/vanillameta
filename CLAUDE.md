# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**VanillaMeta** is an enterprise Business Intelligence (BI) web application for data exploration and visualization. It provides a no-code interface for creating 50+ chart types, building dashboards, managing database connections, and executing SQL queries. Supports 10+ SQL databases including PostgreSQL, MySQL, MariaDB, SQLServer, SQLite, Oracle, Redshift, BigQuery, Snowflake, and CockroachDB.

## Architecture Overview

This is a **monorepo** with multiple services:

### 1. Backend API (`backend-api/`)
- **Framework**: NestJS 9.x with TypeORM
- **Database**: TypeORM with support for 10+ SQL databases
- **Deployment**: AWS Lambda (serverless) via Serverless Framework
- **Key Modules**:
  - `auth/` - JWT-based authentication with passport strategy
  - `connection/` - Database connection management
  - `dataset/` - Query definition and dataset management
  - `dashboard/` - Dashboard CRUD operations
  - `component/` - Widget/component creation and configuration
  - `database/` - Database schema introspection
  - `login/` - User login/logout with session management
  - `common/` - Guards, interceptors, filters, decorators
  - `middleware/` - Request/response processing

### 2. Frontend Web (`frontend-web/`)
- **Framework**: React 18.x with TypeScript
- **UI Library**: Material-UI (MUI) 5.x
- **Visualization**: ECharts 5.x with echarts-for-react
- **Editor**: CodeMirror for SQL editing
- **Grid**: react-grid-layout for dashboard composition
- **Key Pages**:
  - Dashboard builder and viewer
  - Dataset creation and management
  - Database connection setup
  - SQL query editor with preview
  - Widget configuration
  - User profile management

### 3. Lambda Layer (`backend-api-libs-lambda-layer/`)
- Shared dependencies for Lambda functions
- Bundled as Lambda layer for serverless deployment

### 4. Landing Page (`landing-page/`)
- Static informational website
- Built with React

## Development Setup

### Installation

```bash
# Backend
cd backend-api
npm install

# Frontend
cd frontend-web
npm install

# Lambda Layer (if needed)
cd backend-api-libs-lambda-layer
npm install
```

### Running Locally

#### Backend
```bash
# Development mode with watch
cd backend-api
npm run start:dev           # NODE_ENV=dev with hot reload
npm run start:local        # NODE_ENV=local with hot reload
npm run start:prod         # Production mode
npm run start:debug        # Debug mode with breakpoints

# Seed database with initial data
npm run seed
```

#### Frontend
```bash
cd frontend-web
npm run start              # Start dev server (localhost:3000)
npm run build              # Production build
```

#### Full Stack Local
```bash
# Terminal 1: Backend
cd backend-api
npm run seed:run           # Initialize database
npm run start:dev

# Terminal 2: Frontend
cd frontend-web
npm run start
```

**Default Login Credentials** (after seeding):
- ID: `guest`
- Password: `Admin!@12`

Change password in user profile after first login.

## Database & ORM

- **ORM**: TypeORM with migrations support
- **Seeding**: typeorm-extension for data seeding
- **SQLite**: Supported for local development
- **Key Files**:
  - `backend-api/src/data-source.ts` - TypeORM data source config
  - `backend-api/src/database/` - Database-specific configuration

### Database Commands

```bash
cd backend-api

# Create and run seeds
npm run seed

# View seeding status
npm run seed:show
```

## Testing

### Backend Tests

```bash
cd backend-api

npm test                   # Run all tests once
npm run test:watch        # Watch mode
npm run test:cov          # Coverage report
npm run test:debug        # Debug mode
npm run test:e2e          # E2E tests (uses jest-e2e.json config)
```

**Test Configuration**:
- Jest for unit and integration tests
- E2E tests configured in `test/jest-e2e.json`
- Test files: `**/*.spec.ts` files co-located with source

### Frontend Tests

```bash
cd frontend-web

npm test                   # Run tests in watch mode
npm run build              # Verify production build works
```

**Test Configuration**:
- Jest configured in `jest.config.json`
- React Testing Library for component tests

## Code Quality

### Linting & Formatting

```bash
# Backend
cd backend-api
npm run lint               # ESLint with --fix flag
npm run format             # Prettier formatting

# Frontend
cd frontend-web
npm run lint               # ESLint
npm run format             # Prettier
```

**Configuration Files**:
- Backend: `.eslintrc.js`, `tsconfig.json`
- Frontend: `.eslintrc.json`, `tsconfig.json`
- Prettier config: Usually in `package.json` or `.prettierrc`

### TypeScript

Both backend and frontend use strict TypeScript configuration:
- Backend: `backend-api/tsconfig.json` and `tsconfig.build.json`
- Frontend: `frontend-web/tsconfig.json`

## Deployment

### Backend (AWS Lambda)

```bash
cd backend-api

# Deploy to development environment
npm run deploy:dev       # Requires serverless framework setup

# Deploy to production
npm run deploy:prod

# Or use serverless directly
serverless deploy --stage dev
serverless deploy --stage prod
```

**Serverless Configuration**: `backend-api/serverless.yml`
- Lambda handler setup
- Environment variables configuration
- API Gateway routing
- CloudFormation resources

### Frontend (Serverless)

```bash
cd frontend-web

# Frontend deployment (check serverless.yml for destination)
npm run build
# Deploy via serverless.yml configuration
```

**Serverless Configuration**: `frontend-web/serverless.yml`

### Docker (for local development/testing)

```bash
cd backend-api

# Build Docker image
docker-compose build

# Run with docker-compose
docker-compose up

# Available in: docker-compose.yml
```

## Key Development Patterns

### NestJS Module Structure

Each module follows NestJS conventions:
```
module-name/
├── module-name.module.ts      # Module definition with imports/exports
├── module-name.controller.ts   # HTTP endpoints
├── module-name.service.ts      # Business logic
├── dto/                        # Data Transfer Objects (request/response)
├── entities/                   # TypeORM entities
├── interfaces/                 # TypeScript interfaces
└── module-name.spec.ts        # Tests
```

### React Component Structure

```
components/
├── ComponentName/
│   ├── ComponentName.tsx       # Main component
│   ├── ComponentName.module.css # Styles
│   └── __tests__/              # Component tests
```

### Authentication Flow

1. **Login**: Username/password → JWT token
2. **Token Storage**: Stored in HTTP-only cookie
3. **Request Handling**: JWT middleware validates token in guards
4. **Token Expiration**: Re-login flow for expired sessions
5. **Guard Usage**: `@UseGuards(JwtAuthGuard)` on protected endpoints

**Key Files**:
- `backend-api/src/auth/` - Auth module
- `backend-api/src/middleware/` - Token validation

### Database Connection Management

Users can create connections to multiple databases:

1. **Connection Entity**: Stores connection metadata
2. **Connection Service**: Manages connection pool
3. **Query Service**: Executes queries against selected connection
4. **Dataset**: Groups queries with column metadata

**Key Files**:
- `backend-api/src/connection/` - Connection CRUD
- `backend-api/src/database/` - Database introspection

## Common Tasks

### Adding a New API Endpoint

1. Create DTO in `module/dto/create-resource.dto.ts`
2. Add method to controller: `@Post()` or similar
3. Implement logic in service
4. Add validation using class-validator decorators
5. Add tests in `*.spec.ts` file

### Adding a Database Connection Type

1. Extend `database/config/` with driver-specific config
2. Add introspection queries in database service
3. Test connection with real database
4. Update frontend database selection UI

### Creating a New Dashboard Widget

1. Add widget type in backend component module
2. Define widget schema in DTO
3. Implement ECharts configuration in frontend
4. Add widget creation/editing UI component
5. Test with sample data

### Modifying the Dashboard Grid

The dashboard uses `react-grid-layout`:
- Positions stored in database
- Layout changes trigger API updates
- Component resizing is immediate, persistence is asynchronous

## Important Notes

### Environment Variables

Create `.env` files for each environment:
- `.env` or `.env.local` for local development
- `.env.dev` for development environment
- `.env.prod` for production

**Backend variables** (in `backend-api`):
- Database connection strings
- JWT secret
- AWS credentials
- API ports and hosts

**Frontend variables** (in `frontend-web`):
- API base URL
- Environment flags

### Database Seeding

Default seeding creates:
- Default user account (guest/Admin!@12)
- Sample databases and datasets
- Example dashboards and widgets

Run `npm run seed` in backend to initialize.

### Performance Considerations

1. **N+1 Queries**: Use QueryBuilder relations to eager-load related data
2. **Chart Rendering**: Large datasets may cause UI lag; consider pagination or sampling
3. **SQL Query Validation**: Validate queries before execution to prevent timeouts
4. **Lambda Cold Starts**: Lambda layer and proper bundling can reduce startup time

### Monorepo Notes

- Each package has its own `package.json` with independent dependencies
- No root-level package manager lock file
- Install dependencies in each module separately
- Tests run within each module independently

## Useful Resources

- **NestJS Docs**: https://docs.nestjs.com/
- **TypeORM Docs**: https://typeorm.io/
- **React Docs**: https://react.dev/
- **Material-UI Docs**: https://mui.com/
- **ECharts Docs**: https://echarts.apache.org/
