# Question System Refactoring Implementation Plan

## Overview

This plan refactors the question system to support two difficulties (easy/hard), drag-drop choice reordering, MCQ vs multiselect question types, image support, and dramatically improves AI generation diversity.

### Key Changes
- **Data model**: Store choices WITHOUT A/B/C/D labels, use indices for correct_answers
- **New fields**: difficulty (easy/hard), question_type (mcq/multiselect)
- **Image support**: File upload to backend with clipboard paste in editor
- **Drag-drop**: Reorder choices with automatic correct_answers index updates
- **AI diversity**: Multiple templates per subject/topic + dynamic fallback with LLM-generated diverse examples

---

## Part 1: Core Question Module Changes

### 1. Database Schema Migration

**File**: New migration via `alembic revision --autogenerate`

**Changes**:
1. Add `difficulty` column (VARCHAR(20), default='easy')
2. Add `question_type` column (VARCHAR(20), default='mcq')
3. Migrate existing data:
   - Strip "A. ", "B. " prefixes from choices: `"A. Text"` → `"Text"`
   - Convert correct_answers: `["A", "B"]` → `[0, 1]` (letters to indices)
   - Set all existing questions: difficulty='easy'
   - Set question_type='mcq' if 1 correct answer, else 'multiselect'

**Migration Logic**:
```python
def upgrade():
    # Add columns
    op.add_column('question', sa.Column('difficulty', sa.String(20), default='easy'))
    op.add_column('question', sa.Column('question_type', sa.String(20), default='mcq'))

    # Migrate existing data
    connection = op.get_bind()
    questions = connection.execute(text("SELECT id, choices, correct_answers FROM question"))

    for question in questions:
        # Strip labels from choices
        choices = json.loads(question.choices)
        new_choices = [re.sub(r'^[A-D]\.\s*', '', c) for c in choices]

        # Convert letters to indices
        correct_answers = json.loads(question.correct_answers)
        letter_map = {"A": 0, "B": 1, "C": 2, "D": 3}
        new_correct_answers = [letter_map[letter] for letter in correct_answers]

        # Determine type
        question_type = "mcq" if len(new_correct_answers) == 1 else "multiselect"

        # Update
        connection.execute(
            text("UPDATE question SET choices = :c, correct_answers = :ca, difficulty = 'easy', question_type = :qt WHERE id = :id"),
            {"c": json.dumps(new_choices), "ca": json.dumps(new_correct_answers), "qt": question_type, "id": question.id}
        )
```

### 2. Backend Models Update

**File**: `backend/app/models.py` (lines 166-228)

**Changes to Question model**:
```python
class QuestionBase(SQLModel):
    choices: list[str]  # NOW: ["Text1", "Text2", "Text3", "Text4"] (no labels)
    correct_answers: list[int]  # NOW: [0, 1] (indices, not letters)
    difficulty: str = Field(max_length=20)  # "easy" or "hard"
    question_type: str = Field(max_length=20)  # "mcq" or "multiselect"
```

### 3. Validation Updates

**File**: `backend/app/services/validators.py`

**Changes**:

1. **Update `_validate_answers`** (lines 180-207):
   - Change from letter validation (A-D) to index validation (0-3)
   - Add question_type validation:
     - MCQ: exactly 1 correct answer
     - Multiselect: 2+ correct answers

2. **Update `_validate_choices`** (lines 155-178):
   - Remove "A. " prefix check
   - Validate choices don't start with letters + periods

3. **Add new method**:
   ```python
   def _validate_question_type_consistency(self, question: dict[str, Any]) -> list[str]:
       errors = []
       question_type = question.get("question_type", "mcq")
       correct_answers = question.get("correct_answers", [])

       if question_type == "mcq" and len(correct_answers) != 1:
           errors.append("MCQ questions must have exactly 1 correct answer")
       elif question_type == "multiselect" and len(correct_answers) < 2:
           errors.append("Multiselect questions must have at least 2 correct answers")

       return errors
   ```

---

## Part 2: Image Upload Support

### 1. Backend Media Endpoint

**New File**: `backend/app/api/routes/media.py`

