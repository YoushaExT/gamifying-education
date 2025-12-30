# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Gamifying Education** - A full-stack web application for educational MCQ quizzes with AI question generation and a 2-player turn-based card combat game. Built with FastAPI (backend) and React (frontend).

### Core Features
- **Card Combat Game**: 2-player turn-based game with Three.js graphics and WebSocket real-time communication
- **AI Question Generation**: OpenAI GPT-powered question generation with diversity optimization
- **Quiz System**: Timed/untimed quizzes with detailed results
- **Question Management**: Rich text editor with code blocks and LaTeX math
- **Feature Flags**: Runtime feature control with role-based access

## Essential Commands

### Development Setup

```bash
# Start full stack with hot reload
docker compose watch

# Start detached
docker compose up -d

# Clean restart (removes volumes)
docker compose down -v && docker compose watch

# View logs
docker compose logs -f backend
docker compose logs -f frontend
```

### Backend Development

```bash
cd backend

# Setup (one-time)
uv sync
source .venv/bin/activate

# Local development server
fastapi dev app/main.py  # http://localhost:8000

# Code quality
bash scripts/format.sh    # Auto-fix with ruff
bash scripts/lint.sh      # Check with ruff + mypy

# Testing
bash scripts/test.sh      # Run all tests with coverage
pytest tests/ -v          # Verbose output
pytest tests/ -x          # Stop on first failure

# Inside Docker container
docker compose exec backend bash
fastapi run --reload app/main.py
```

### Frontend Development

```bash
cd frontend

# Setup (one-time)
nvm use           # Uses Node 24 from .nvmrc
npm install

# Local development server
npm run dev       # http://localhost:5173

# Code quality
npm run lint      # Auto-fix with Biome
npx biome check ./  # Check only

# Testing
npx playwright test      # Run E2E tests
npx playwright test --ui # Interactive mode

# Add UI component
npx shadcn@latest add [component-name]
```

### Database Migrations

**CRITICAL**: Always run migrations from LOCAL venv, NOT Docker.

```bash
cd backend
source .venv/bin/activate

# Create migration after model changes
alembic revision --autogenerate -m "Description of changes"

# Review generated migration in app/alembic/versions/
# Then apply migration
alembic upgrade head

# Rollback if needed
alembic downgrade -1

# View migration history
alembic history
```

### API Client Generation

After ANY changes to backend API routes or models:

```bash
./scripts/generate-client.sh
```

This regenerates `frontend/src/client/` from the OpenAPI schema.

## Architecture

### Backend Structure

```
backend/app/
├── alembic/versions/      # Database migrations
├── api/routes/            # API endpoints
│   ├── questions.py       # Question CRUD
│   ├── question_generation.py  # AI generation API
│   ├── quizzes.py         # Quiz system
│   ├── multiplayer_game.py     # Card game WebSocket
│   └── feature_flags.py   # Feature flag management
├── core/                  # Configuration and security
│   ├── config.py          # Settings (environment variables)
│   ├── db.py              # Database connection
│   └── security.py        # JWT, password hashing
├── services/              # Business logic
│   ├── game_service.py    # Card combat mechanics
│   ├── card_template_service.py  # Card/deck loading
│   ├── question_generator.py     # AI generation orchestration
│   ├── diversity_analyzer.py     # Question diversity scoring
│   └── feature_flags.py   # Feature flag resolution
├── card_templates/        # YAML card definitions
├── question_templates/    # AI prompt templates
├── models.py              # SQLModel database models
├── crud.py                # Database operations
└── main.py                # FastAPI app entry point
```

### Frontend Structure

