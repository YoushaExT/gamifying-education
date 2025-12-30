import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Loader2, Plus, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import {
  MultiplayerGameService,
  SubjectsService,
  TopicsService,
} from "@/client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { useActiveGame } from "@/hooks/useActiveGame"

export const Route = createFileRoute("/_layout/game/create")({
  component: CreateGamePage,
})

function CreateGamePage() {
  const navigate = useNavigate()
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([])
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const { activeGame } = useActiveGame()

  // Fetch subjects
  const { data: subjectsData } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => SubjectsService.readSubjects({}),
  })

  // Fetch topics
  const { data: topicsData } = useQuery({
    queryKey: ["topics"],
    queryFn: () => TopicsService.readTopics({}),
  })

  const createGameMutation = useMutation({
    mutationFn: (data: { subjects: string[]; topics?: string[] }) =>
      MultiplayerGameService.createGame({ requestBody: data }),
    onSuccess: (data) => {
      toast.success(`Game created! Room code: ${data.room_code}`)
      navigate({ to: `/game/lobby/${data.game_id}` })
    },
    onError: (error: any) => {
      toast.error(error.body?.detail || "Failed to create game")
    },
  })

  const handleSubjectToggle = (subject: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(subject)
        ? prev.filter((s) => s !== subject)
        : [...prev, subject],
    )
  }

  const handleTopicToggle = (topic: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic],
    )
  }

  const handleCreateGame = () => {
    if (selectedSubjects.length === 0) {
      toast.error("Please select at least one subject")
      return
    }

    if (activeGame) {
      toast.error(
        "You already have an active game. Please finish or forfeit it first.",
        {
          duration: 5000,
        },
      )
      return
    }

    createGameMutation.mutate({
      subjects: selectedSubjects,
      topics: selectedTopics.length > 0 ? selectedTopics : undefined,
    })
  }

  return (
    <div className="container max-w-4xl mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Create Multiplayer Game</CardTitle>
          <CardDescription>
            Select subjects and topics for your quiz. You'll get a room code to
            share with another player.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Subjects Selection */}
          <div>
            <Label className="text-lg mb-3 block">
              Select Subjects (Required)
            </Label>
            <div className="flex flex-wrap gap-2">
              {subjectsData?.data.map((subject) => (
                <Button
                  key={subject.id}
                  variant={
                    selectedSubjects.includes(subject.name)
                      ? "default"
                      : "outline"
                  }
                  onClick={() => handleSubjectToggle(subject.name)}
                  className="gap-2"
                >
                  {subject.name}
                  {selectedSubjects.includes(subject.name) && (
                    <X className="h-4 w-4" />
                  )}
                </Button>
              ))}
            </div>
            {selectedSubjects.length > 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                {selectedSubjects.length} subject(s) selected
              </p>
            )}
          </div>

          {/* Topics Selection */}
          <div>
            <Label className="text-lg mb-3 block">
              Select Topics (Optional)
            </Label>
            <div className="flex flex-wrap gap-2">
              {topicsData?.data.map((topic) => (
                <Button
                  key={topic.id}
                  variant={
                    selectedTopics.includes(topic.name) ? "default" : "outline"
                  }
                  onClick={() => handleTopicToggle(topic.name)}
                  className="gap-2"
                  size="sm"
                >
                  {topic.name}
                  {selectedTopics.includes(topic.name) && (
                    <X className="h-4 w-4" />
                  )}
                </Button>
              ))}
            </div>
            {selectedTopics.length > 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                {selectedTopics.length} topic(s) selected
              </p>
            )}
          </div>

          {/* Info */}
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <p className="text-sm font-medium">Game Format:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• 5 multiple choice questions</li>
              <li>• 30 seconds per question</li>
              <li>• Both players answer the same questions</li>
              <li>• See results after each question</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={handleCreateGame}
              disabled={
                selectedSubjects.length === 0 || createGameMutation.isPending
              }
              className="flex-1"
              size="lg"
            >
              {createGameMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-5 w-5" />
                  Create Game
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/" })}
              size="lg"
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
