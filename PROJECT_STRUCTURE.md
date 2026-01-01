# Project Structure Documentation

## Overview

**Gamifying Education** is a full-stack web application built with FastAPI (backend) and React (frontend) for creating and managing educational MCQ quizzes with AI-powered question generation.

### Key Features
- **2-player turn-based card combat game** with MCQ integration (Three.js + WebSockets)
- **AI Question Generation** using OpenAI GPT models with diversity optimization
- **Quiz System** with timed/untimed modes and detailed results
- **Question Management** with rich text editor (code blocks, math equations)
- **Feature Flags** for runtime feature control

## Technology Stack

### Backend
- **[FastAPI](https://fastapi.tiangolo.com)** - Web framework for APIs
- **[SQLModel](https://sqlmodel.tiangolo.com)** - ORM with type hints
- **[PostgreSQL](https://www.postgresql.org)** v17 - Database
- **[Alembic](https://alembic.sqlalchemy.org)** - Database migrations
- **[OpenAI](https://platform.openai.com/docs)** - AI question generation
- **[Tenacity](https://tenacity.readthedocs.io/)** - Retry logic
- **[Bleach](https://bleach.readthedocs.io/)** - HTML sanitization
- **[PyYAML](https://pyyaml.org/)** - Card template parsing
- **[boto3](https://boto3.amazonaws.com/v1/documentation/api/latest/index.html)** - AWS SDK (S3 media storage)
- **[uv](https://docs.astral.sh/uv/)** - Package manager
- Python >=3.10, <4.0

### Frontend
- **[React](https://react.dev)** v19 - UI library
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe JavaScript
- **[Vite](https://vitejs.dev/)** - Build tool
- **[TanStack Router](https://tanstack.com/router)** - Type-safe routing
- **[TanStack Query](https://tanstack.com/query)** - Data fetching
- **[Tailwind CSS](https://tailwindcss.com)** v4 - Styling
- **[shadcn/ui](https://ui.shadcn.com)** - Component library
- **[TipTap](https://tiptap.dev/)** - Rich text editor
- **[KaTeX](https://katex.org/)** - Math rendering
- **[Three.js](https://threejs.org/)** + **[@react-three/fiber](https://docs.pmnd.rs/react-three-fiber)** - 3D graphics
- **[Playwright](https://playwright.dev)** - E2E testing
- Node.js 24

### Infrastructure & Code Quality
- **Docker Compose** + **Traefik** (reverse proxy)
- **Pytest** + **Coverage** (backend testing)
- **Ruff** + **mypy** (Python linting)
- **Biome** (frontend linting)

## Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── alembic/versions/     # Database migrations
│   │   ├── api/routes/           # API endpoints
│   │   │   ├── questions.py
│   │   │   ├── question_generation.py
│   │   │   ├── quizzes.py
│   │   │   ├── multiplayer_game.py
│   │   │   ├── media.py           # Image upload/download
│   │   │   └── feature_flags.py
│   │   ├── core/                 # Config, DB, security
│   │   ├── services/             # Business logic
│   │   │   ├── game_service.py           # Card combat logic
│   │   │   ├── card_template_service.py  # Card/deck templates
│   │   │   ├── question_generator.py     # AI generation
│   │   │   ├── diversity_analyzer.py     # Question diversity
│   │   │   ├── media_storage.py          # Storage abstraction (local/S3)
│   │   │   └── feature_flags.py
│   │   ├── card_templates/       # YAML card definitions
│   │   │   └── default_deck.yml
│   │   ├── question_templates/   # AI prompt templates
│   │   ├── models.py             # SQLModel definitions
│   │   ├── crud.py               # Database operations
│   │   └── main.py               # App entry point
│   ├── tests/
│   │   ├── api/                  # Endpoint tests
│   │   └── crud/                 # CRUD tests
│   ├── scripts/
│   │   ├── format.sh             # Auto-fix formatting
│   │   ├── lint.sh               # Check only
│   │   └── test.sh               # Run tests
│   └── pyproject.toml
│
├── frontend/
│   ├── src/
│   │   ├── client/               # Generated OpenAPI client
│   │   ├── components/
│   │   │   ├── Common/           # Navbar, Sidebar
│   │   │   ├── Questions/        # Question CRUD
│   │   │   ├── QuestionGeneration/   # AI generation UI
│   │   │   ├── MultiplayerGame/  # Card game UI
│   │   │   │   ├── QuestionPopup.tsx
│   │   │   │   ├── Card.tsx
│   │   │   │   └── HealthBar.tsx
│   │   │   ├── Game/             # Reusable game components
│   │   │   │   └── OutlinedText.tsx   # 3D text with outline
│   │   │   ├── modals/           # Event-based modal system
│   │   │   │   ├── ModalRoot.tsx      # Root component
│   │   │   │   └── ModalWrappers.tsx  # Wrappers
│   │   │   └── ui/               # shadcn components
│   │   ├── services/             # Frontend services
│   │   │   ├── events/           # Event system
│   │   │   │   └── EventService.ts
│   │   │   └── modals/           # Modal service
│   │   │       ├── ModalService.ts
│   │   │       ├── ModalService.interface.ts
│   │   │       ├── ModalRegistry.ts
│   │   │       └── index.ts
│   │   ├── constants/            # App-wide constants
│   │   │   ├── fonts.ts          # Font paths (GAME_FONT)
│   │   │   ├── colors.ts         # Color constants (COLORS)
│   │   │   └── index.ts          # Barrel exports
│   │   ├── models/               # Three.js 3D components
│   │   │   ├── Card3D.tsx        # 3D card with hover
│   │   │   ├── HealthBar3D.tsx   # Health bar with divisions
│   │   │   └── Shield3D.tsx      # Shield icon background
│   │   ├── contexts/
│   │   │   └── FeatureFlagsContext.tsx
│   │   ├── hooks/
│   │   │   ├── useConfirm.ts     # Confirmation modal hook
│   │   │   └── useGameWebSocket.ts
│   │   └── routes/_layout/
│   │       ├── admin/
│   │       │   ├── questions.tsx
│   │       │   ├── ai-generate.tsx
│   │       │   └── feature-flags.tsx
│   │       ├── quiz/
│   │       │   ├── start.tsx
│   │       │   ├── take.$attemptId.tsx
│   │       │   └── results.$attemptId.tsx
│   │       └── game/
│   │           ├── create.tsx
│   │           ├── lobby.$gameId.tsx
│   │           ├── play.$gameId.tsx
│   │           └── results.$gameId.tsx
│   ├── tests/                    # Playwright E2E
│   ├── package.json
│   └── biome.json
│
├── scripts/
│   ├── generate-client.sh        # Regenerate API client
│   └── test.sh
├── terraform-ecr/                 # ECR repos (long-lived)
├── terraform-s3/                  # S3 media bucket (long-lived)
├── terraform/                     # Main infrastructure
├── docker-compose.yml
└── docker-compose.override.yml
```

## Essential Commands

### Backend Development

```bash
# Initial setup
cd backend
uv sync
source .venv/bin/activate

# Start dev server
fastapi dev app/main.py  # http://localhost:8000
```

### Frontend Development

```bash
cd frontend
nvm use      # Use Node 24
npm install
npm run dev  # http://localhost:5173
```

### Docker (Full Stack)

```bash
docker compose watch          # Hot reload
docker compose up -d          # Detached
docker compose down -v        # Clean slate
docker compose logs -f backend
```

### Database Migrations

⚠️ **Always use LOCAL venv**, not Docker:

```bash
cd backend && source .venv/bin/activate

# Create migration
alembic revision --autogenerate -m "Add user preferences"

# Apply
alembic upgrade head

# Rollback
alembic downgrade -1
```

### Code Quality

```bash
# Backend (Python)
cd backend/
bash scripts/format.sh  # Auto-fix (ruff)
bash scripts/lint.sh    # Check only (mypy + ruff)

# Frontend (TypeScript)
cd frontend/
npm run lint                    # Biome auto-fix
npx biome check ./              # Check only
```

### API Client Generation

```bash
./scripts/generate-client.sh  # Run after any API changes
```

### Testing

```bash
# Backend
bash scripts/test.sh
pytest backend/tests/ -v

# Frontend E2E
npx playwright test
npx playwright test --ui  # Interactive
```

## Code Generation Guidelines

**Always use generators - never manual creation:**

| Task | Tool |
|------|------|
| Database migrations | `alembic revision --autogenerate` |
| API client | `./scripts/generate-client.sh` |
| Routes | File-based (auto `routeTree.gen.ts`) |
| UI components | `npx shadcn@latest add [name]` |
| API calls | Generated client (not manual fetch) |

### React Query with Generated Client

```typescript
// ✅ Good - use generated client
import { QuestionsService } from "@/client"

const { data } = useQuery({
  queryKey: ["questions"],
  queryFn: () => QuestionsService.getQuestions()
})

// ❌ Bad - manual fetch
const { data } = useQuery({
  queryFn: () => fetch("/api/v1/questions").then(r => r.json())
})
```

## Development URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| API Docs (ReDoc) | http://localhost:8000/redoc |
| Adminer (DB UI) | http://localhost:8080 |
| MailCatcher | http://localhost:1080 |

## Environment Variables

Key variables in `.env`:

   ```env
# Security
SECRET_KEY=changethis
FIRST_SUPERUSER=admin@example.com
FIRST_SUPERUSER_PASSWORD=changethis

# Database
POSTGRES_SERVER=db
POSTGRES_DB=app
POSTGRES_USER=postgres
POSTGRES_PASSWORD=changethis

# AI Generation
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5-mini-2025-08-07
GENERATION_TEMPERATURE=0.7

# Feature Flags
FEATURE_AI_QUESTION_GENERATION=true
FEATURE_QUIZ_SYSTEM=true
FEATURE_QUIZ_TIMER=false
```

Generate secure keys: `python -c "import secrets; print(secrets.token_urlsafe(32))"`

## Key Configuration Files

### Backend

**`backend/pyproject.toml`**
- Python dependencies and tool configs (ruff, mypy, coverage)
- Key deps: fastapi, sqlmodel, alembic, openai, pyyaml

**`backend/alembic.ini`**
- Migration config, version files in `app/alembic/versions/`

### Frontend

**`frontend/package.json`**
- Key scripts: `dev`, `build`, `lint`, `generate-client`
- Key deps: @tanstack/react-router, @tanstack/react-query, tailwindcss, @react-three/fiber

**`frontend/biome.json`**
- Linter and formatter config for TypeScript/React

**`frontend/components.json`**
- shadcn/ui component installation settings

**`frontend/tailwind.config.ts`**
- Tailwind CSS v4 theme customization

**`frontend/vite.config.ts`**
- Vite config with TanStack Router plugin

**`frontend/.nvmrc`**
- Node.js version: 24

### Docker

**`docker-compose.yml`**
- Production services: db, backend, frontend, prestart

**`docker-compose.override.yml`**
- Development overrides: volume mounts, hot reload, MailCatcher

## Database Models

### Core Models

**User**
- `id`, `email`, `hashed_password`, `full_name`
- `is_active`, `is_superuser`, `is_teacher`

**Question**
- `id`, `question_text` (HTML with code/math)
- `choices[]`, `correct_answers[]`
- `subject_id` → Subject, `topic_id` → Topic
- `created_by` → User

**Subject** / **Topic**
- `id`, `name` (unique, indexed)

### AI Generation Models

**QuestionTemplate**
- `subject`, `topic`, `difficulty`
- `template_prompt`, `example_questions[]`
- `constraints`, `is_active`

**GeneratedQuestion**
- `question_data` (JSON), `template_id`
- `batch_id`, `status` (pending/approved/rejected)
- `validation_score`, `validation_feedback`
- `subtopic`, `question_type`, `diversity_score`

**SubtopicTaxonomy**
- `subject`, `topic`, `subtopic`
- `importance_weight` (1-5)

### Quiz Models

**Quiz**
- `subjects[]`, `topics[]`, `num_questions`
- `has_timer`, `time_limit_seconds`
- `created_by`

**QuizAttempt**
- `quiz_id`, `user_id`
- `question_ids[]`, `user_answers` (JSON)
- `score`, `status`, `time_taken_seconds`

### Card Game Models

**CardTemplate**
- `card_key` (unique), `name`, `description`
- `card_type` (basic_damage/shield/heal)
- `effect_data` ({min_value, max_value})

**DeckTemplate**
- `name`, `card_entries[]` ({card_key, count})

**CardGameSession**
- `room_code`, `host_id`, `guest_id`
- `subjects[]`, `topics[]`, `status`
- `host_health`, `guest_health` (default: 10)
- `host_shield`, `guest_shield`
- `host_hand[]`, `guest_hand[]`, `deck[]`, `discard_pile[]`
- `current_turn`, `turn_number`, `fatigue_damage`, `winner`

**CardGameAnswer**
- `game_session_id`, `user_id`, `question_id`
- `card_played`, `selected_answers[]`
- `is_correct`, `effect_value`

### Feature Flags

**FeatureFlag**
- `key`, `name`, `description`
- `enabled` (global toggle)
- `enabled_for_roles[]`, `enabled_for_users[]`
- `env_var_name` (environment override)

## Question Management System

### Features
- **Rich Text Editor** (TipTap): Bold, italic, lists, code blocks, math equations
- **Code Blocks**: Syntax highlighting for JS, Python, Java, C++, SQL, etc.
- **Math**: LaTeX via KaTeX (`$inline$` and `$$block$$`)
- **MCQ**: 4 choices (A-D), multi-select support
- **Dynamic Subject/Topic**: Auto-created on save

### API Endpoints

```
GET    /api/v1/questions/           # List with filters
POST   /api/v1/questions/           # Create
GET    /api/v1/questions/{id}       # Get one
PUT    /api/v1/questions/{id}       # Update
DELETE /api/v1/questions/{id}       # Delete
GET    /api/v1/subjects/            # List subjects
GET    /api/v1/topics/              # List topics
```

### Admin UI

**Route**: `/admin/questions`

**Features**:
- Paginated table with subject/topic filters
- Action menu per question:
  - 👁️ Preview - View formatted question
  - ✏️ Edit - Modify details
  - 🗑️ Delete - Remove (with confirmation)

**Access Control**:
- Teachers and superusers only
  - Users can only edit/delete their own questions (except superusers)

### Frontend Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `RichTextEditor` | `components/ui/` | TipTap-based WYSIWYG |
| `QuestionDisplay` | `components/Questions/` | Read-only renderer |
| `AddQuestion` | `components/Questions/` | Create form |
| `EditQuestion` | `components/Questions/` | Edit form |
| `PreviewQuestion` | `components/Questions/` | Preview modal |
| `Combobox` | `components/ui/` | Searchable dropdown with add-new |

### Math & Code Rendering
- **KaTeX**: Renders `$...$` (inline) and `$$...$$` (block) LaTeX
- **Highlight.js**: Syntax highlighting with GitHub theme
- **Lowlight**: TipTap integration for code blocks

## AI Question Generation

**Detailed architecture**: `backend/QUESTION_GENERATION_ARCHITECTURE.md`

### Overview
- Template-based generation using OpenAI GPT
- Multi-layer validation (format + optional content quality)
- Admin review workflow (approve/reject)
- Diversity optimization for balanced coverage

### Services

| Service | Purpose |
|---------|---------|
| **OpenAIProvider** | GPT generation with subject/topic injection |
| **FormatValidator** | Pydantic schema, HTML safety, choice validation |
| **ContentValidator** | AI quality scoring (0-100) |
| **DiversityAnalyzer** | Subtopic/type frequency analysis |
| **TaxonomyGenerator** | LLM-generated subtopics |
| **ReviewService** | Approve/reject workflow |

### API Endpoints

```
POST /api/v1/question-generation/generate
     # Request: {template_id, num_questions, skip_content_validation}
     # Response: {batch_id, successful, failed, questions[]}

GET  /api/v1/question-generation/generated
     # Query: skip, limit, status, batch_id, min_score

POST /api/v1/question-generation/generated/{id}/approve
POST /api/v1/question-generation/generated/{id}/reject
POST /api/v1/question-generation/generated/batch/{batch_id}/approve-all
```

### Diversity System

Prevents repetitive questions:

1. **Taxonomy Generation**: LLM creates 2-12 subtopics per topic with importance weights
2. **Frequency Analysis**: Counts existing questions per subtopic/type
3. **Diversity Scoring**: `score = weight × (1 / (frequency + 1))`
4. **Weighted Selection**: Prioritizes underrepresented areas

**8 Question Types**: Output-Based, Explanation-Based, Concept Definition, Behavior Comparison, Error Identification, Practical Application, Code Completion, True/False Concept

### Frontend Workflow

**Route**: `/admin/ai-generate`

**Steps**:
1. Enter/select subject (required)
2. Enter/select topic (optional)
3. Set number of questions (1-5)
4. Optionally enable "Extra AI Validation"
5. Click "Generate Questions"
6. Wait ~5-10 seconds for generation
7. Review each generated question:
   - View rendered HTML (code, math)
   - See validation score and feedback
   - **Accept** → Moves to question bank
   - **Reject** → Provide reason
8. Accepted questions appear immediately with correct subject/topic

**Note**: The subject and topic you specify are guaranteed in generated questions. LLM cannot override these values.

### Template Configuration

**Location**: `backend/app/question_templates/*.json`

Example template structure:
```json
{
  "subject": "JavaScript",
  "topic": "Scope",
  "difficulty": "medium",
  "template_prompt": "Generate a multiple-choice question about {topic} in {subject}...",
  "example_questions": [...],
  "constraints": {
    "require_code": true,
    "code_language": "javascript"
  }
}
```

Templates are automatically loaded and merged with database templates.

## Feature Flags System

### Overview
Runtime feature control with priority resolution:
1. **Environment Variable** (highest)
2. **User-Specific** (UUID list)
3. **Role-Based** (teacher, superuser)
4. **Global** (lowest)

### Default Flags

| Flag | Default | Roles |
|------|---------|-------|
| `ai_question_generation` | Enabled | teacher, superuser |
| `quiz_system` | Enabled | all users |
| `quiz_timer` | Disabled | all users |

### Usage

```python
# Backend
if feature_flags_service.is_enabled("quiz_system", user=current_user):
    # Feature available
```

```typescript
// Frontend
const enabled = useFeatureFlag("quiz_system")
```

### API Endpoints

```
GET    /api/v1/feature-flags/              # List flags (user view)
GET    /api/v1/feature-flags/admin         # List all (admin view)
POST   /api/v1/feature-flags/              # Create flag
PUT    /api/v1/feature-flags/{flag_key}    # Update flag
DELETE /api/v1/feature-flags/{flag_key}    # Delete flag
```

### Admin UI

**Route**: `/admin/feature-flags` (superuser only)

**Features**:
- Table view of all flags
- Global on/off toggle (Switch component)
- Role-based checkboxes (Teacher, Superuser)
- Visual status indicators
- Help section explaining priority system

### Use Cases
- **Gradual Rollout**: Enable for superusers → teachers → everyone
- **Beta Testing**: Enable for specific users by UUID
- **Emergency Disable**: Quick toggle via environment or admin UI
- **Environment-Specific**: Different settings per deployment

## Modal System

Event-based modal system for confirmations and custom modals.

### Usage

**Confirmations** (most common):
```typescript
import { useConfirm } from "@/hooks/useConfirm"

const { confirm } = useConfirm()
const confirmed = await confirm({
  title: "Delete Item",
  description: "Are you sure?",
  variant: "destructive"
})
if (confirmed) performDeletion()
```

**From non-React code**:
```typescript
import ModalService from "@/services/modals/ModalService"
await ModalService.confirm({ title: "...", description: "..." })
```

### Components

- **EventService** - Simple event emitter
- **ModalService** - Singleton for opening/closing modals
- **ModalRoot** - Mounted in `main.tsx`, listens to events
- **useConfirm** - Hook for confirmations

### Files

`services/events/`, `services/modals/`, `components/modals/`, `hooks/useConfirm.ts`

## Quiz System

### Features
- **Subject/Topic Selection**: Multi-select filtering
- **Configurable**: Question count (1-20), optional timer
- **Progress Tracking**: One question at a time
- **Immediate Scoring**: Results on submission
- **Full Review**: Correct/incorrect highlighting

### API Endpoints

```
POST /api/v1/quizzes/start
     # Request: {subjects[], topics?, num_questions, has_timer, time_limit_seconds?}
     # Response: Quiz attempt with question IDs

GET  /api/v1/quizzes/attempts/{attempt_id}
GET  /api/v1/quizzes/attempts           # List user's attempts

PUT  /api/v1/quizzes/attempts/{attempt_id}/submit
     # Request: {answers: {question_id: string[]}}
     # Response: Score and completion status

GET  /api/v1/quizzes/attempts/{attempt_id}/results
     # Response: Questions with user answers and correct answers
```

### Routes

**`/quiz/start`** - Configuration page
- Subject selection (multi-select)
- Topic selection (optional, multi-select)
- Number of questions (1-20)
- Timer toggle with time limit input (if `quiz_timer` flag enabled)

**`/quiz/take/$attemptId`** - Quiz taking
- One question at a time
- Progress indicator ("Question 3 of 10")
- Answer selection (checkboxes)
- Navigation: Previous / Next buttons
- Timer countdown (if enabled)
- Submit button on last question

**`/quiz/results/$attemptId`** - Results page
- Score display ("8/10 - 80%")
- Time taken
- Full question review with highlighting:
  - Green: Correct answers
  - Red: Incorrect selections
  - Gray: Unanswered

### User Flow

1. **Start**: Select subjects/topics, set options, click "Start Quiz"
2. **Take**: Answer questions one at a time, navigate with Previous/Next
3. **Submit**: Complete all questions and submit
4. **Review**: View score and detailed breakdown

### Feature Flags
- `quiz_system` - Enable/disable entire quiz feature
- `quiz_timer` - Enable/disable timer option in quiz start

## Card Combat Game

### Game Mechanics
- **Players**: 2 (host + guest)
- **Starting HP**: 10 each
- **Card Types**:
  - **Damage**: Attack opponent (red)
  - **Shield**: Block damage (blue)
  - **Heal**: Restore HP (green)
- **MCQ Integration**: Playing card shows question popup
  - Correct answer → max effect value
  - Wrong answer → min effect value
- **Turns**: Alternate, one card per turn (or skip)
- **Card Draw**: 3 initial, 1 per turn
- **Fatigue**: Damage when deck empty (increases each turn)
- **Win Condition**: Opponent reaches 0 HP

### Card Templates

Location: `backend/app/card_templates/default_deck.yml`

```yaml
cards:
  fireball:
    name: "Fireball"
    description: "Hurl a blazing fireball at your opponent"
    card_type: "basic_damage"
    effect_data:
      min_value: 2
      max_value: 5
  
  shield_wall:
    name: "Shield Wall"
    card_type: "basic_shield"
    effect_data:
      min_value: 2
      max_value: 4
  
  healing_potion:
    name: "Healing Potion"
    card_type: "basic_heal"
    effect_data:
      min_value: 2
      max_value: 4

deck:
  name: "default"
  cards:
    - card_key: fireball
      count: 5
    - card_key: shield_wall
      count: 4
    - card_key: healing_potion
      count: 4
```

### API Endpoints

```
POST /api/v1/multiplayer/games/create
POST /api/v1/multiplayer/games/join/{room_code}
GET  /api/v1/multiplayer/games/{game_id}
GET  /api/v1/multiplayer/games/{game_id}/state
POST /api/v1/multiplayer/games/{game_id}/ready
GET  /api/v1/multiplayer/games/{game_id}/hand
POST /api/v1/multiplayer/games/{game_id}/play-card
POST /api/v1/multiplayer/games/{game_id}/skip-turn
GET  /api/v1/multiplayer/games/{game_id}/results

WS   /api/v1/multiplayer/games/{game_id}/ws
```

### WebSocket Events

**Server → Client**:
| Event | Description |
|-------|-------------|
| `connected` | Connection established (includes hand if in progress) |
| `player_joined` | Player joined/reconnected (includes role & state for reconnections) |
| `player_ready` | Player marked ready |
| `game_start` | Game started, initial state |
| `your_hand` | Private hand update |
| `turn_start` | Turn began with timer |
| `card_resolved` | Effect applied (damage/heal/shield) |
| `turn_end` | Turn ended, fatigue applied |
| `turn_skipped` | Player skipped |
| `game_over` | Winner determined |
| `player_disconnected` | Player disconnected (includes user_id) |

**Client → Server**:
| Event | Description |
|-------|-------------|
| `player_ready` | Mark self ready |
| `play_card` | Play card at index with answers |
| `skip_turn` | Skip current turn |

### Backend Services

**CardTemplateService**:
- Load templates from YAML
- Seed database on startup
- Build deck instances with question assignments

**CardGameService**:
- `create_game_deck()` - Shuffled deck with questions
- `draw_cards()` - Move cards from deck to hand
- `play_card()` - Remove from hand
- `resolve_answer()` - Apply effect based on correctness
- `end_turn()` - Switch turns, draw, apply fatigue
- `check_game_over()` - Determine winner

**MediaStorage** (Storage abstraction):
- Abstract base class defining storage interface
- `LocalStorage`: Stores files in `/app/media` directory (development)
- `S3Storage`: Stores files in AWS S3 bucket (production)
- `get_storage()`: Factory function that returns appropriate backend based on `MEDIA_STORAGE_BACKEND` env var
- Supports upload, download, delete, and exists operations
- LocalStorage: Bind-mounted directory, files visible on host
- S3Storage: IAM role authentication, versioning enabled, lifecycle rules for cost optimization
- Deployment: See `other-deployment-docs/media-storage.md`

### Frontend Components

**Card3D.tsx**:
- 3D card rendering with type-based colors
- Hover animation (lift + scale)
- Click handling for playable state
- Displays name, type, effect range

**HealthBar3D.tsx**:
- Segmented health bar (divisions per HP)
- Color coding (green → yellow → red)
- Shield: Blue glowing border effect with Shield3D icon
- Turn indicator: Pulsing name animation
- Position-aware (player at bottom, opponent at top)
- Disconnection state: Gray color, "(DC)" suffix, 40% opacity
- Preserves last known state when opponent disconnects

**Shield3D.tsx**:
- Reusable shield icon background component
- Scalable with customizable children
- Used in HealthBar3D for shield value display

**QuestionPopup.tsx**:
- Modal for MCQ when card played
- Checkbox answer selection
- Submits answer letters (A/B/C/D)

**useGameWebSocket.ts**:
- WebSocket connection management
- Auto-reconnect with state restoration
- Disconnection/reconnection detection for both players
- Preserves opponent's last known state during disconnection
- Provides: `playCard()`, `skipTurn()`, `sendReady()`
- Tracks: game state, hand, timer, lastOpponentInfo

### Game Flow

1. **Create**: Host selects subjects/topics → gets room code
2. **Join**: Guest enters room code
3. **Lobby**: Both players mark ready
4. **Start**: Each draws 3 cards, host goes first
5. **Turn Loop**:
   - Select card → MCQ popup
   - Answer → effect applied
   - Turn ends → opponent draws 1 card
   - If deck empty → fatigue damage
6. **End**: First to 0 HP loses

### Routes
- `/game/create` - Create game
- `/game/lobby/$gameId` - Wait and ready
- `/game/play/$gameId` - 3D game scene
- `/game/results/$gameId` - Winner and stats

## Authentication & Security

### JWT Authentication
- Access tokens stored in localStorage (frontend)
- Automatic token refresh on API calls
- Configured expiration in `backend/app/core/config.py`

### Password Security
- Bcrypt hashing via `passlib`
- Minimum 8 characters (configurable in `frontend/src/utils.ts`)

### CORS
- Configured via `BACKEND_CORS_ORIGINS` environment variable
- Allows frontend to communicate with backend

### Content Security
- **HTML Sanitization**: Bleach library prevents XSS in user-generated content
- **Input Validation**: Pydantic models validate all API inputs
- **API Key Security**: OpenAI key in environment variables only

### Role-Based Access
- `is_superuser`: Full admin access
- `is_teacher`: Question management access
- Protected routes check permissions on both frontend and backend

## Testing

### Backend Testing

**Location**: `backend/tests/`

**Structure**:
- `tests/api/` - API endpoint tests
- `tests/crud/` - Database operation tests
- `tests/utils/` - Utility function tests
- `conftest.py` - Pytest configuration and fixtures

**Commands**:
```bash
# Run all tests with coverage
bash scripts/test.sh

# Run specific test file
pytest backend/tests/api/routes/test_users.py

# Run with verbose output
pytest -v

# Stop on first failure
pytest -x

# View coverage report
open backend/htmlcov/index.html
```

**Test Database**: Automatically created and cleaned between tests.

### Frontend E2E Testing

**Location**: `frontend/tests/`

**Framework**: Playwright

**Commands**:
```bash
# Run all tests
npx playwright test

# Interactive UI mode
npx playwright test --ui

# Run specific test
npx playwright test tests/login.spec.ts

# Debug mode
npx playwright test --debug
```

**Configuration**: `frontend/playwright.config.ts`

### Pre-commit Hooks

```bash
# Install hooks (run once after cloning)
cd backend && source .venv/bin/activate
uv run pre-commit install

# Run manually on all files
uv run pre-commit run --all-files
```

## Troubleshooting

### Database Issues
```bash
docker compose ps db           # Check status
docker compose logs db         # View logs
docker compose restart db      # Restart

alembic history               # View migrations
alembic downgrade -1          # Rollback
```

### Frontend Issues
```bash
rm -rf node_modules package-lock.json && npm install  # Clean reinstall
rm -rf frontend/.vite          # Clear cache
./scripts/generate-client.sh   # Regenerate API client
```

### Docker Issues
```bash
docker compose down -v         # Remove volumes
docker compose build --no-cache
docker compose watch
```

### Port Conflicts
```bash
lsof -i :5173   # Check what's using port
lsof -i :8000
```

## Common Development Tasks

### Adding an API Endpoint
1. Create route in `backend/app/api/routes/`
2. Register in `backend/app/api/main.py`
3. Run `./scripts/generate-client.sh`
4. Create frontend components

### Adding a Database Model
1. Define in `backend/app/models.py`
2. `alembic revision --autogenerate -m "description"`
3. Review migration, then `alembic upgrade head`
4. Add CRUD in `backend/app/crud.py`

### Adding a Frontend Route
1. Create file in `frontend/src/routes/`
2. TanStack Router auto-generates route tree
3. Add navigation links as needed

### Adding a shadcn Component
```bash
cd frontend
npx shadcn@latest add [component-name]
```

Components installed to `frontend/src/components/ui/`

### Mixed Development (Docker + Local)

Run some services in Docker, others locally:

```bash
# Local frontend + Docker backend
docker compose stop frontend
cd frontend && npm run dev

# Local backend + Docker database
docker compose stop backend
cd backend && source .venv/bin/activate
fastapi dev app/main.py
```

### Development Workflow Recommendation

1. Make code changes
2. **Backend**: Run `bash backend/scripts/lint.sh`, fix errors
3. **Frontend**: Run `npm run lint`, fix errors
4. Test changes locally
5. Commit (pre-commit hooks will run if configured)

## Email Templates

**Location**: `backend/app/email-templates/`

- `src/` - MJML source files (editable)
- `build/` - Compiled HTML files (used by app)

### Editing Templates
1. Install MJML extension in VS Code
2. Edit `.mjml` files in `src/`
3. Use command palette: "MJML: Export to HTML"
4. Save output to `build/`

## API Documentation

FastAPI provides automatic interactive docs:

| Type | URL |
|------|-----|
| Swagger UI | http://localhost:8000/docs |
| ReDoc | http://localhost:8000/redoc |
| OpenAPI JSON | http://localhost:8000/api/v1/openapi.json |

## Deployment

See `deployment.md` for production deployment guide.

**Key considerations**:
- Docker Compose for production
- Traefik for reverse proxy and HTTPS
- Environment variables for configuration
- GitHub Actions for CI/CD

## Additional Resources

- [FastAPI](https://fastapi.tiangolo.com) | [SQLModel](https://sqlmodel.tiangolo.com)
- [React](https://react.dev) | [TanStack Router](https://tanstack.com/router)
- [Tailwind CSS](https://tailwindcss.com) | [shadcn/ui](https://ui.shadcn.com)
- [Three.js](https://threejs.org) | [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)
- [OpenAI API](https://platform.openai.com/docs)

---

**Architecture Documents**:
- [Question Generation Architecture](backend/QUESTION_GENERATION_ARCHITECTURE.md)