```
frontend/src/
├── client/                # Generated OpenAPI client (DO NOT EDIT)
├── components/
│   ├── Common/            # Navbar, Sidebar
│   ├── Questions/         # Question CRUD UI
│   ├── QuestionGeneration/  # AI generation UI
│   ├── MultiplayerGame/   # Card game UI
│   ├── Game/              # Reusable game components
│   │   └── OutlinedText.tsx   # 3D text with outline for visibility
│   ├── modals/            # Event-based modal system
│   │   ├── ModalRoot.tsx      # Root component (listens to events)
│   │   └── ModalWrappers.tsx  # Dialog/AlertDialog/Confirmation wrappers
│   └── ui/                # shadcn components
├── services/              # Frontend services
│   ├── events/            # Event system
│   │   └── EventService.ts    # Simple event emitter
│   └── modals/            # Modal service
│       ├── ModalService.ts           # Singleton modal controller
│       ├── ModalService.interface.ts # TypeScript interfaces
│       ├── ModalRegistry.ts          # Modal component registry
│       └── index.ts                  # Barrel exports
├── constants/             # App-wide constants
│   ├── fonts.ts           # Font paths (GAME_FONT)
│   ├── colors.ts          # Color constants (COLORS)
│   └── index.ts           # Barrel exports
├── models/                # Three.js 3D components
│   ├── Card3D.tsx         # 3D card with hover
│   ├── HealthBar3D.tsx    # 3D health bar with disconnection state
│   └── Shield3D.tsx       # Shield icon background
├── contexts/              # React contexts
├── hooks/                 # Custom hooks
│   ├── useConfirm.ts      # Confirmation modal hook
│   └── useGameWebSocket.ts
├── routes/_layout/        # File-based routing (TanStack Router)
│   ├── admin/             # Admin pages
│   ├── quiz/              # Quiz pages
│   └── game/              # Card game pages
└── routeTree.gen.ts       # Auto-generated (DO NOT EDIT)
```

### Key Technologies

**Backend**:
- FastAPI + SQLModel (Python 3.10+)
- PostgreSQL 17 + Alembic migrations
- OpenAI API for question generation
- uv for package management

**Frontend**:
- React 19 + TypeScript
- Vite build tool
- TanStack Router (file-based) + TanStack Query
- Tailwind CSS 4 + shadcn/ui
- Three.js + React Three Fiber for 3D graphics
- TipTap rich text editor + KaTeX math rendering

## Critical Development Patterns

### Always Use Generators

| Task | Command | Never Do |
|------|---------|----------|
| Database migrations | `alembic revision --autogenerate` | Manual SQL |
| API client | `./scripts/generate-client.sh` | Manual fetch |
| UI components | `npx shadcn@latest add [name]` | Copy-paste |

### API Calls in Frontend

```typescript
// ✅ CORRECT - Use generated client
import { QuestionsService } from "@/client"

const { data } = useQuery({
  queryKey: ["questions"],
  queryFn: () => QuestionsService.getQuestions()
})

// ❌ WRONG - Manual fetch
const { data } = useQuery({
  queryFn: () => fetch("/api/v1/questions").then(r => r.json())
})
```

### Database Model Changes

1. Edit `backend/app/models.py`
2. Run `alembic revision --autogenerate -m "description"`
3. Review generated migration in `app/alembic/versions/`
4. Run `alembic upgrade head`
5. Add CRUD operations in `backend/app/crud.py`

### Adding API Endpoints

1. Create route in `backend/app/api/routes/`
2. Register in `backend/app/api/main.py`
3. Run `./scripts/generate-client.sh`
4. Use generated client in frontend

### Frontend Routing

TanStack Router uses file-based routing. Files in `frontend/src/routes/` automatically become routes.

- `routes/index.tsx` → `/`
- `routes/_layout/admin/questions.tsx` → `/admin/questions`
- `routes/_layout/game/play.$gameId.tsx` → `/game/play/:gameId`

**DO NOT** edit `routeTree.gen.ts` - it's auto-generated.

### Conditional Styling with `cn`

Use the `cn` utility function for conditional CSS classes. It combines class names and handles conditional logic cleanly.

**Import:**
```typescript
import { cn } from "@/lib/utils"
```

**Syntax:**
```typescript
className={cn('base-classes always-applied', {
  'conditional-classes': condition
})}
```

**Example:**
```typescript
<div
  className={cn(
    'w-full h-full rounded-lg p-4 flex items-center border-0',
    {
      'hover:bg-gray-50': isInteractive,
      'opacity-50 cursor-not-allowed': isDisabled,
      'bg-blue-500 text-white': isActive
    }
  )}
>
  Content
</div>
```

