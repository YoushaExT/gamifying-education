# Quick Checklist - Remaining Tasks

## 🔴 Critical (Must Do Before Testing)

- [ ] **Apply Database Migration**
  ```bash
  cd backend
  source .venv/bin/activate
  alembic upgrade head
  ```
  - Verify no errors
  - Check database: `SELECT difficulty, question_type FROM question LIMIT 5;`

- [ ] **Regenerate API Client**
  ```bash
  cd .. # to root directory
  source backend/.venv/bin/activate
  ./scripts/generate-client.sh
  ```
  - Verify frontend/src/client/ is updated
  - Check no TypeScript errors: `cd frontend && npx tsc --noEmit`

## 🟡 Important (Should Test)

### Backend Manual Testing
- [ ] Create new question with difficulty=easy, question_type=mcq
- [ ] Create new question with difficulty=hard, question_type=multiselect
- [ ] Edit an existing question (verify backward compatibility)
- [ ] Upload image in question text via media endpoint
- [ ] Generate 3 AI questions with custom_prompt="Focus on error handling"
- [ ] Verify diverse question types are generated
- [ ] Submit quiz answer with indices [0, 2]
- [ ] Play card game and answer question

### Frontend Manual Testing
- [ ] Open AddQuestion, drag choice A to position C, verify labels update
- [ ] Create MCQ question, verify only one checkbox can be selected
- [ ] Create multiselect question, verify multiple checkboxes work
- [ ] Open EditQuestion on old question, verify it displays correctly
- [ ] Upload image via toolbar button
- [ ] Paste image from clipboard (Cmd+V)
- [ ] Take quiz with MCQ, verify radio buttons appear
- [ ] Take quiz with multiselect, verify checkboxes appear
- [ ] Generate questions, drag-drop choices, approve
- [ ] Play card game, answer question popup

## 🟢 Nice to Have (Optional)

- [ ] Preview question with new format
- [ ] Test migration rollback: `alembic downgrade -1`
- [ ] Update unit tests for new data format
- [ ] Update E2E tests for new UI
- [ ] Test with various image formats (PNG, JPG, GIF)
- [ ] Test image size validation (upload >5MB file)
- [ ] Generate questions for a new subject without templates

## 📊 Coverage Summary

### Areas Covered (100% Code Complete)
- ✅ Backend data model (difficulty, question_type, indices)
- ✅ Backend validation (index-based, type consistency)
- ✅ Backend media upload (images)
- ✅ Backend AI generation (diversity, templates, custom prompts)
- ✅ Backend game service (index-based answers)
- ✅ Backend quiz service (index-based answers)
- ✅ Frontend drag-drop (choice reordering)
- ✅ Frontend image upload (button + clipboard)
- ✅ Frontend question forms (difficulty, question_type)
- ✅ Frontend quiz UI (radio/checkbox)
- ✅ Frontend game UI (radio/checkbox)
- ✅ Frontend AI generation UI (custom prompt)
- ✅ Type safety (TypeScript + mypy)
- ✅ Code quality (linting, formatting)
- ✅ OpenAI model update (GPT-5-mini)

### Areas NOT Covered (Known Gaps)
- ❌ Database migration not applied
- ❌ API client not regenerated
- ❌ No manual testing performed
- ❌ No automated tests updated
- ❌ No user documentation created

## 🐛 Known Potential Issues

1. **API Client Type Mismatch** (High Priority)
   - Issue: Frontend may have stale types from old API client
   - Fix: Regenerate client after backend changes
   - Test: Check TypeScript compilation

2. **Migration Data Loss** (High Priority)
   - Issue: Migration logic could corrupt existing questions
   - Fix: Test on copy of production data first
   - Backup: Create database backup before migration

3. **Image Persistence** (Medium Priority)
   - Issue: Images stored locally, may not survive container restart
   - Fix: Use volume mount for /app/media
   - Future: Move to S3/cloud storage

4. **Backward Compatibility** (Medium Priority)
   - Issue: Old questions with letter-based answers
   - Fix: Migration + EditQuestion parsing
   - Test: Edit old questions

5. **Drag-Drop Edge Cases** (Low Priority)
   - Issue: Dragging with only 2 choices, dragging to same position
   - Fix: Already handled with checks, but should test

## 📝 Testing Script

```bash
# 1. Apply Migration
cd backend
source .venv/bin/activate
alembic upgrade head
echo "✅ Migration applied"

# 2. Regenerate Client
cd ..
./scripts/generate-client.sh
echo "✅ API client regenerated"

# 3. Check TypeScript
cd frontend
npx tsc --noEmit
echo "✅ TypeScript checks pass"

# 4. Check Linting
npm run lint
echo "✅ Frontend linting passes"

# 5. Check Backend
cd ../backend
bash scripts/lint.sh
echo "✅ Backend linting passes"

# 6. Start Services
cd ..
docker compose up -d
echo "✅ Services started"

# 7. Manual Testing Checklist
echo "📋 Now perform manual testing checklist above"
```

## 🎯 Definition of Done

- [x] All code written and committed
- [x] All type errors fixed
- [x] All linting checks pass
- [ ] Database migration applied successfully
- [ ] API client regenerated
- [ ] Manual testing completed
- [ ] No critical bugs found
- [ ] Backward compatibility verified
- [ ] User documentation updated (optional)
- [ ] Pull request created
- [ ] Code reviewed (optional)
- [ ] Deployed to staging
- [ ] Deployed to production

## 📞 Help Needed?

If you encounter issues:

1. **Migration Fails**
   - Check database connection
   - Check for existing difficulty/question_type columns
   - Review migration logs
   - Try: `alembic downgrade -1` then `alembic upgrade head`

2. **API Client Generation Fails**
   - Ensure backend venv is activated
   - Check backend starts: `cd backend && fastapi dev app/main.py`
   - Check for import errors in main.py

3. **TypeScript Errors After Client Regen**
   - Clear node_modules: `rm -rf node_modules && npm install`
   - Restart TypeScript server in IDE
   - Check for type mismatches in updated files

4. **Questions Don't Display**
   - Check browser console for errors
   - Verify API response format: `/api/v1/questions?limit=1`
   - Check if correct_answers are integers not strings

5. **Drag-Drop Doesn't Work**
   - Check @dnd-kit packages installed
   - Check browser console for errors
   - Verify choices have unique IDs

---

**Last Updated**: 2026-01-01
**Next Action**: Apply database migration
