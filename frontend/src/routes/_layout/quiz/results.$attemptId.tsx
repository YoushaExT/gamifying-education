import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  AlertCircle,
  Award,
  CheckCircle2,
  Clock,
  Home,
  XCircle,
} from "lucide-react"
import { QuizzesService } from "@/client"
import { QuestionDisplay } from "@/components/Questions/QuestionDisplay"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const Route = createFileRoute("/_layout/quiz/results/$attemptId")({
  component: QuizResultsPage,
})

function QuizResultsPage() {
  const { attemptId } = Route.useParams()
  const navigate = useNavigate()

  // Fetch quiz results
  const {
    data: results,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["quiz-results", attemptId],
    queryFn: () => QuizzesService.getQuizResults({ attemptId }),
  })

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-6xl py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Loading results...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-6xl py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error.message || "Failed to load quiz results"}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!results) {
    return (
      <div className="container mx-auto max-w-6xl py-8">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Results Found</AlertTitle>
          <AlertDescription>
            Unable to find results for this quiz.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const percentage = results.percentage || 0
  const isPassing = percentage >= 60 // 60% passing grade

  return (
    <div className="container mx-auto max-w-6xl py-8">
      {/* Score Summary Card */}
      <Card className="mb-8">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
            <Award className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-3xl">Quiz Completed!</CardTitle>
          <CardDescription>Here are your results</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            {/* Score */}
            <div className="text-center">
              <div className="mb-2 text-4xl font-bold text-primary">
                {results.score}/{results.total_questions}
              </div>
              <div className="text-sm text-muted-foreground">
                Questions Correct
              </div>
            </div>

            {/* Percentage */}
            <div className="text-center">
              <div
                className={`mb-2 text-4xl font-bold ${isPassing ? "text-green-600" : "text-orange-600"}`}
              >
                {percentage.toFixed(1)}%
              </div>
              <div className="text-sm text-muted-foreground">Score</div>
              <Badge
                variant={isPassing ? "default" : "secondary"}
                className="mt-2"
              >
                {isPassing ? "Passed" : "Needs Improvement"}
              </Badge>
            </div>

            {/* Time */}
            <div className="text-center">
              <div className="mb-2 flex items-center justify-center gap-2 text-2xl font-bold">
                <Clock className="h-6 w-6 text-muted-foreground" />
                {results.time_taken !== null && results.time_taken !== undefined
                  ? `${Math.floor(results.time_taken / 60)}:${(results.time_taken % 60).toString().padStart(2, "0")}`
                  : "N/A"}
              </div>
              <div className="text-sm text-muted-foreground">Time Taken</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex justify-center gap-3">
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/quiz/start" })}
            >
              <Home className="mr-2 h-4 w-4" />
              Take Another Quiz
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Results */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Review Your Answers</h2>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-muted-foreground">Correct</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-muted-foreground">Incorrect</span>
            </div>
          </div>
        </div>

        {results.details?.map((detail, index) => {
          const isCorrect = detail.is_correct

          return (
            <Card
              key={detail.question_id}
              className={`border-l-4 ${isCorrect ? "border-l-green-500" : "border-l-red-500"}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      Question {index + 1}
                      {isCorrect ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                    </CardTitle>
                    <CardDescription>
                      {detail.subject}
                      {detail.topic && ` • ${detail.topic}`}
                    </CardDescription>
                  </div>
                  <Badge
                    variant={isCorrect ? "default" : "destructive"}
                    className="ml-2"
                  >
                    {isCorrect ? "Correct" : "Incorrect"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Question Text */}
                <div className="rounded-lg border bg-muted/50 p-4">
                  <QuestionDisplay html={detail.question_text} />
                </div>

                {/* Answer Choices */}
                <div className="space-y-2">
                  {detail.choices.map((choice) => {
                    const choiceLabel = choice.split(".")[0].trim()
                    const isUserAnswer =
                      detail.user_answers.includes(choiceLabel)
                    const isCorrectAnswer =
                      detail.correct_answers.includes(choiceLabel)

                    let bgColor = "bg-background"
                    let borderColor = "border-border"
                    let badgeVariant: "default" | "secondary" | "destructive" =
                      "secondary"
                    let badgeText = ""

                    if (isCorrectAnswer) {
                      bgColor = "bg-green-50"
                      borderColor = "border-green-500"
                      badgeVariant = "default"
                      badgeText = "Correct Answer"
                    }

                    if (isUserAnswer && !isCorrectAnswer) {
                      bgColor = "bg-red-50"
                      borderColor = "border-red-500"
                      badgeVariant = "destructive"
                      badgeText = "Your Answer (Incorrect)"
                    }

                    if (isUserAnswer && isCorrectAnswer) {
                      badgeText = "Your Answer (Correct)"
                    }

                    return (
                      <div
                        key={choice}
                        className={`flex items-center justify-between rounded-lg border p-3 ${bgColor} ${borderColor}`}
                      >
                        <span className="text-sm">{choice}</span>
                        {(isUserAnswer || isCorrectAnswer) && (
                          <Badge variant={badgeVariant} className="text-xs">
                            {badgeText}
                          </Badge>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Show correct answer if user got it wrong */}
                {!isCorrect && (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Correct Answer</AlertTitle>
                    <AlertDescription>
                      The correct answer
                      {detail.correct_answers.length > 1 ? "s are" : " is"}:{" "}
                      <span className="font-semibold">
                        {detail.correct_answers.join(", ")}
                      </span>
                      {detail.user_answers.length === 0 && (
                        <span className="block mt-1 text-muted-foreground">
                          You did not answer this question.
                        </span>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Bottom Action Buttons */}
      <div className="mt-8 flex justify-center">
        <Button size="lg" onClick={() => navigate({ to: "/quiz/start" })}>
          <Home className="mr-2 h-4 w-4" />
          Take Another Quiz
        </Button>
      </div>
    </div>
  )
}
