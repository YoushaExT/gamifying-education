import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { ClipboardList, Clock, PlayCircle } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"
import { QuizzesService, SubjectsService, TopicsService } from "@/client"
import type {
  QuizAttemptPublic,
  QuizCreate,
  SubjectPublic,
  TopicPublic,
} from "@/client/types.gen"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useFeatureFlag } from "@/contexts/FeatureFlagsContext"

export const Route = createFileRoute("/_layout/quiz/start")({
  component: QuizStartPage,
})

function QuizStartPage() {
  const navigate = useNavigate()
  const numQuestionsId = useId()
  const timedId = useId()
  const timeLimitId = useId()
  const quizTimerEnabled = useFeatureFlag("quiz_timer")

  // Form state
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([])
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [numQuestions, setNumQuestions] = useState(5)
  const [isTimed, setIsTimed] = useState(false)
  const [timeLimit, setTimeLimit] = useState(300) // 5 minutes default

  // Fetch subjects and topics
  const { data: subjectsData } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => SubjectsService.readSubjects({}),
  })

  const { data: topicsData } = useQuery({
    queryKey: ["topics"],
    queryFn: () => TopicsService.readTopics({}),
  })

  const subjects = (subjectsData?.data || []) as SubjectPublic[]
  const topics = (topicsData?.data || []) as TopicPublic[]

  // Note: Topics are not filtered by subject in this version
  // All topics are shown regardless of selected subjects
  const filteredTopics = topics

  // Start quiz mutation
  const startQuizMutation = useMutation({
    mutationFn: (quizData: QuizCreate) =>
      QuizzesService.startQuiz({ requestBody: quizData }),
    onSuccess: (data: QuizAttemptPublic) => {
      toast.success("Quiz started successfully!")
      navigate({ to: `/quiz/take/${data.id}` })
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to start quiz")
    },
  })

  const handleSubjectToggle = (subjectName: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(subjectName)
        ? prev.filter((s) => s !== subjectName)
        : [...prev, subjectName],
    )
  }

  const handleTopicToggle = (topicName: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topicName)
        ? prev.filter((t) => t !== topicName)
        : [...prev, topicName],
    )
  }

  const handleSelectAllSubjects = () => {
    if (selectedSubjects.length === subjects.length) {
      setSelectedSubjects([])
    } else {
      setSelectedSubjects(subjects.map((s: SubjectPublic) => s.name))
    }
  }

  const handleStartQuiz = () => {
    if (selectedSubjects.length === 0) {
      toast.error("Please select at least one subject")
      return
    }

    const quizData: QuizCreate = {
      subjects: selectedSubjects,
      topics: selectedTopics.length > 0 ? selectedTopics : undefined,
      num_questions: numQuestions,
      is_timed: isTimed,
      time_limit: isTimed ? timeLimit : undefined,
    }

    startQuizMutation.mutate(quizData)
  }

  return (
    <div className="container mx-auto max-w-4xl py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-6 w-6" />
            Start a New Quiz
          </CardTitle>
          <CardDescription>
            Configure your quiz settings and select subjects/topics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Subjects Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Select Subjects</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAllSubjects}
              >
                {selectedSubjects.length === subjects.length
                  ? "Deselect All"
                  : "Select All"}
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {subjects.map((subject: SubjectPublic) => (
                <div
                  key={subject.id}
                  className="flex items-center space-x-2 border rounded-md p-3 hover:bg-accent"
                >
                  <Checkbox
                    id={`subject-${subject.id}`}
                    checked={selectedSubjects.includes(subject.name)}
                    onCheckedChange={() => handleSubjectToggle(subject.name)}
                  />
                  <Label
                    htmlFor={`subject-${subject.id}`}
                    className="cursor-pointer flex-1"
                  >
                    {subject.name}
                  </Label>
                </div>
              ))}
            </div>
            {subjects.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No subjects available
              </p>
            )}
          </div>

          {/* Topics Selection (Optional) */}
          {selectedSubjects.length > 0 && filteredTopics.length > 0 && (
            <div className="space-y-4">
              <Label className="text-base font-semibold">
                Select Topics (Optional)
              </Label>
              <p className="text-sm text-muted-foreground">
                Leave empty to include all topics from selected subjects
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {filteredTopics.map((topic: TopicPublic) => (
                  <div
                    key={topic.id}
                    className="flex items-center space-x-2 border rounded-md p-3 hover:bg-accent"
                  >
                    <Checkbox
                      id={`topic-${topic.id}`}
                      checked={selectedTopics.includes(topic.name)}
                      onCheckedChange={() => handleTopicToggle(topic.name)}
                    />
                    <Label
                      htmlFor={`topic-${topic.id}`}
                      className="cursor-pointer flex-1 text-sm"
                    >
                      {topic.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Number of Questions */}
          <div className="space-y-2">
            <Label htmlFor={numQuestionsId} className="text-base font-semibold">
              Number of Questions
            </Label>
            <Input
              id={numQuestionsId}
              type="number"
              min={1}
              max={50}
              value={numQuestions}
              onChange={(e) =>
                setNumQuestions(parseInt(e.target.value, 10) || 5)
              }
              className="max-w-xs"
            />
            <p className="text-sm text-muted-foreground">
              Choose between 1 and 50 questions
            </p>
          </div>

          {/* Timer Settings - Only show if feature is enabled */}
          {quizTimerEnabled && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id={timedId}
                  checked={isTimed}
                  onCheckedChange={setIsTimed}
                />
                <Label
                  htmlFor={timedId}
                  className="text-base font-semibold cursor-pointer"
                >
                  Enable Timer
                </Label>
              </div>

              {isTimed && (
                <div className="space-y-2 pl-6">
                  <Label
                    htmlFor={timeLimitId}
                    className="flex items-center gap-2"
                  >
                    <Clock className="h-4 w-4" />
                    Time Limit (seconds)
                  </Label>
                  <Input
                    id={timeLimitId}
                    type="number"
                    min={60}
                    max={3600}
                    value={timeLimit}
                    onChange={(e) =>
                      setTimeLimit(parseInt(e.target.value, 10) || 300)
                    }
                    className="max-w-xs"
                  />
                  <p className="text-sm text-muted-foreground">
                    {Math.floor(timeLimit / 60)} minutes {timeLimit % 60}{" "}
                    seconds
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Start Button */}
          <div className="flex justify-end pt-4">
            <Button
              onClick={handleStartQuiz}
              disabled={
                selectedSubjects.length === 0 || startQuizMutation.isPending
              }
              className="min-w-[150px]"
            >
              {startQuizMutation.isPending ? (
                "Starting..."
              ) : (
                <>
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Start Quiz
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
