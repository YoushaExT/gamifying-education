# Gamifying Education

An AI-powered educational platform featuring MCQ quizzes and an interactive 2-player card combat game. Built with FastAPI (backend) and React (frontend).

[![Test Backend](https://github.com/youshaarshad/gamifying-education/workflows/Test%20Backend/badge.svg)](https://github.com/youshaarshad/gamifying-education/actions?query=workflow%3A%22Test+Backend%22)
[![Playwright Tests](https://github.com/youshaarshad/gamifying-education/workflows/Playwright/badge.svg)](https://github.com/youshaarshad/gamifying-education/actions?query=workflow%3APlaywright)

## Features

### Core Features

- **AI Question Generation**: OpenAI GPT-powered question generation with diversity optimization
  - Template-based generation with subject/topic enforcement
  - Multi-layer validation (format and optional content quality)
  - Diversity scoring to prevent repetitive questions
  - Admin review workflow (approve/reject)

- **Card Combat Game**: 2-player turn-based game with real-time WebSocket communication
  - 3D graphics using Three.js and React Three Fiber
  - Each card play triggers an MCQ question popup
  - Correct answers → maximum card effect, wrong answers → minimum effect
  - Server-side game state management for security
  - Reconnection handling with disconnection indicators

- **Quiz System**: Comprehensive quiz functionality
  - Timed and untimed quiz modes
  - Detailed results and analytics
  - Rich text questions with code blocks and LaTeX math support

- **Question Management**: Full CRUD operations for questions
  - TipTap rich text editor with code syntax highlighting (highlight.js)
  - KaTeX math equation rendering (inline: `$...$`, block: `$$...$$`)
  - Subject and topic auto-creation (case-insensitive unique)
  - HTML sanitization with Bleach library for XSS prevention

- **Feature Flags**: Runtime feature control
  - Priority resolution: Environment → User-specific → Role-based → Global
  - Admin UI for flag management

### Technology Stack

**Backend**:
- [FastAPI](https://fastapi.tiangolo.com) - Python backend API framework
- [SQLModel](https://sqlmodel.tiangolo.com) - ORM for database interactions
- [PostgreSQL 17](https://www.postgresql.org) - SQL database
- [Alembic](https://alembic.sqlalchemy.org) - Database migrations
- [OpenAI API](https://platform.openai.com) - AI question generation
- [uv](https://github.com/astral-sh/uv) - Package management

**Frontend**:
- [React 19](https://react.dev) - UI framework with TypeScript
- [Vite](https://vitejs.dev) - Build tool and dev server
- [TanStack Router](https://tanstack.com/router) - File-based routing
- [TanStack Query](https://tanstack.com/query) - Data fetching and caching
- [Tailwind CSS 4](https://tailwindcss.com) - Utility-first CSS
- [shadcn/ui](https://ui.shadcn.com) - Re-usable UI components
- [Three.js](https://threejs.org) + [React Three Fiber](https://github.com/pmndrs/react-three-fiber) - 3D graphics
- [TipTap](https://tiptap.dev) - Rich text editor
- [KaTeX](https://katex.org) - Math equation rendering
- [Playwright](https://playwright.dev) - End-to-end testing

**DevOps**:
- [Docker Compose](https://www.docker.com) - Development and production
- [Traefik](https://traefik.io) - Reverse proxy with automatic HTTPS
- [GitHub Actions](https://github.com/features/actions) - CI/CD

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/engine/install/) and Docker Compose
- [Node.js 24+](https://nodejs.org/) (for local frontend development)
- [Python 3.10+](https://www.python.org/) (for local backend development)
- [uv](https://github.com/astral-sh/uv) (Python package manager)

### 1. Clone the Repository

```bash
git clone https://github.com/youshaarshad/gamifying-education.git
cd gamifying-education
```

### 2. Configure Environment Variables

```bash
# Copy example environment files
cp .env.example .env
cp frontend/.env.example frontend/.env
```

**Edit `.env` and set:**

```bash
# Generate secure secrets
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Required secrets
SECRET_KEY=<generated-secret>
POSTGRES_PASSWORD=<generated-secret>
FIRST_SUPERUSER_PASSWORD=<generated-secret>
OPENAI_API_KEY=sk-proj-your-api-key  # Get from https://platform.openai.com/api-keys

# Optional (for production)
DOMAIN=localhost  # Change to your domain for production
```

### 3. Start the Application

```bash
docker compose watch
```

This starts all services with hot-reload:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Adminer** (DB): http://localhost:8080
- **MailCatcher**: http://localhost:1080

### 4. Access the Application

Default admin credentials:
- **Email**: `admin@example.com`
- **Password**: (value of `FIRST_SUPERUSER_PASSWORD` from `.env`)

## Development

### Backend Development

```bash
cd backend

# Setup Python environment
uv sync
source .venv/bin/activate

# Run local development server (requires Docker DB)
docker compose up -d db mailcatcher
fastapi dev app/main.py

# Code quality
bash scripts/format.sh  # Auto-fix with ruff
bash scripts/lint.sh    # Check with ruff + mypy

# Testing
bash scripts/test.sh    # Run tests with coverage
```

**Database Migrations**:

After modifying `backend/app/models.py`:

```bash
cd backend
source .venv/bin/activate

# Generate migration
alembic revision --autogenerate -m "Description of changes"

# Review generated migration in app/alembic/versions/

# Apply migration
alembic upgrade head
```

### Frontend Development

```bash
cd frontend

# Setup
nvm use  # Uses Node 24 from .nvmrc
npm install

# Run local development server
npm run dev  # http://localhost:5173

# Code quality
npm run lint  # Auto-fix with Biome

# Testing
npx playwright test       # Run E2E tests
npx playwright test --ui  # Interactive mode
```

**Generate API Client** (after backend API changes):

```bash
./scripts/generate-client.sh
```

This regenerates `frontend/src/client/` from OpenAPI schema.

### Docker Development Tips

```bash
# Stop a service and run locally
docker compose stop frontend
cd frontend && npm run dev

# View logs
docker compose logs -f backend

# Clean restart
docker compose down -v && docker compose watch

# Run commands in containers
docker compose exec backend bash
docker compose exec frontend sh
```

## Project Structure

```
gamifying-education/
├── backend/                # FastAPI backend
│   ├── app/
│   │   ├── api/routes/    # API endpoints
│   │   ├── services/      # Business logic
│   │   ├── models.py      # SQLModel database models
│   │   └── main.py        # FastAPI app entry
│   ├── tests/             # Pytest tests
│   └── pyproject.toml     # Python dependencies
├── frontend/              # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── routes/        # TanStack Router pages
│   │   ├── client/        # Generated API client
│   │   ├── models/        # Three.js 3D components
│   │   └── services/      # Frontend services
│   └── package.json       # Node dependencies
├── .github/workflows/     # CI/CD pipelines
└── docker-compose.yml     # Service orchestration
```

See [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) for detailed architecture documentation.

## Documentation

- [Project Structure](./PROJECT_STRUCTURE.md) - Comprehensive architecture reference
- [Development Guide](./development.md) - Docker Compose, local development, testing
- [Deployment Guide](./deployment.md) - Production deployment instructions
- [Backend README](./backend/README.md) - Backend-specific documentation
- [Frontend README](./frontend/README.md) - Frontend-specific documentation
- [Claude Code Guide](./CLAUDE.md) - Instructions for Claude Code AI assistant
- [Question Generation Architecture](./backend/QUESTION_GENERATION_ARCHITECTURE.md) - AI generation details

## Security

This project uses environment variables for sensitive configuration. **Never commit `.env` files.**

### Setup Security

```bash
# Install pre-commit hook to prevent .env commits
cp pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

See the **Security Setup** section in [development.md](./development.md) for more details.

## Testing

### Backend Tests

```bash
cd backend
source .venv/bin/activate
bash scripts/test.sh  # Run with coverage
```

### Frontend E2E Tests

```bash
# Ensure backend is running
docker compose up -d backend

cd frontend
npx playwright test
```

## Deployment

See [deployment.md](./deployment.md) for detailed deployment instructions using:
- Docker Compose
- Traefik reverse proxy
- GitHub Actions CI/CD
- Automatic HTTPS certificates

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Quality

Before committing:

```bash
# Backend
cd backend && bash scripts/format.sh && bash scripts/lint.sh

# Frontend
cd frontend && npm run lint
```

## License

This project is licensed under the terms of the MIT license.

## Acknowledgments

- Built with [FastAPI Full Stack Template](https://github.com/fastapi/full-stack-fastapi-template) as a starting point
- Powered by [OpenAI GPT](https://platform.openai.com) for AI features
