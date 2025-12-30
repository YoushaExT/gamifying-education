import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Heart, Home, RotateCcw, Shield, Swords, Trophy } from "lucide-react"

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

export const Route = createFileRoute("/_layout/game/results/$gameId")({
  component: GameResultsPage,
})

function GameResultsPage() {
  const { gameId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentUser = queryClient.getQueryData<UserPublic>(["currentUser"])

  // Fetch game results
  const { data: results, isLoading } = useQuery({
    queryKey: ["gameResults", gameId],
    queryFn: () => MultiplayerGameService.getGameResults({ gameId }),
  })

  if (isLoading) {
    return (
      <div className="container max-w-4xl mx-auto py-8">
        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="p-8 text-center">
            <p className="text-slate-300">Loading results...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!results) {
    return (
      <div className="container max-w-4xl mx-auto py-8">
        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="p-8 text-center">
            <p className="text-slate-300">Results not found</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Determine if current user won
  const isHost = currentUser?.id === results.host?.id
  const myData = isHost ? results.host : results.guest
  const opponentData = isHost ? results.guest : results.host

  const iWon = results.winner === (isHost ? "host" : "guest")
  const opponentWon =
    results.winner && results.winner !== (isHost ? "host" : "guest")
  const isGameOver = results.status === "completed"

  return (
    <div className="min-h-screen bg-slate-950 py-8">
      <div className="container max-w-4xl mx-auto">
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              {iWon ? (
                <div className="p-4 bg-amber-500/20 rounded-full animate-pulse">
                  <Trophy className="h-16 w-16 text-amber-500" />
                </div>
              ) : opponentWon ? (
                <div className="p-4 bg-red-500/20 rounded-full">
                  <Swords className="h-16 w-16 text-red-500" />
                </div>
              ) : (
                <div className="p-4 bg-blue-500/20 rounded-full">
                  <Trophy className="h-16 w-16 text-blue-500" />
                </div>
              )}
            </div>
            <CardTitle className="text-4xl text-white">
              {iWon
                ? "🎉 Victory!"
                : opponentWon
                  ? "Defeated"
                  : isGameOver
                    ? "Game Over"
                    : "Game in Progress"}
            </CardTitle>
            <CardDescription className="text-lg text-slate-400">
              {isGameOver
                ? `Battle lasted ${results.total_turns} turns`
                : "The battle continues..."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Final Stats */}
            <div className="grid grid-cols-2 gap-6">
              {/* My Stats */}
              <div
                className={`p-6 rounded-lg ${
                  iWon
                    ? "bg-amber-500/10 border-2 border-amber-500"
                    : "bg-slate-800"
                }`}
              >
                <p className="text-sm text-slate-400 mb-2">
                  {iWon ? "👑 Winner" : "You"}
                </p>
                <p className="text-2xl font-bold mb-4 text-white">
                  {myData?.name}
                </p>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Heart className="h-5 w-5 text-red-500" />
                    <div className="flex-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Health</span>
                        <span className="text-white font-medium">
                          {myData?.health ?? 0} / 30
                        </span>
                      </div>
                      <div className="mt-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-500 transition-all"
                          style={{
                            width: `${((myData?.health ?? 0) / 30) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-blue-500" />
                    <div className="flex-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Shield</span>
                        <span className="text-white font-medium">
                          {myData?.shield ?? 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Opponent Stats */}
              {opponentData && (
                <div
                  className={`p-6 rounded-lg ${
                    opponentWon
                      ? "bg-amber-500/10 border-2 border-amber-500"
                      : "bg-slate-800"
                  }`}
                >
                  <p className="text-sm text-slate-400 mb-2">
                    {opponentWon ? "👑 Winner" : "Opponent"}
                  </p>
                  <p className="text-2xl font-bold mb-4 text-white">
                    {opponentData.name}
                  </p>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Heart className="h-5 w-5 text-red-500" />
                      <div className="flex-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Health</span>
                          <span className="text-white font-medium">
                            {opponentData.health} / 30
                          </span>
                        </div>
                        <div className="mt-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-500 transition-all"
                            style={{
                              width: `${(opponentData.health / 30) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-blue-500" />
                      <div className="flex-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Shield</span>
                          <span className="text-white font-medium">
                            {opponentData.shield}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Game Summary */}
            <div className="p-4 rounded-lg bg-slate-800">
              <h3 className="font-semibold text-lg mb-3 text-white">
                Game Summary
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-400">Total Turns</p>
                  <p className="text-xl font-bold text-white">
                    {results.total_turns}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Game Status</p>
                  <p className="text-xl font-bold text-white capitalize">
                    {results.status}
                  </p>
                </div>
              </div>
            </div>

            {/* Victory Message */}
            {isGameOver && (
              <div
                className={`p-4 rounded-lg text-center ${
                  iWon ? "bg-amber-500/10" : "bg-slate-800"
                }`}
              >
                <p className="text-lg text-slate-300">
                  {results.end_reason === "forfeit"
                    ? iWon
                      ? "Your opponent forfeited. Victory by default!"
                      : "You forfeited the match."
                    : iWon
                      ? "Congratulations! Your knowledge and strategy prevailed!"
                      : "Good game! Study up and try again!"}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => navigate({ to: "/game/create" })}
                className="flex-1 bg-amber-600 hover:bg-amber-700"
                size="lg"
              >
                <RotateCcw className="mr-2 h-5 w-5" />
                Play Again
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate({ to: "/" })}
                className="flex-1 border-slate-600 hover:bg-slate-800"
                size="lg"
              >
                <Home className="mr-2 h-5 w-5" />
                Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