```python
from fastapi import APIRouter, UploadFile, File, HTTPException
from pathlib import Path
import uuid
import shutil

router = APIRouter(prefix="/media", tags=["media"])
MEDIA_DIR = Path("/app/media")
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

@router.post("/upload")
async def upload_image(file: UploadFile = File(...)) -> dict[str, str]:
    # Validate extension and size
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Invalid file type")

    # Save with UUID filename
    file_id = uuid.uuid4()
    filename = f"{file_id}{ext}"
    filepath = MEDIA_DIR / filename

    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    with filepath.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {"url": f"/api/v1/media/{filename}"}

@router.get("/{filename}")
async def get_image(filename: str):
    filepath = MEDIA_DIR / filename
    if not filepath.exists():
        raise HTTPException(404)
    from fastapi.responses import FileResponse
    return FileResponse(filepath)
```

**Register in**: `backend/app/api/main.py`

### 2. Frontend Image Support

**File**: `frontend/src/components/ui/rich-text-editor.tsx`

**Install**: `@tiptap/extension-image`

**Changes**:
1. Add Image extension to TipTap
2. Add image upload button to toolbar
3. Add clipboard paste handler for images
4. Upload to `/api/v1/media/upload` endpoint
5. Insert as `<img>` tag with URL

**TODO**: Add image compression in future iteration

---

## Part 3: Drag-Drop Choice Reordering

### 1. Install Dependencies

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### 2. Create DraggableChoice Component

**New File**: `frontend/src/components/Questions/DraggableChoice.tsx`

```typescript
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'

export function DraggableChoice({ id, index, text, isCorrect, onTextChange, onCorrectChange }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  const label = String.fromCharCode(65 + index)  // Compute A, B, C, D from index

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      <div {...attributes} {...listeners} className="cursor-grab">
        <GripVertical className="h-5 w-5 text-gray-400" />
      </div>
      <Checkbox checked={isCorrect} onCheckedChange={onCorrectChange} />
      <Label className="w-8">{label}.</Label>
      <Input value={text} onChange={(e) => onTextChange(e.target.value)} placeholder={`Choice ${label}`} />
    </div>
  )
}
```

### 3. Update AddQuestion Component

**File**: `frontend/src/components/Questions/AddQuestion.tsx`

**Changes**:
1. Change form data structure:
   ```typescript
   interface QuestionFormData {
     choices: Array<{id: string, text: string}>  // Array of objects
     correct_answers: number[]  // Indices instead of letters
     difficulty: "easy" | "hard"
     question_type: "mcq" | "multiselect"
   }
   ```

2. Add drag-drop with DndContext:
   ```typescript
   const handleDragEnd = (event: DragEndEvent) => {
     const {active, over} = event
     if (!over || active.id === over.id) return

     const oldIndex = choices.findIndex(c => c.id === active.id)
     const newIndex = choices.findIndex(c => c.id === over.id)

     // Reorder choices
     const newChoices = arrayMove(choices, oldIndex, newIndex)
     setChoices(newChoices)

     // Update correct_answers indices
     const newCorrectAnswers = correctAnswers.map(idx => {
       if (idx === oldIndex) return newIndex
       if (idx > oldIndex && idx <= newIndex) return idx - 1
       if (idx < oldIndex && idx >= newIndex) return idx + 1
       return idx
     })
     setCorrectAnswers(newCorrectAnswers)
   }
   ```

3. Add difficulty selector (RadioGroup: easy/hard)
4. Add question type selector (RadioGroup: mcq/multiselect)
5. Update onSubmit to extract text from choices, validate type consistency

### 4. Update EditQuestion Component

**File**: `frontend/src/components/Questions/EditQuestion.tsx`

Apply same changes as AddQuestion.

### 5. Update GeneratedQuestionPreview

**File**: `frontend/src/components/QuestionGeneration/GeneratedQuestionPreview.tsx`

Add drag-drop for reordering choices before approval:
- Wrap choices in DndContext
- Update correct_answers indices when dragging
- Show visual feedback during drag

---

## Part 4: Quiz Display Updates

### 1. Update Quiz Taking Component

**File**: `frontend/src/routes/_layout/quiz/take.$attemptId.tsx`

**Changes**:

1. Update answer handling (lines 119-142):
   ```typescript
   const handleAnswerChange = (index: number, checked: boolean) => {
     const currentAnswers = localAnswers[questionId] || []

     let newAnswers: number[]
     if (currentQuestion.question_type === 'mcq') {
       newAnswers = checked ? [index] : []  // Single selection
     } else {
       newAnswers = checked ? [...currentAnswers, index] : currentAnswers.filter(a => a !== index)
     }

     setLocalAnswers({ ...localAnswers, [questionId]: newAnswers })
   }
   ```

