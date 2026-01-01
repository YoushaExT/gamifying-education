import { useMutation } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { Plus, Users } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"

import { MultiplayerGameService } from "@/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Container } from "@/components/ui/container"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useActiveGame } from "@/hooks/useActiveGame"

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
})

function Dashboard() {
  const navigate = useNavigate()
  const [roomCode, setRoomCode] = useState("")
  const roomCodeInputId = useId()
  const { activeGame } = useActiveGame()

  const joinGameMutation = useMutation({
    mutationFn: (code: string) =>
      MultiplayerGameService.joinGame({ roomCode: code }),
    onSuccess: (data) => {
      toast.success("Joined game!")
      navigate({ to: `/game/lobby/${data.game_id}` })
    },
    onError: (error: any) => {
      toast.error(error.body?.detail || "Failed to join game")
    },
  })

  const handleJoinGame = () => {
    if (!roomCode || roomCode.length !== 6) {
      toast.error("Please enter a valid 6-character room code")
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

    joinGameMutation.mutate(roomCode.toUpperCase())
  }

  return (
    <Container maxW="full">
      <div className="pt-12 px-4 space-y-6">
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold">Gamifying Education</h1>
            <h1 className="text-4xl font-bold">Pipeline version test: 1.02</h1>
            <p className="text-muted-foreground text-lg">
              Challenge a friend in a multiplayer quiz battle
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
            {/* Create Game */}
            <Link to="/game/create" className="block">
              <Card className="h-full hover:border-primary transition-colors cursor-pointer">
                <CardContent className="p-6 text-center space-y-4">
                  <div className="flex justify-center">
                    <div className="p-4 bg-primary/10 rounded-full">
                      <Plus className="h-8 w-8 text-primary" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Create Game</h3>
                    <p className="text-sm text-muted-foreground">
                      Start a new game and invite a friend
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Join Game */}
            <Card className="h-full">
              <CardContent className="p-6 space-y-4">
                <div className="flex justify-center">
                  <div className="p-4 bg-secondary/10 rounded-full">
                    <Users className="h-8 w-8 text-secondary" />
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-semibold mb-2">Join Game</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Enter a room code to join
                  </p>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor={roomCodeInputId} className="mb-3">
                      Room Code
                    </Label>
                    <Input
                      id={roomCodeInputId}
                      placeholder="ABC123"
                      value={roomCode}
                      onChange={(e) =>
                        setRoomCode(e.target.value.toUpperCase())
                      }
                      maxLength={6}
                      className="text-center text-lg tracking-wider font-mono"
                    />
                  </div>
                  <Button
                    onClick={handleJoinGame}
                    disabled={
                      roomCode.length !== 6 || joinGameMutation.isPending
                    }
                    className="w-full"
                  >
                    {joinGameMutation.isPending ? "Joining..." : "Join Game"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Container>
  )
}
