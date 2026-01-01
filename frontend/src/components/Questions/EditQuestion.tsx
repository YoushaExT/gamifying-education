import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useId, useState } from "react"
import { Controller, type SubmitHandler, useForm } from "react-hook-form"
import { z } from "zod"

import {
  type QuestionDifficulty,
  type QuestionPublic,
  QuestionsService,
  type QuestionType,
  type QuestionUpdate,
  SubjectsService,
  TopicsService,
} from "@/client"
import type { ApiError } from "@/client/core/ApiError"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import { Button } from "../ui/button"
import { Combobox } from "../ui/combobox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog"
import { Label } from "../ui/label"
import { RadioGroup, RadioGroupItem } from "../ui/radio-group"
import { RichTextEditor } from "../ui/rich-text-editor"
import { DraggableChoice } from "./DraggableChoice"

// Internal form type (includes id for drag-drop)
const choiceItemSchema = z.object({
  id: z.string(),
  text: z.string().min(1, "Choice text is required"),
})

// Form schema based on backend types
const questionFormSchema = z
  .object({
    question_text: z.string().min(1, "Question text is required"),
    choices: z.array(choiceItemSchema).length(4, "Must have exactly 4 choices"),
    correct_answers: z
      .array(z.number().int().min(0).max(3))
      .min(1, "Must have at least 1 correct answer"),
    // Use backend-generated enum types
    difficulty: z.enum([
      "easy",
      "hard",
    ] as const) satisfies z.ZodType<QuestionDifficulty>,
    question_type: z.enum([
      "mcq",
      "multiselect",
    ] as const) satisfies z.ZodType<QuestionType>,
    subject: z.string().min(1, "Subject is required"),
    topic: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.question_type === "mcq") {
        return data.correct_answers.length === 1
      }
      return data.correct_answers.length >= 2
    },
    {
      message:
        "MCQ must have exactly 1 correct answer, multiselect must have at least 2",
      path: ["correct_answers"],
    },
  )

type QuestionFormData = z.infer<typeof questionFormSchema>

interface EditQuestionProps {
  question: QuestionPublic
  children: React.ReactNode
}