2. Update choice display (lines 316-354):
   ```typescript
   {currentQuestion.choices.map((choice, index) => {
     const label = String.fromCharCode(65 + index)  // A, B, C, D from index
     const isSelected = currentAnswers.includes(index)

     return (
       <div key={index}>
         {currentQuestion.question_type === 'mcq' ? (
           <RadioGroupItem value={String(index)} checked={isSelected} />
         ) : (
           <Checkbox checked={isSelected} onCheckedChange={(checked) => handleAnswerChange(index, checked)} />
         )}
         <Label>{label}. {choice}</Label>
       </div>
     )
   })}
   ```

### 2. Update Card Game Display

**Files**:
- `frontend/src/routes/_layout/game/play.$gameId.tsx`
- `frontend/src/components/MultiplayerGame/QuestionPopup.tsx`

Apply same changes: use indices, show radio vs checkboxes based on question_type.

---

## Part 5: AI Generation Improvements

### 1. Create Multiple Templates Per Subject/Topic

**Problem**: Only 1 template (javascript-scope-medium.json) exists, both examples are output-based.

**Solution**: Create 3-4 templates per subject/topic with different question types.

**New Templates**:

1. **`backend/app/question_templates/javascript-scope-easy-output.json`**:
   - Template type: output-based
   - 3 examples asking "What is the output?" with diverse scenarios
   - All examples use plain text choices (no "A." labels)
   - correct_answers as indices: `[0]`, `[1]`, etc.

2. **`backend/app/question_templates/javascript-scope-easy-conceptual.json`**:
   - Template type: conceptual
   - Examples testing definitions, principles
   - Include 1 multiselect example with `correct_answers: [0, 2]`

3. **`backend/app/question_templates/javascript-scope-hard-error.json`**:
   - Template type: error identification
   - Examples showing buggy code, asking what error occurs

4. **`backend/app/question_templates/javascript-scope-hard-practical.json`**:
   - Template type: practical application
   - Examples with scenarios asking how to solve problems

**Critical**: All templates must:
- Use plain text choices (no "A.", "B." labels)
- Use indices for correct_answers
- Include difficulty and question_type fields in examples
- Have 3-4 diverse examples per template

### 2. Dynamic Template Fallback

**File**: `backend/app/services/template_service.py`

**Add method** (after line 100):
```python
async def get_or_create_dynamic_template(
    self,
    subject: str,
    topic: str | None,
    difficulty: str,
    user_id: uuid.UUID
) -> QuestionTemplate:
    """Get existing template or create dynamic one with LLM-generated diverse examples."""

    # Try to find existing template
    templates = await self.list_templates(subject=subject, difficulty=difficulty, is_active=True)
    if topic:
        matching = [t for t in templates if t.topic == topic]
        if matching:
            return matching[0]
    elif templates:
        return templates[0]

    # No template found - generate dynamic one with LLM
    logger.info(f"Creating dynamic template for {subject}/{topic}/{difficulty}")

    from app.services.llm_provider import get_llm_provider
    provider = get_llm_provider()

    diversity_prompt = f"""
Generate 4 diverse example questions for {subject} - {topic or 'General'} at {difficulty} level.

CRITICAL REQUIREMENTS:
1. DO NOT include "A.", "B.", "C.", "D." labels - use plain text only
2. Indicate correct answers by INDEX (0, 1, 2, or 3) not letters
3. Create DIVERSE question types:
   - 1 output-based (show code, ask for output)
   - 1 conceptual (definitions, explanations)
   - 1 error identification (what error occurs)
   - 1 practical application (how to solve a problem)

Return as JSON array with structure:
{{
  "question_text": "HTML with <pre><code> for code",
  "choices": ["plain text 1", "plain text 2", "plain text 3", "plain text 4"],
  "correct_answers": [0],  // Indices
  "difficulty": "{difficulty}",
  "question_type": "mcq"  // or "multiselect" if 2+ correct
}}
"""

    try:
        examples = await provider.generate_diverse_examples(diversity_prompt, num_examples=4)

        template_in = QuestionTemplateCreate(
            subject=subject,
            topic=topic,
            difficulty=difficulty,
            template_prompt=f"Generate a {difficulty} question about {{topic}} in {{subject}}. DO NOT include A/B/C/D labels. Use plain text for choices. Return correct_answers as indices (0-3).",
            example_questions=examples,
            constraints={"require_diverse_types": True},
            is_active=True
        )

        return crud.create_question_template(
            session=self.session,
            template_in=template_in,
            creator_id=user_id
        )
    except Exception as e:
        logger.error(f"Failed to create dynamic template: {e}")
        # Minimal fallback
        return crud.create_question_template(...)
```

