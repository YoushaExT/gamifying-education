import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { QuestionsService, QuizzesService } from "@/client"
import type { QuestionPublic, QuizAnswerSubmit } from "@/client/types.gen"
import { QuestionDisplay } from "@/components/Questions/QuestionDisplay"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

export const Route = createFileRoute("/_layout/quiz/take/$attemptId")({
  component: QuizTakePage,
})

function QuizTakePage() {
  const { attemptId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [localAnswers, setLocalAnswers] = useState<Record<string, number[]>>({})
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch quiz attempt
  const {
    data: attempt,
    isLoading: attemptLoading,
    error: attemptError,
  } = useQuery({
    queryKey: ["quiz-attempt", attemptId],
    queryFn: () => QuizzesService.getAttempt({ attemptId }),
    refetchInterval: false,
  })

  // Fetch quiz details to get timer settings
  const { data: quiz } = useQuery({
    queryKey: ["quiz", attempt?.quiz_id],
    queryFn: () => QuizzesService.getQuizDetails({ quizId: attempt!.quiz_id }),
    enabled: !!attempt?.quiz_id,
  })

  // Fetch all questions for this quiz
  const {
    data: questionsData,
    isLoading: questionsLoading,
    error: questionsError,
  } = useQuery({
    queryKey: ["quiz-questions", attempt?.question_ids],
    queryFn: async () => {
      if (!attempt) return []
      // Fetch each question
      const questionPromises = attempt.question_ids.map((id: string) =>
        QuestionsService.readQuestion({ id }),
      )
      return Promise.all(questionPromises)
    },
    enabled: !!attempt,
  })

  const questions = (questionsData || []) as QuestionPublic[]
  const currentQuestion = questions[currentQuestionIndex]

  // Load saved answers from attempt
  useEffect(() => {
    if (attempt?.user_answers) {
      setLocalAnswers(attempt.user_answers as Record<string, number[]>)
    }
  }, [attempt])

  // Submit answer mutation
  const submitAnswerMutation = useMutation({
    mutationFn: (answer: QuizAnswerSubmit) =>
      QuizzesService.submitAnswer({
        attemptId,
        requestBody: answer,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quiz-attempt", attemptId] })
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to save answer")
    },
  })

  // Complete quiz mutation
  const completeQuizMutation = useMutation({
    mutationFn: () =>
      QuizzesService.completeQuiz({
        attemptId,
      }),
    onSuccess: () => {
      toast.success("Quiz completed!")
      navigate({ to: `/quiz/results/${attemptId}` })
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to complete quiz")
      setIsSubmitting(false)
    },
  })

  const handleAnswerChange = (index: number, checked: boolean) => {
    if (!currentQuestion) return

    const questionId = currentQuestion.id
    const currentAnswers = localAnswers[questionId] || []

    let newAnswers: number[]
    if (currentQuestion.question_type === "mcq") {
      // MCQ: single selection
      newAnswers = checked ? [index] : []
    } else {
      // Multiselect: multiple selection
      if (checked) {
        if (!currentAnswers.includes(index)) {
          newAnswers = [...currentAnswers, index]
        } else {
          newAnswers = currentAnswers
        }
      } else {
        newAnswers = currentAnswers.filter((a) => a !== index)
      }
    }

    setLocalAnswers({
      ...localAnswers,
      [questionId]: newAnswers,
    })

    // Auto-save answer
    submitAnswerMutation.mutate({
      question_id: questionId,
      selected_answers: newAnswers,
    })
  }

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    }
  }

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
    }
  }

  const handleSubmitQuiz = useCallback(() => {
    if (
      window.confirm(
        "Are you sure you want to submit the quiz? You won't be able to change your answers after submission.",
      )
    ) {
      setIsSubmitting(true)
      completeQuizMutation.mutate()
    }
  }, [completeQuizMutation])

  // Initialize and manage timer
  useEffect(() => {
    if (!attempt || !quiz) return
    if (!quiz.is_timed || !quiz.time_limit) return

    // Calculate time elapsed since quiz started
    const startTime = new Date(attempt.started_at).getTime()
    const currentTime = Date.now()
    const elapsedSeconds = Math.floor((currentTime - startTime) / 1000)
    const remaining = Math.max(0, quiz.time_limit - elapsedSeconds)

    setTimeRemaining(remaining)

    // Set up timer countdown
    const intervalId = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 0) {
          clearInterval(intervalId)
          // Auto-submit quiz when time runs out
          if (prev === 0 && !isSubmitting) {
            handleSubmitQuiz()
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(intervalId)
  }, [attempt, quiz, handleSubmitQuiz, isSubmitting])

  if (attemptLoading || questionsLoading) {
    return (
      <div className="container mx-auto max-w-4xl py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Loading quiz...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (attemptError || questionsError) {
    return (
      <div className="container mx-auto max-w-4xl py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {attemptError?.message ||
              questionsError?.message ||
              "Failed to load quiz"}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!attempt || questions.length === 0) {
    return (
      <div className="container mx-auto max-w-4xl py-8">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Questions Found</AlertTitle>
          <AlertDescription>
            This quiz doesn't have any questions.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (attempt.status !== "in_progress") {
    return (
      <div className="container mx-auto max-w-4xl py-8">
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Quiz Already Completed</AlertTitle>
          <AlertDescription>
            This quiz has already been completed.
            <Button
              variant="link"
              className="ml-2 p-0"
              onClick={() => navigate({ to: `/quiz/results/${attemptId}` })}
            >
              View Results
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const progress = ((currentQuestionIndex + 1) / questions.length) * 100
  const answeredCount = Object.keys(localAnswers).length
  const currentAnswers = currentQuestion
    ? localAnswers[currentQuestion.id] || []
    : []

  return (
    <div className="container mx-auto max-w-4xl py-8">
      {/* Progress Bar */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">
            Question {currentQuestionIndex + 1} of {questions.length}
          </span>
          <span className="text-muted-foreground">
            {answeredCount} answered
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Timer (if applicable) */}
      {timeRemaining !== null && (
        <Alert className="mb-6">
          <Clock className="h-4 w-4" />
          <AlertTitle>Time Remaining</AlertTitle>
          <AlertDescription>
            {Math.floor(timeRemaining / 60)}:
            {(timeRemaining % 60).toString().padStart(2, "0")}
          </AlertDescription>
        </Alert>
      )}

      {/* Question Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            Question {currentQuestionIndex + 1}
          </CardTitle>
          {currentQuestion && (
            <CardDescription>
              {currentQuestion.subject}
              {currentQuestion.topic && ` • ${currentQuestion.topic}`}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Question Text */}
          {currentQuestion && (
            <div className="rounded-lg border bg-muted/50 p-6">
              <QuestionDisplay html={currentQuestion.question_text} />
            </div>
          )}

          {/* Answer Choices */}
          {currentQuestion && (
            <div className="space-y-3">
              <Label className="text-base font-semibold">
                {currentQuestion.question_type === "mcq"
                  ? "Select your answer:"
                  : "Select all correct answers:"}
              </Label>

              {currentQuestion.question_type === "mcq" ? (
                <RadioGroup
                  value={
                    currentAnswers.length > 0
                      ? String(currentAnswers[0])
                      : undefined
                  }
                  onValueChange={(value) =>
                    handleAnswerChange(Number.parseInt(value, 10), true)
                  }
                  className="space-y-3"
                >
                  {currentQuestion.choices.map((choice, index) => {
                    const label = String.fromCharCode(65 + index) // A, B, C, D
                    const isSelected = currentAnswers.includes(index)

                    return (
                      <div
                        key={index}
                        className={`flex items-start space-x-3 rounded-lg border p-4 transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <RadioGroupItem
                          value={String(index)}
                          id={`choice-${index}`}
                          className="mt-1"
                        />
                        <Label
                          htmlFor={`choice-${index}`}
                          className="flex-1 cursor-pointer text-base leading-relaxed"
                        >
                          <span className="font-semibold">{label}.</span>{" "}
                          {choice}
                        </Label>
                      </div>
                    )
                  })}
                </RadioGroup>
              ) : (
                <div className="space-y-3">
                  {currentQuestion.choices.map((choice, index) => {
                    const label = String.fromCharCode(65 + index) // A, B, C, D
                    const isSelected = currentAnswers.includes(index)

                    return (
                      <div
                        key={index}
                        className={`flex items-start space-x-3 rounded-lg border p-4 transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <Checkbox
                          id={`choice-${index}`}
                          checked={isSelected}
                          onCheckedChange={(checked) =>
                            handleAnswerChange(index, checked === true)
                          }
                          className="mt-1"
                        />
                        <Label
                          htmlFor={`choice-${index}`}
                          className="flex-1 cursor-pointer text-base leading-relaxed"
                        >
                          <span className="font-semibold">{label}.</span>{" "}
                          {choice}
                        </Label>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between border-t pt-6">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentQuestionIndex === 0}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Previous
            </Button>

            <div className="flex gap-3">
              {currentQuestionIndex < questions.length - 1 ? (
                <Button onClick={handleNext}>
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmitQuiz}
                  disabled={isSubmitting || completeQuizMutation.isPending}
                  variant="default"
                  className="min-w-[140px]"
                >
                  {isSubmitting || completeQuizMutation.isPending
                    ? "Submitting..."
                    : "Submit Quiz"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Question Navigation Grid */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Question Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-10 gap-2">
            {questions.map((q, index) => {
              const isAnswered = localAnswers[q.id]?.length > 0
              const isCurrent = index === currentQuestionIndex

              return (
                <button
                  type="button"
                  key={q.id}
                  onClick={() => setCurrentQuestionIndex(index)}
                  className={`aspect-square rounded-md border text-sm font-medium transition-colors ${
                    isCurrent
                      ? "border-primary bg-primary text-primary-foreground"
                      : isAnswered
                        ? "border-green-500 bg-green-50 text-green-700 hover:bg-green-100"
                        : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  {index + 1}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
