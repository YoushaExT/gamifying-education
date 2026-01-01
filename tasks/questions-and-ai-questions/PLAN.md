# Question System Refactoring - Implementation Plan

**Created**: 2026-01-01
**Approved**: Yes
**Estimated Time**: 3-4 days

---

## Executive Summary

Comprehensive refactoring of the question system with two main parts:

**Part 1**: Core question model changes - two difficulties (easy/hard), drag-drop choice reordering, MCQ vs multiselect types, image support
**Part 2**: AI generation improvements - apply Part 1 changes, improve diversity with multiple templates + dynamic fallback, custom prompts

**Key Change**: Store choices WITHOUT A/B/C/D labels, use indices for correct_answers. Labels computed at render time.

---

## Phase 1: Backend Foundation

### 1.1 Update Models
**File**: `backend/app/models.py`

Changes to QuestionBase:
```python
choices: list[str]  # NOW: ["Text1", "Text2", "Text3", "Text4"] (no labels)
correct_answers: list[int]  # NOW: [0, 1] (indices, not letters)
difficulty: str  # "easy" or "hard"
question_type: str  # "mcq" or "multiselect"
```

### 1.2 Database Migration
**File**: `backend/app/alembic/versions/<new>.py`

Migration logic:
1. Add difficulty and question_type columns
2. For each existing question:
   - Strip "A. ", "B. " from choices
   - Convert correct_answers: ["A", "B"] → [0, 1]
   - Set difficulty='easy'
   - Set question_type='mcq' if 1 answer, else 'multiselect'
3. Include rollback migration

### 1.3 Update Validators
**File**: `backend/app/services/validators.py`

Changes:
- `_validate_answers`: Validate indices (0-3) instead of letters (A-D)
- `_validate_choices`: Check choices don't start with "A.", "B." labels
- `_validate_question_type_consistency` (NEW):
  - MCQ must have 1 correct answer
  - Multiselect must have 2+ correct answers
- `_validate_fields`: Include difficulty and question_type

### 1.4 Media Upload Endpoint
**File**: `backend/app/api/routes/media.py` (NEW)

Endpoints:
- `POST /api/v1/media/upload` - Upload images (max 5MB)
- `GET /api/v1/media/{filename}` - Retrieve images
- `DELETE /api/v1/media/{filename}` - Delete images (superuser only)

Supported formats: JPG, PNG, GIF, WEBP, SVG

### 1.5 Register Media Router
**File**: `backend/app/api/main.py`

Add media router to API router.

---

## Phase 2: AI Templates & Generation

### 2.1 Create Multiple Templates
**Directory**: `backend/app/question_templates/`

Create 4 new templates:
1. `javascript-scope-easy-output.json` - Output-based questions
2. `javascript-scope-easy-conceptual.json` - Concept definitions
3. `javascript-scope-hard-error.json` - Error identification
4. `javascript-scope-hard-practical.json` - Practical applications

**Requirements**:
- Plain text choices (no "A.", "B." labels)
- Indices for correct_answers
- 3-4 diverse examples per template
- Include difficulty and question_type in examples

### 2.2 Dynamic Template Fallback
**File**: `backend/app/services/template_service.py`

Add `get_or_create_dynamic_template` method:
- Search for existing template
- If not found, use LLM to generate 4 diverse example questions
- Create template with generated examples
- Store in database

This enables generation for new subjects without hardcoded templates.

### 2.3 Enhanced Diversity Guidance
**File**: `backend/app/services/question_generator.py`

Update `_build_diversity_prompt`:
- Expand from 1-line to 5-point detailed instructions
- Add format constraints (no labels, use indices)
- Add specific examples for each question type
- Add difficulty-specific guidance

### 2.4 Custom Prompt Support
**Files**:
- `backend/app/api/routes/question_generation.py`
- `backend/app/services/question_generator.py`

Add optional `custom_prompt` parameter to generation endpoint.
Append custom prompt to template prompt before sending to LLM.

### 2.5 Update OpenAI Provider
**File**: `backend/app/services/openai_provider.py`