**Update frontend template lookup** (`frontend/src/routes/_layout/admin/ai-generate.tsx`):
- Remove on-the-fly template creation with empty examples
- Call backend endpoint that uses `get_or_create_dynamic_template`

### 3. Enhanced Diversity Guidance

**File**: `backend/app/services/question_generator.py`

**Update `_build_diversity_prompt`** (lines 307-383):

Change from 1-line guidance to 3-5 sentence detailed instructions:

```python
diversity_guidance = f"""

CRITICAL DIVERSITY REQUIREMENTS:
1. SUBTOPIC FOCUS: The question MUST specifically target "{subtopic}" within {topic}. Do NOT generate questions about other subtopics.

2. QUESTION TYPE: Follow the "{question_type}" format precisely:
   - If "Output-Based": Show code snippet, ask what it outputs or logs
   - If "Conceptual": Test understanding of definitions, principles, or behaviors
   - If "Error Identification": Present code with bug, ask what error occurs
   - If "Practical Application": Describe scenario, ask how to implement solution

3. FORMAT CONSTRAINTS:
   - DO NOT include "A.", "B.", "C.", "D." labels in choice text
   - Provide 4 plain text choices
   - Indicate correct answers by index (0, 1, 2, 3)
   - For multiselect, provide 2-4 correct answers
   - Set question_type: "mcq" for single answer, "multiselect" for multiple

4. DIFFICULTY: {template.difficulty} level
   - Easy: Straightforward concepts, common patterns, simple code
   - Hard: Edge cases, complex interactions, tricky behaviors

5. AVOID REPETITION: Generate unique examples, different code patterns, novel scenarios.
"""
```

### 4. Custom Prompt Input

**File**: `frontend/src/components/QuestionGeneration/GenerateForm.tsx`

**Add field**:
```typescript
interface GenerateFormData {
  subject: string
  topic?: string
  difficulty: "easy" | "hard"
  num_questions: number
  custom_prompt?: string  // NEW
  skip_content_validation: boolean
  temperature: number
}

// In JSX:
<Textarea
  {...register("custom_prompt")}
  placeholder="E.g., 'Focus on async/await edge cases' or 'Include error handling questions'"
  rows={3}
/>
```

**Backend**: Update generation endpoint to accept `custom_prompt` and append to final prompt before LLM call.

---

## Part 6: Update AI Generation for Part 1 Changes

**File**: `backend/app/services/openai_provider.py`

**Update `generate_questions`** (lines 38-86):
- Ensure generated questions have difficulty and question_type fields
- Validate choices are plain text (no labels)
- Validate correct_answers are indices (0-3)
- Explicitly instruct LLM: "DO NOT generate images, DO NOT include A/B/C/D labels"

**Update template examples**: All examples must have difficulty and question_type.

---

## Execution Order

### Phase 1: Backend Foundation (Day 1)
1. ✅ Update `backend/app/models.py` with new fields
2. ✅ Create database migration with data migration logic
3. ✅ Test migration locally on copy of production data
4. ✅ Update `backend/app/services/validators.py`
5. ✅ Create `backend/app/api/routes/media.py` endpoint
6. ✅ Register media router in `backend/app/api/main.py`

### Phase 2: AI Templates (Day 1-2)
1. ✅ Create 3-4 template files per subject/topic in `backend/app/question_templates/`
2. ✅ Update `backend/app/services/template_service.py` with dynamic fallback
3. ✅ Update `backend/app/services/question_generator.py` with enhanced diversity
4. ✅ Add custom_prompt to generation endpoint

### Phase 3: Generate API Client (Day 2)
1. ✅ Run `./scripts/generate-client.sh`
2. ✅ Commit generated TypeScript client

