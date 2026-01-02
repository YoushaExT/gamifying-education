import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Calendar, Heart, Swords, Trophy, User } from "lucide-react"
import { useState } from "react"

import { MultiplayerGameService } from "@/client"
import { OutcomeBadge } from "@/components/Game"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const Route = createFileRoute("/_layout/game/history")({
  component: GameHistoryPage,
})

function GameHistoryPage() {
  const [page, setPage] = useState(0)
  const limit = 20

  const { data, isLoading, error } = useQuery({
    queryKey: ["gameHistory", page],
    queryFn: () =>
      MultiplayerGameService.getGameHistory({
        skip: page * limit,
        limit,
      }),
  })

  // Calculate total pages
  const totalPages = data?.total ? Math.ceil(data.total / limit) : 0

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">My Game History</h1>
        <p className="text-muted-foreground">
          View your past multiplayer card combat games
        </p>
      </div>

      {isLoading && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading game history...</p>
        </div>
      )}

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">
              Failed to load game history. Please try again.
            </p>
          </CardContent>
        </Card>
      )}

      {data && data.games.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center">
            <Trophy className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No games played yet</p>
            <p className="text-muted-foreground mb-4">
              Start a game to see your history here!
            </p>
            <Button
              onClick={() => {
                window.location.href = "/game/create"
              }}
            >
              <Swords className="mr-2 h-4 w-4" />
              Play Now
            </Button>
          </CardContent>
        </Card>
      )}

      {data && data.games.length > 0 && (
        <>
          {/* Game Cards Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
            {data.games.map((game) => (
              <Card
                key={game.game_id}
                className="hover:shadow-lg transition-shadow"
              >
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <CardTitle className="text-lg">
                      vs {game.opponent_name}
                    </CardTitle>
                    <OutcomeBadge
                      outcome={
                        game.outcome as
                          | "won"
                          | "lost"
                          | "abandoned"
                          | "forced_ended"
                      }
                    />
                  </div>
                  <CardDescription className="flex items-center gap-2">
                    <Calendar className="h-3 w-3" />
                    {game.completed_at
                      ? new Date(game.completed_at).toLocaleDateString(
                          undefined,
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          },
                        )
                      : "Date Unknown"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Final Score */}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" />
                      <span className="font-medium">You</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <Heart className="h-4 w-4 text-red-500" />
                        <span className="font-mono">
                          {game.user_final_health}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {game.opponent_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <Heart className="h-4 w-4 text-red-500" />
                        <span className="font-mono">
                          {game.opponent_final_health}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Game Details */}
                  <div className="pt-3 border-t text-xs text-muted-foreground space-y-1">
                    <div className="flex items-center justify-between">
                      <span>Duration:</span>
                      <span className="font-medium">
                        {game.duration_minutes
                          ? `${game.duration_minutes} min`
                          : "N/A"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Total Turns:</span>
                      <span className="font-medium">{game.total_turns}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Room Code:</span>
                      <span className="font-mono font-medium">
                        {game.room_code}
                      </span>
                    </div>
                  </div>

                  {/* View Details Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => {
                      window.location.href = `/game/results/${game.game_id}`
                    }}
                  >
                    View Details
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground px-4">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