**Multiple conditions:**
```typescript
className={cn(
  'base-button px-4 py-2 rounded',
  {
    'bg-primary text-white': variant === 'primary',
    'bg-secondary text-gray-900': variant === 'secondary',
    'hover:shadow-lg': !isDisabled,
    'opacity-50': isLoading
  }
)}
```

## Important Architectural Patterns

### Question Management

- Questions are stored as HTML (not markdown)
- HTML is sanitized with Bleach library to prevent XSS
- Code blocks use highlight.js for syntax highlighting
- Math equations use KaTeX (LaTeX format: `$inline$` or `$$block$$`)
- Rich text editing via TipTap editor
- Subjects and Topics are auto-created on save (case-insensitive unique)

### AI Question Generation

**See `backend/QUESTION_GENERATION_ARCHITECTURE.md` for details.**

Key points:
- Template-based generation with subject/topic enforcement
- Multi-layer validation (format → optional content quality)
- Diversity scoring prevents repetitive questions
- Admin review workflow (approve/reject)
- Batch generation with retry logic

### Card Combat Game

- Uses WebSocket for real-time communication (`/api/v1/multiplayer/games/{game_id}/ws`)
- Card templates defined in YAML (`backend/app/card_templates/`)
- Each card play triggers an MCQ question popup
- Correct answer → max effect, wrong answer → min effect
- Game state managed server-side for security
- 3D graphics with Three.js (React Three Fiber)

### Constants Pattern

Shared constants are centralized in `frontend/src/constants/`:
- `fonts.ts` - Font file paths (e.g., `GAME_FONT`)
- `colors.ts` - Color constants (e.g., `COLORS.LIGHT_BROWN`)
- `index.ts` - Barrel exports for clean imports

**Usage:**
```typescript
import { GAME_FONT, COLORS } from "@/constants"
```

### Reusable Game Components

Game-specific reusable components in `frontend/src/components/Game/`:
- `OutlinedText.tsx` - 3D text with outline for visibility on any background
  - Default: white text with black outline
  - Customizable: `textColor`, `outlineColor`, `outlineWidth` props
  - Used for player names, turn indicators, deck counter

**Usage:**
```typescript
import { OutlinedText } from "@/components/Game"

<OutlinedText
  textColor="white"
  outlineColor="black"
  fontSize={0.3}
  position={[0, 0, 0]}
>
  Your Text
</OutlinedText>
```

### Modal System

Event-based modal system for confirmations and custom modals.

**Easy confirmations**:
```typescript
import { useConfirm } from "@/hooks/useConfirm"

const { confirm } = useConfirm()

const confirmed = await confirm({
  title: "Delete Item",
  description: "Are you sure?",
  variant: "destructive" // or "default"
})

if (confirmed) {
  performDeletion()
}
```

**From non-React code**:
```typescript
import ModalService from "@/services/modals/ModalService"

const confirmed = await ModalService.confirm({ title: "...", description: "..." })
```

**Key files**: `services/modals/`, `components/modals/`, `hooks/useConfirm.ts`

### Feature Flags

Priority resolution:
1. Environment variable (highest)
2. User-specific (UUID list)
3. Role-based (teacher, superuser)
4. Global toggle (lowest)

Check flags:
```python
# Backend
if feature_flags_service.is_enabled("quiz_system", user=current_user):
    # Feature logic
```

```typescript
// Frontend
const enabled = useFeatureFlag("quiz_system")
```

## Environment Variables

Key variables in `.env`:

```env
# Security
SECRET_KEY=changethis  # Generate: python -c "import secrets; print(secrets.token_urlsafe(32))"
FIRST_SUPERUSER=admin@example.com
FIRST_SUPERUSER_PASSWORD=changethis

# Database
POSTGRES_SERVER=db
POSTGRES_DB=app
POSTGRES_USER=postgres
POSTGRES_PASSWORD=changethis

# AI Generation
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
GENERATION_TEMPERATURE=0.7

# Feature Flags
FEATURE_AI_QUESTION_GENERATION=true
FEATURE_QUIZ_SYSTEM=true
FEATURE_QUIZ_TIMER=false
```