Ensure generated questions:
- Have difficulty and question_type fields
- Use plain text choices (no labels)
- Use indices for correct_answers
- Explicitly instruct: "DO NOT generate images"

---

## Phase 3: Generate API Client

**Command**: `./scripts/generate-client.sh`

Run after ALL backend changes to regenerate TypeScript client with new types.

---

## Phase 4: Frontend Core Components

### 4.1 Install Dependencies
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install @tiptap/extension-image
```

### 4.2 Add Image Support to Editor
**File**: `frontend/src/components/ui/rich-text-editor.tsx`

- Add Image extension to TipTap
- Add image upload button to toolbar
- Add clipboard paste handler for images
- Upload to `/api/v1/media/upload`
- Insert as `<img src="...">` tag

### 4.3 Create DraggableChoice Component
**File**: `frontend/src/components/Questions/DraggableChoice.tsx` (NEW)

Features:
- Use `@dnd-kit/sortable` for drag-drop
- Display grip handle icon
- Compute A, B, C, D labels from index position
- Checkbox for marking correct answer

### 4.4 Update AddQuestion Component
**File**: `frontend/src/components/Questions/AddQuestion.tsx`

Changes:
- Form data: `choices: Array<{id: string, text: string}>`
- Form data: `correct_answers: number[]` (indices)
- Implement DndContext for drag-drop
- Add handleDragEnd that updates correct_answers indices:
  ```typescript
  // When choice at oldIndex moves to newIndex:
  // Update all correct_answers that reference those indices
  ```
- Add difficulty selector (RadioGroup)
- Add question_type selector (RadioGroup)
- Validation: MCQ=1 answer, multiselect=2+

### 4.5 Update EditQuestion Component
**File**: `frontend/src/components/Questions/EditQuestion.tsx`

Apply same changes as AddQuestion.

### 4.6 Update GeneratedQuestionPreview
**File**: `frontend/src/components/QuestionGeneration/GeneratedQuestionPreview.tsx`

- Add drag-drop for reordering before approval
- Update correct_answers indices when choices are reordered
- Display with visual feedback

---

## Phase 5: Frontend Display Updates

### 5.1 Update Quiz Taking Component
**File**: `frontend/src/routes/_layout/quiz/take.$attemptId.tsx`

Changes:
- handleAnswerChange works with indices
- For MCQ: Show RadioGroupItem, single selection
- For multiselect: Show Checkbox, multiple selection
- Compute A, B, C, D labels from index

### 5.2 Update Game Question Popup
**File**: `frontend/src/components/MultiplayerGame/QuestionPopup.tsx`

Apply same changes as quiz component.

### 5.3 Add Custom Prompt to Generation Form
**File**: `frontend/src/components/QuestionGeneration/GenerateForm.tsx`

Add custom_prompt field:
- Optional Textarea (3 rows)
- Placeholder: "E.g., 'Focus on async/await edge cases'"
- Include in form data sent to backend

---

## Phase 6: Testing & Verification

### Backend Tests
- [ ] Test migration on copy of production data
- [ ] Test migration rollback
- [ ] Test validators with new format
- [ ] Test image upload endpoint
- [ ] Test AI generation with new templates
- [ ] Test custom prompt functionality

### Frontend Tests
- [ ] Test drag-drop reordering with correct_answers update
- [ ] Test difficulty selector
- [ ] Test question_type selector (MCQ vs multiselect)
- [ ] Test image upload (file + clipboard)
- [ ] Test quiz taking (radio vs checkboxes)
- [ ] Test card game question display
- [ ] Frontend E2E tests pass

### Manual Testing
- [ ] Complete flow: Create question → Edit → Take quiz
- [ ] AI generation: Generate → Review → Reorder → Approve
- [ ] Image support in questions and choices
- [ ] Verify zero data loss from migration

---

## Execution Order

1. **Phase 1**: Backend Foundation (models, migration, validators, media) - *Day 1*
2. **Phase 2**: AI Templates (templates, fallback, diversity, custom prompt) - *Day 1-2*
3. **Phase 3**: Generate API Client - *Day 2*
4. **Phase 4**: Frontend Core (drag-drop, image, AddQuestion, EditQuestion) - *Day 2-3*
5. **Phase 5**: Frontend Display (quiz, game, generation form) - *Day 3*
6. **Phase 6**: Testing & Verification - *Day 4*

---

## Critical Files (20 total)

### Backend (10 files)
1. `backend/app/models.py`
2. `backend/app/alembic/versions/<new>.py`
3. `backend/app/services/validators.py`
4. `backend/app/api/routes/media.py` (NEW)
5. `backend/app/api/main.py`
6. `backend/app/services/template_service.py`
7. `backend/app/services/question_generator.py`
8. `backend/app/services/openai_provider.py`
9. `backend/app/api/routes/question_generation.py`
10. 4x template JSON files (NEW)

### Frontend (10 files)
1. `frontend/src/components/Questions/AddQuestion.tsx`
2. `frontend/src/components/Questions/EditQuestion.tsx`
3. `frontend/src/components/Questions/DraggableChoice.tsx` (NEW)
4. `frontend/src/components/ui/rich-text-editor.tsx`
5. `frontend/src/components/QuestionGeneration/GeneratedQuestionPreview.tsx`
6. `frontend/src/components/QuestionGeneration/GenerateForm.tsx`
7. `frontend/src/routes/_layout/quiz/take.$attemptId.tsx`
8. `frontend/src/routes/_layout/game/play.$gameId.tsx`
9. `frontend/src/components/MultiplayerGame/QuestionPopup.tsx`
10. `package.json` (dependencies)

---

## Risk Mitigation

### Data Migration
- ✅ Create database backup before migration
- ✅ Test on copy of production data first
- ✅ Include rollback migration
- ✅ Verify data integrity after migration

### Backward Compatibility
- Migration handles existing "A. Text" format
- Defensive parsing for edge cases

### Performance
- Image uploads limited to 5MB
- UUID filenames prevent conflicts
- TODO: Image compression (future iteration)

### Validation
- Empty correct_answers → error
- Duplicate indices → error
- MCQ with multiple answers → error
- Multiselect with 1 answer → error
- Images in AI questions → prevented in templates

---

## Success Criteria

1. ✅ All existing questions migrated without data loss
2. ✅ Drag-drop reordering updates correct_answers correctly
3. ✅ MCQ shows radio buttons, multiselect shows checkboxes
4. ✅ Images work in question text and choices
5. ✅ AI generates 3-4 distinct question types per batch
6. ✅ Custom prompt influences generation
7. ✅ Dynamic template fallback works for new subjects
8. ✅ Zero breaking changes to existing functionality

---

## Root Cause Analysis: Why AI Questions Are Repetitive

**Problem**: 95% of generated questions are "What is the output of this code?"

**Root Causes Identified**:

1. **Only 1 template exists** (`javascript-scope-medium.json`)
   - Both examples are output-based
   - Template prompt doesn't enforce diversity

2. **Empty examples on dynamic templates**
   - Frontend creates templates with `example_questions: []`
   - LLM defaults to easiest pattern (output questions)

3. **Weak diversity guidance**
   - Currently 1-line per question type
   - No specific constraints or examples

4. **No user control**
   - Can't select question type
   - Can't customize generation
   - Only subject/topic/count inputs

**Solutions in This Plan**:

1. ✅ Multiple templates per subject/topic (4 templates)
2. ✅ Dynamic fallback generates 4 diverse examples via LLM
3. ✅ Enhanced diversity guidance (5-point detailed instructions)
4. ✅ Custom prompt input field for user control

---

## Notes

- Images stored in `/app/media` Docker volume
- All endpoints require authentication
- Migration must be run from local venv: `alembic upgrade head`
- API client regeneration required after backend changes
- Original approved plan: `/Users/youshaarshad/.claude/plans/synchronous-twirling-scott.md`
