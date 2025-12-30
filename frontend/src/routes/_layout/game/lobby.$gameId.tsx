import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Check, Copy, Loader2, User, Users } from "lucide-react"
import { useCallback, useState } from "react"
import { toast } from "sonner"

import type { UserPublic } from "@/client"
import { MultiplayerGameService } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useGameWebSocket } from "@/hooks/useGameWebSocket"

export const Route = createFileRoute("/_layout/game/lobby/$gameId")({
  component: GameLobbyPage,
})

function GameLobbyPage() {
  const { gameId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentUser = queryClient.getQueryData<UserPublic>(["currentUser"])
  const [copied, setCopied] = useState(false)
  const [isReady, setIsReady] = useState(false)

  // Fetch game details
  const { data: gameData } = useQuery({
    queryKey: ["game", gameId],
    queryFn: () => MultiplayerGameService.getGame({ gameId }),
  })

  // Memoize callbacks to prevent re-renders
  const handleGameStart = useCallback(() => {
    toast.success("Game starting!")
    navigate({ to: `/game/play/${gameId}` })
  }, [navigate, gameId])

  // WebSocket connection
  const { isConnected, gameState, sendReady } = useGameWebSocket({
    gameId,
    onGameStart: handleGameStart,
  })

  const isHost = currentUser?.id === gameState?.host_id

  const copyRoomCode = () => {
    if (gameData?.room_code) {
      navigator.clipboard.writeText(gameData.room_code)
      setCopied(true)
      toast.success("Room code copied!")
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleReady = () => {
    sendReady()
    setIsReady(true)
    toast.success("Marked as ready!")
  }

  const bothPlayersPresent = gameState?.guest_id !== null
  const bothReady = gameState?.host_ready && gameState?.guest_ready

  return (
    <div className="container max-w-3xl mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Game Lobby</CardTitle>
          <CardDescription>
            Waiting for players to join and get ready
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Room Code */}
          <div className="bg-primary/10 p-6 rounded-lg text-center">
            <p className="text-sm text-muted-foreground mb-2">Room Code</p>
            <div className="flex items-center justify-center gap-3">
              <p className="text-4xl font-bold tracking-wider">
                {gameData?.room_code || "------"}
              </p>
              <Button
                variant="outline"
                size="icon"
                onClick={copyRoomCode}
                disabled={!gameData?.room_code}
              >
                {copied ? (
                  <Check className="h-5 w-5 text-green-600" />
                ) : (
                  <Copy className="h-5 w-5" />
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Share this code with another player
            </p>
          </div>

          {/* Connection Status */}
          <div className="flex items-center justify-center gap-2">
            {isConnected ? (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm text-muted-foreground">Connected</span>
              </>
            ) : (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Connecting...
                </span>
              </>
            )}
          </div>

          {/* Players */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Users className="h-5 w-5" />
              Players ({bothPlayersPresent ? "2" : "1"}/2)
            </h3>

            {/* Host */}
            <div
              className={`p-4 rounded-lg border-2 ${
                gameState?.host_ready
                  ? "border-green-500 bg-green-500/10"
                  : "border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-full ${
                      gameState?.host_ready ? "bg-green-500" : "bg-muted"
                    }`}
                  >
                    <User className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {gameState?.host_name || "Host"}
                      {isHost && " (You)"}
                    </p>
                    <p className="text-sm text-muted-foreground">Host</p>
                  </div>
                </div>
                {gameState?.host_ready && (
                  <div className="flex items-center gap-2 text-green-600">
                    <Check className="h-5 w-5" />
                    <span className="text-sm font-medium">Ready</span>
                  </div>
                )}
              </div>
            </div>

            {/* Guest */}
            <div
              className={`p-4 rounded-lg border-2 ${
                gameState?.guest_ready
                  ? "border-green-500 bg-green-500/10"
                  : "border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-full ${
                      bothPlayersPresent
                        ? gameState?.guest_ready
                          ? "bg-green-500"
                          : "bg-muted"
                        : "bg-muted/50"
                    }`}
                  >
                    <User className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {gameState?.guest_name
                        ? `${gameState.guest_name}${!isHost ? " (You)" : ""}`
                        : "Waiting..."}
                    </p>
                    <p className="text-sm text-muted-foreground">Guest</p>
                  </div>
                </div>
                {gameState?.guest_ready && (
                  <div className="flex items-center gap-2 text-green-600">
                    <Check className="h-5 w-5" />
                    <span className="text-sm font-medium">Ready</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Game Info */}
          {gameData && (
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="text-sm font-medium">Game Configuration:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Subjects: {gameData.subjects?.join(", ")}</li>
                {gameData.topics && gameData.topics.length > 0 && (
                  <li>• Topics: {gameData.topics.join(", ")}</li>
                )}
                <li>• Health: 30 HP each</li>
                <li>• Starting Cards: 3</li>
              </ul>
            </div>
          )}

          {/* Ready Button */}
          <div className="space-y-3">
            {!bothPlayersPresent && (
              <p className="text-center text-sm text-muted-foreground">
                Waiting for second player to join...
              </p>
            )}

            {bothPlayersPresent && !bothReady && (
              <Button
                onClick={handleReady}
                disabled={
                  isReady ||
                  (isHost ? gameState?.host_ready : gameState?.guest_ready) ||
                  false
                }
                className="w-full"
                size="lg"
              >
                {isReady ||
                (isHost ? gameState?.host_ready : gameState?.guest_ready) ? (
                  <>
                    <Check className="mr-2 h-5 w-5" />
                    Ready!
                  </>
                ) : (
                  "I'm Ready"
                )}
              </Button>
            )}

            {bothReady && (
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <p className="text-lg font-medium">Starting game...</p>
                </div>
              </div>
            )}

            <Button
              variant="outline"
              onClick={() => navigate({ to: "/" })}
              className="w-full"
            >
              Leave Lobby
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