const EditQuestion = ({ question, children }: EditQuestionProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()
  const questionId = useId()
  const diffEasyId = useId()
  const diffHardId = useId()
  const typeMcqId = useId()
  const typeMultiId = useId()

  // Fetch subjects and topics from dedicated endpoints
  const { data: subjectsData } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => SubjectsService.readSubjects({ limit: 1000 }),
  })

  const { data: topicsData } = useQuery({
    queryKey: ["topics"],
    queryFn: () => TopicsService.readTopics({ limit: 1000 }),
  })

  const subjects = subjectsData?.data.map((s) => s.name).sort() || []
  const topics = topicsData?.data.map((t) => t.name).sort() || []

  // Parse existing choices - handle both old format ("A. Text") and new format ("Text")
  const parseChoice = useCallback((choice: string) => {
    return choice.replace(/^[A-D]\.\s*/, "")
  }, [])

  // Parse correct answers - handle both old format (["A", "B"]) and new format ([0, 1])
  const parseCorrectAnswers = useCallback((answers: any[]): number[] => {
    if (!answers || answers.length === 0) return []

    // Check if already indices (numbers)
    if (typeof answers[0] === "number") {
      return answers as number[]
    }

    // Convert letters to indices
    const letterMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 }
    return answers.map((a) => letterMap[a as string] ?? 0)
  }, [])

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting, isValid },
  } = useForm<QuestionFormData>({
    resolver: zodResolver(questionFormSchema),
    mode: "onChange",
  })

  // Reset form when dialog opens with question data
  useEffect(() => {
    if (isOpen) {
      const parsedChoices = question.choices.map((choice, idx) => ({
        id: `choice-${idx + 1}`,
        text: parseChoice(choice),
      }))

      const parsedCorrectAnswers = parseCorrectAnswers(question.correct_answers)

      reset({
        question_text: question.question_text,
        choices: parsedChoices,
        correct_answers: parsedCorrectAnswers,
        difficulty: (question.difficulty as "easy" | "hard") || "easy",
        question_type:
          (question.question_type as "mcq" | "multiselect") || "mcq",
        subject: question.subject,
        topic: question.topic || "",
      })
    }
  }, [isOpen, question, reset, parseChoice, parseCorrectAnswers])

  const choices = watch("choices")
  const correctAnswers = watch("correct_answers")
  const questionType = watch("question_type")

  const mutation = useMutation({
    mutationFn: (data: QuestionUpdate) =>
      QuestionsService.updateQuestion({ id: question.id, requestBody: data }),
    onSuccess: () => {
      showSuccessToast("Question updated successfully.")
      setIsOpen(false)
    },
    onError: (err: ApiError) => {
      handleError(err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["questions"] })
      queryClient.invalidateQueries({ queryKey: ["subjects"] })
      queryClient.invalidateQueries({ queryKey: ["topics"] })
    },
  })

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    const oldIndex = choices.findIndex((c) => c.id === active.id)
    const newIndex = choices.findIndex((c) => c.id === over.id)

    // Reorder choices
    const newChoices = arrayMove(choices, oldIndex, newIndex)
    setValue("choices", newChoices, { shouldValidate: true })

    // Update correct_answers indices
    const newCorrectAnswers = correctAnswers.map((idx) => {
      if (idx === oldIndex) return newIndex
      if (idx > oldIndex && idx <= newIndex) return idx - 1
      if (idx < oldIndex && idx >= newIndex) return idx + 1
      return idx
    })
    setValue("correct_answers", newCorrectAnswers, { shouldValidate: true })
  }

  const handleChoiceTextChange = (index: number, text: string) => {
    const newChoices = [...choices]
    newChoices[index].text = text
    setValue("choices", newChoices, { shouldValidate: true })
  }

  const handleCorrectChange = (index: number, checked: boolean) => {
    let newCorrectAnswers = [...correctAnswers]

    if (questionType === "mcq") {
      // MCQ: single selection
      newCorrectAnswers = checked ? [index] : []
    } else {
      // Multiselect: multiple selection
      if (checked) {
        if (!newCorrectAnswers.includes(index)) {
          newCorrectAnswers.push(index)
        }
      } else {
        newCorrectAnswers = newCorrectAnswers.filter((i) => i !== index)
      }
    }

    setValue("correct_answers", newCorrectAnswers, { shouldValidate: true })
  }

  const onSubmit: SubmitHandler<QuestionFormData> = (data) => {
    // Validate correct answers
    if (data.correct_answers.length === 0) {
      handleError({
        message: "Please select at least one correct answer",
      } as any)
      return
    }

    if (data.question_type === "mcq" && data.correct_answers.length !== 1) {
      handleError({
        message: "MCQ questions must have exactly 1 correct answer",
      } as any)
      return
    }

    if (
      data.question_type === "multiselect" &&
      data.correct_answers.length < 2
    ) {
      handleError({
        message: "Multiselect questions must have at least 2 correct answers",
      } as any)
      return
    }

    // Validate all choices are filled
    if (data.choices.some((c) => !c.text.trim())) {
      handleError({
        message: "All choices must be filled",
      } as any)
      return
    }

    // Extract plain text choices (no labels)
    const choicesText = data.choices.map((c) => c.text)

    const questionData: QuestionUpdate = {
      question_text: data.question_text,
      choices: choicesText,
      correct_answers: data.correct_answers,
      difficulty: data.difficulty,
      question_type: data.question_type,
      subject: data.subject,
      topic: data.topic || null,
    }

    mutation.mutate(questionData)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Edit Question</DialogTitle>
            <DialogDescription>
              Update the question details. Drag choices to reorder them.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor={questionId}>
                Question Text <span className="text-destructive">*</span>
              </Label>
              <Controller
                name="question_text"
                control={control}
                rules={{ required: "Question text is required" }}
                render={({ field }) => (
                  <RichTextEditor
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Enter your question here..."
                  />
                )}
              />
              {errors.question_text && (
                <p className="text-sm text-destructive">
                  {errors.question_text.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  Difficulty <span className="text-destructive">*</span>
                </Label>
                <Controller
                  name="difficulty"
                  control={control}
                  render={({ field }) => (
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="easy" id={diffEasyId} />
                        <Label
                          htmlFor={diffEasyId}
                          className="font-normal cursor-pointer"
                        >
                          Easy
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="hard" id={diffHardId} />
                        <Label
                          htmlFor={diffHardId}
                          className="font-normal cursor-pointer"
                        >
                          Hard
                        </Label>
                      </div>
                    </RadioGroup>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label>
                  Question Type <span className="text-destructive">*</span>
                </Label>
                <Controller
                  name="question_type"
                  control={control}
                  render={({ field }) => (
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="mcq" id={typeMcqId} />
                        <Label
                          htmlFor={typeMcqId}
                          className="font-normal cursor-pointer"
                        >
                          MCQ (Single)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="multiselect" id={typeMultiId} />
                        <Label
                          htmlFor={typeMultiId}
                          className="font-normal cursor-pointer"
                        >
                          Multiselect
                        </Label>
                      </div>
                    </RadioGroup>
                  )}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>
                Choices <span className="text-destructive">*</span>
                <span className="text-sm text-muted-foreground ml-2">
                  (Drag to reorder)
                </span>
              </Label>

              <DndContext
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={choices?.map((c) => c.id) || []}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {choices?.map((choice, index) => (
                      <DraggableChoice
                        key={choice.id}
                        id={choice.id}
                        index={index}
                        text={choice.text}
                        isCorrect={correctAnswers?.includes(index) || false}
                        onTextChange={(text) =>
                          handleChoiceTextChange(index, text)
                        }
                        onCorrectChange={(checked) =>
                          handleCorrectChange(index, checked)
                        }
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>

            <div className="space-y-2">
              <Label>
                Subject <span className="text-destructive">*</span>
              </Label>
              <Controller
                name="subject"
                control={control}
                rules={{ required: "Subject is required" }}
                render={({ field }) => (
                  <Combobox
                    options={subjects}
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder="Select or add subject..."
                    searchPlaceholder="Search subjects..."
                    addNewText="Add new subject"
                    emptyText="No subjects found. Type to add new."
                  />
                )}
              />
              {errors.subject && (
                <p className="text-sm text-destructive">
                  {errors.subject.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Topic (Optional)</Label>
              <Controller
                name="topic"
                control={control}
                render={({ field }) => (
                  <Combobox
                    options={topics}
                    value={field.value || ""}
                    onValueChange={field.onChange}
                    placeholder="Select or add topic..."
                    searchPlaceholder="Search topics..."
                    addNewText="Add new topic"
                    emptyText="No topics found. Type to add new."
                  />
                )}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || isSubmitting}>
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default EditQuestion