## Common Issues

### Migration Problems

If migrations conflict:
```bash
# Rollback
alembic downgrade -1

# Delete problematic migration file in app/alembic/versions/
# Regenerate
alembic revision --autogenerate -m "New description"
alembic upgrade head
```

### API Client Out of Sync

Symptoms: TypeScript errors in frontend about missing/wrong types.

Solution:
```bash
./scripts/generate-client.sh
```

### Docker Port Conflicts

```bash
# Check what's using ports
lsof -i :5173  # Frontend
lsof -i :8000  # Backend
lsof -i :5432  # PostgreSQL

# Kill process or stop Docker services
docker compose stop frontend
docker compose stop backend
```

### Pre-commit Hooks

If commits are blocked by linting:

```bash
# Backend
cd backend && source .venv/bin/activate
bash scripts/format.sh  # Auto-fix

# Frontend
cd frontend
npm run lint  # Auto-fix
```

## Testing

### Backend Tests

```bash
# Run all tests with coverage
bash scripts/test.sh

# Run specific test
pytest backend/tests/api/routes/test_questions.py -v

# Stop on first failure
pytest backend/tests/ -x

# View coverage report
open backend/htmlcov/index.html
```

### Frontend E2E Tests

```bash
# Ensure backend is running
docker compose up -d backend

# Run tests
cd frontend
npx playwright test

# Interactive mode
npx playwright test --ui

# Debug mode
npx playwright test --debug

# Cleanup
docker compose down -v
```

## Development Workflows

### Mixed Development (Docker + Local)

Run some services in Docker, others locally:

```bash
# Frontend local + Backend in Docker
docker compose stop frontend
cd frontend && npm run dev

# Backend local + Database in Docker
docker compose stop backend
cd backend && source .venv/bin/activate
fastapi dev app/main.py
```

### Code Review Checklist

Before committing:

1. Run linters (format.sh / npm run lint)
2. Run tests (test.sh / playwright test)
3. Check no console.log/print statements left
4. Verify generated client is up to date
5. Test locally with Docker Compose

## Important Notes

### SQLModel Relationships

When querying with relationships:
```python
# Use SQLModel select with options for eager loading
from sqlalchemy.orm import selectinload

statement = select(Question).options(
    selectinload(Question.subject),
    selectinload(Question.topic)
)
```

### WebSocket Communication

Card game uses WebSocket at `/api/v1/multiplayer/games/{game_id}/ws`. Events are JSON with `type` field.

**Disconnection/Reconnection Handling:**
- Backend broadcasts `player_disconnected` when a player leaves
- Backend broadcasts `player_joined` (with `player_role` and `player_state`) when reconnecting during active games
- Frontend displays "(DC)" indicator with grayed-out, semi-transparent health bar for disconnected opponents
- Frontend preserves opponent's last known state (health, shield) during disconnection
- Reconnection automatically restores full state and removes "(DC)" indicator

### Rich Text Content

When rendering user-generated HTML:
- Backend sanitizes with Bleach (allowlist-based)
- Frontend renders as `dangerouslySetInnerHTML` (already safe)
- Use `QuestionDisplay` component for consistent rendering

### Three.js Performance

- Use `useFrame` sparingly (runs every frame)
- Memoize geometries and materials
- Use `useMemo` for complex calculations
- Keep scene complexity low for smooth animations

## Access Control

- **Superuser**: Full access to everything
- **Teacher**: Can manage questions, generate AI questions, view admin pages
- **Student**: Can take quizzes, play games

Check permissions on both frontend (UI) and backend (API) for security.

## Useful URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| API Docs (ReDoc) | http://localhost:8000/redoc |
| Adminer (DB) | http://localhost:8080 |
| MailCatcher | http://localhost:1080 |

## Additional Documentation

- **Project Structure**: `PROJECT_STRUCTURE.md` (comprehensive reference)
- **Question Generation**: `backend/QUESTION_GENERATION_ARCHITECTURE.md`
- **Backend Setup**: `backend/README.md`
- **Frontend Setup**: `frontend/README.md`
- **Development Guide**: `development.md`
- **Deployment**: `deployment.md`
