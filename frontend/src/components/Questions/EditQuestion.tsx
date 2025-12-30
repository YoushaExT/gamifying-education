import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useId, useState } from "react"
import { type SubmitHandler, useForm } from "react-hook-form"

import {
  type QuestionPublic,
  QuestionsService,
  type QuestionUpdate,
  SubjectsService,
  TopicsService,
} from "@/client"
import type { ApiError } from "@/client/core/ApiError"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import { Button } from "../ui/button"
import { Checkbox } from "../ui/checkbox"
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
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { RichTextEditor } from "../ui/rich-text-editor"

interface QuestionFormData {
  question_text: string
  choice_a: string
  choice_b: string
  choice_c: string
  choice_d: string
  correct_a: boolean
  correct_b: boolean
  correct_c: boolean
  correct_d: boolean
  subject: string
  topic?: string
}

interface EditQuestionProps {
  question: QuestionPublic
  children: React.ReactNode
}

const EditQuestion = ({ question, children }: EditQuestionProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()
  const questionId = useId()
  const choiceAId = useId()
  const choiceBId = useId()
  const choiceCId = useId()
  const choiceDId = useId()
  const correctAId = useId()
  const correctBId = useId()
  const correctCId = useId()
  const correctDId = useId()

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

  // Parse existing choices (format: "A. Text")
  const parseChoice = useCallback((choice: string) => {
    return choice.replace(/^[A-D]\.\s*/, "")
  }, [])

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isValid, isSubmitting },
  } = useForm<QuestionFormData>({
    mode: "onBlur",
    criteriaMode: "all",
  })

  // Reset form when dialog opens with question data
  useEffect(() => {
    if (isOpen) {
      reset({
        question_text: question.question_text,
        choice_a: parseChoice(question.choices[0] || ""),
        choice_b: parseChoice(question.choices[1] || ""),
        choice_c: parseChoice(question.choices[2] || ""),
        choice_d: parseChoice(question.choices[3] || ""),
        correct_a: question.correct_answers.includes("A"),
        correct_b: question.correct_answers.includes("B"),
        correct_c: question.correct_answers.includes("C"),
        correct_d: question.correct_answers.includes("D"),
        subject: question.subject,
        topic: question.topic || "",
      })
    }
  }, [isOpen, question, reset, parseChoice])

  const correctAnswers = {
    a: watch("correct_a"),
    b: watch("correct_b"),
    c: watch("correct_c"),
    d: watch("correct_d"),
  }

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

  const onSubmit: SubmitHandler<QuestionFormData> = (data) => {
    const choices = [
      `A. ${data.choice_a}`,
      `B. ${data.choice_b}`,
      `C. ${data.choice_c}`,
      `D. ${data.choice_d}`,
    ]

    const correct_answers: string[] = []
    if (data.correct_a) correct_answers.push("A")
    if (data.correct_b) correct_answers.push("B")
    if (data.correct_c) correct_answers.push("C")
    if (data.correct_d) correct_answers.push("D")

    if (correct_answers.length === 0) {
      handleError({
        message: "Please select at least one correct answer",
      } as any)
      return
    }

    const questionData: QuestionUpdate = {
      question_text: data.question_text,
      choices,
      correct_answers,
      subject: data.subject,
      topic: data.topic || null,
    }

    mutation.mutate(questionData)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Edit Question</DialogTitle>
            <DialogDescription>
              Update the question details. Select one or more correct answers
              for multi-select questions.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor={questionId}>
                Question Text <span className="text-destructive">*</span>
              </Label>
              <RichTextEditor
                value={watch("question_text")}
                onChange={(html) => setValue("question_text", html)}
                placeholder="Enter your question here..."
              />
              {errors.question_text && (
                <p className="text-sm text-destructive">
                  {errors.question_text.message}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <Label>
                Choices <span className="text-destructive">*</span>
              </Label>

              <div className="flex items-center gap-2">
                <Checkbox
                  id={correctAId}
                  checked={correctAnswers.a}
                  onCheckedChange={(checked) =>
                    setValue("correct_a", !!checked)
                  }
                />
                <Label htmlFor={choiceAId} className="flex-1 mb-0">
                  A.
                </Label>
                <Input
                  id={choiceAId}
                  {...register("choice_a", {
                    required: "Choice A is required.",
                  })}
                  placeholder="Choice A"
                  className="flex-1"
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id={correctBId}
                  checked={correctAnswers.b}
                  onCheckedChange={(checked) =>
                    setValue("correct_b", !!checked)
                  }
                />
                <Label htmlFor={choiceBId} className="flex-1 mb-0">
                  B.
                </Label>
                <Input
                  id={choiceBId}
                  {...register("choice_b", {
                    required: "Choice B is required.",
                  })}
                  placeholder="Choice B"
                  className="flex-1"
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id={correctCId}
                  checked={correctAnswers.c}
                  onCheckedChange={(checked) =>
                    setValue("correct_c", !!checked)
                  }
                />
                <Label htmlFor={choiceCId} className="flex-1 mb-0">
                  C.
                </Label>
                <Input
                  id={choiceCId}
                  {...register("choice_c", {
                    required: "Choice C is required.",
                  })}
                  placeholder="Choice C"
                  className="flex-1"
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id={correctDId}
                  checked={correctAnswers.d}
                  onCheckedChange={(checked) =>
                    setValue("correct_d", !!checked)
                  }
                />
                <Label htmlFor={choiceDId} className="flex-1 mb-0">
                  D.
                </Label>
                <Input
                  id={choiceDId}
                  {...register("choice_d", {
                    required: "Choice D is required.",
                  })}
                  placeholder="Choice D"
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>
                Subject <span className="text-destructive">*</span>
              </Label>
              <Combobox
                options={subjects}
                value={watch("subject")}
                onValueChange={(value) => setValue("subject", value)}
                placeholder="Select or add subject..."
                searchPlaceholder="Search subjects..."
                addNewText="Add new subject"
                emptyText="No subjects found. Type to add new."
              />
              {errors.subject && (
                <p className="text-sm text-destructive">
                  {errors.subject.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Topic (Optional)</Label>
              <Combobox
                options={topics}
                value={watch("topic") || ""}
                onValueChange={(value) => setValue("topic", value)}
                placeholder="Select or add topic..."
                searchPlaceholder="Search topics..."
                addNewText="Add new topic"
                emptyText="No topics found. Type to add new."
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