### Phase 4: Frontend Core (Day 2-3)
1. ✅ Install `@dnd-kit` dependencies
2. ✅ Update `frontend/src/components/ui/rich-text-editor.tsx` with Image extension
3. ✅ Create `frontend/src/components/Questions/DraggableChoice.tsx`
4. ✅ Update `frontend/src/components/Questions/AddQuestion.tsx`:
   - Drag-drop implementation
   - Difficulty selector
   - Question type selector
   - Correct answers index management
5. ✅ Update `frontend/src/components/Questions/EditQuestion.tsx` with same changes

### Phase 5: Frontend Review & Display (Day 3)
1. ✅ Update `frontend/src/components/QuestionGeneration/GeneratedQuestionPreview.tsx` with drag-drop
2. ✅ Update `frontend/src/routes/_layout/quiz/take.$attemptId.tsx`:
   - Radio vs checkbox based on question_type
   - Index-based answer handling
3. ✅ Update `frontend/src/components/MultiplayerGame/QuestionPopup.tsx` similarly
4. ✅ Update `frontend/src/components/QuestionGeneration/GenerateForm.tsx` with custom_prompt

### Phase 6: Testing & Verification (Day 4)
1. ✅ Backend unit tests
2. ✅ Test migration rollback
3. ✅ Frontend E2E tests
4. ✅ Manual testing of complete flow
5. ✅ Verify AI generation diversity improvement

---

## Critical Files to Modify

### Backend (8 files)
1. `backend/app/models.py` - Add difficulty, question_type fields
2. `backend/app/alembic/versions/<new>.py` - Migration with data migration
3. `backend/app/services/validators.py` - Update validation logic
4. `backend/app/api/routes/media.py` - NEW file for image upload
5. `backend/app/api/main.py` - Register media router
6. `backend/app/services/template_service.py` - Dynamic template fallback
7. `backend/app/services/question_generator.py` - Enhanced diversity guidance
8. `backend/app/services/openai_provider.py` - Update generation format

### Frontend (9 files)
1. `frontend/src/components/Questions/AddQuestion.tsx` - Drag-drop, difficulty, type
2. `frontend/src/components/Questions/EditQuestion.tsx` - Same as AddQuestion
3. `frontend/src/components/Questions/DraggableChoice.tsx` - NEW component
4. `frontend/src/components/ui/rich-text-editor.tsx` - Image extension
5. `frontend/src/components/QuestionGeneration/GeneratedQuestionPreview.tsx` - Drag-drop
6. `frontend/src/components/QuestionGeneration/GenerateForm.tsx` - Custom prompt
7. `frontend/src/routes/_layout/quiz/take.$attemptId.tsx` - Radio vs checkbox
8. `frontend/src/routes/_layout/game/play.$gameId.tsx` - Same as quiz
9. `frontend/src/components/MultiplayerGame/QuestionPopup.tsx` - Same as quiz

### Templates (4+ files)
1. `backend/app/question_templates/javascript-scope-easy-output.json` - NEW
2. `backend/app/question_templates/javascript-scope-easy-conceptual.json` - NEW
3. `backend/app/question_templates/javascript-scope-hard-error.json` - NEW
4. `backend/app/question_templates/javascript-scope-hard-practical.json` - NEW
5. (Repeat for other subjects/topics as needed)

---

## Risk Mitigation

### Data Migration Safety
- ✅ Create database backup before migration
- ✅ Test migration on copy of production data
- ✅ Include rollback migration
- ✅ Verify data integrity after migration

### Validation Edge Cases
- Empty correct_answers array → validation error
- Duplicate indices → validation error
- MCQ with multiple answers → validation error
- Multiselect with 1 answer → validation error
- Images in AI-generated questions → explicitly prevented in templates

### Performance
- Image uploads limited to 5MB
- Media files stored with UUID filenames (no conflicts)
- TODO: Add image compression in future

---

## Success Criteria

1. ✅ All existing questions migrated successfully (choices stripped, indices converted)
2. ✅ Drag-drop reordering works seamlessly with correct_answers auto-update
3. ✅ MCQ shows radio buttons, multiselect shows checkboxes
4. ✅ Images work in question text and choices (manual questions only)
5. ✅ AI generates 3-4 distinct question types per batch (not just output-based)
6. ✅ Custom prompt influences generation effectively
7. ✅ Dynamic template fallback creates diverse examples for new subjects
8. ✅ Zero data loss, zero breaking changes to existing functionality
