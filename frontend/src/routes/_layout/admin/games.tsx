import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  Heart,
  Loader2,
  RefreshCw,
  Shield,
  Trash2,
  Users,
  Zap,
} from "lucide-react"
import { toast } from "sonner"

import { AdminService } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useConfirm } from "@/hooks/useConfirm"

export const Route = createFileRoute("/_layout/admin/games")({
  component: AdminGamesPage,
})

function AdminGamesPage() {
  const { confirm } = useConfirm()
  const queryClient = useQueryClient()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "activeGames"],
    queryFn: () => AdminService.getActiveGames({}),
    refetchInterval: 10000, // Auto-refresh every 10s
  })

  const forceCompleteMutation = useMutation({
    mutationFn: (gameId: string) => AdminService.forceCompleteGame({ gameId }),
    onSuccess: () => {
      toast.success("Game force-completed successfully")
      queryClient.invalidateQueries({ queryKey: ["admin", "activeGames"] })
    },
    onError: (error: any) => {
      toast.error(error.body?.detail || "Failed to force complete game")
    },
  })

  const cleanupMutation = useMutation({
    mutationFn: () => AdminService.cleanupAbandonedGames({}),
    onSuccess: (data: any) => {
      toast.success(`Cleaned up ${data.count} abandoned games`)
      queryClient.invalidateQueries({ queryKey: ["admin", "activeGames"] })
    },
    onError: (error: any) => {
      toast.error(error.body?.detail || "Failed to cleanup abandoned games")
    },
  })

  const handleForceComplete = async (gameId: string, roomCode: string) => {
    const confirmed = await confirm({
      title: `Force Complete Game ${roomCode}?`,
      description:
        "This will immediately end the game with no winner. Players will be notified if still connected.",
      variant: "destructive",
    })

    if (confirmed) {
      forceCompleteMutation.mutate(gameId)
    }
  }

  const handleCleanup = async () => {
    const confirmed = await confirm({
      title: "Cleanup Abandoned Games?",
      description:
        "This will mark all games inactive for more than 1 hour as completed. This action cannot be undone.",
      variant: "default",
    })

    if (confirmed) {
      cleanupMutation.mutate()
    }
  }

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return "N/A"
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  return (
    <div className="container max-w-7xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Active Games Management</h1>
          <p className="text-muted-foreground">
            View and manage currently active multiplayer games
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button
            variant="destructive"
            onClick={handleCleanup}
            disabled={cleanupMutation.isPending}
          >
            {cleanupMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Cleanup Abandoned
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive mb-6">
          <CardContent className="pt-6">
            <p className="text-destructive">
              Failed to load active games. Please try again.
            </p>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <Card>
          <CardContent className="pt-6 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Loading active games...</p>
          </CardContent>
        </Card>
      )}

      {data && data.games.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No active games</p>
            <p className="text-muted-foreground">
              All games are currently idle or completed.
            </p>
          </CardContent>
        </Card>
      )}

      {data && data.games.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Games ({data.total})</CardTitle>
            <CardDescription>
              Games currently in progress. Auto-refreshes every 10 seconds.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Room Code</TableHead>
                    <TableHead>Host</TableHead>
                    <TableHead>Guest</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Turn</TableHead>
                    <TableHead>Deck</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.games.map((game) => (
                    <TableRow key={game.game_id}>
                      <TableCell className="font-mono font-medium">
                        {game.room_code}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{game.host.name}</div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Heart className="h-3 w-3 text-red-500" />
                              <span>{game.host.health}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Shield className="h-3 w-3 text-blue-500" />
                              <span>{game.host.shield}</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {game.guest ? (
                          <div className="space-y-1">
                            <div className="font-medium">{game.guest.name}</div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Heart className="h-3 w-3 text-red-500" />
                                <span>{game.guest.health}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Shield className="h-3 w-3 text-blue-500" />
                                <span>{game.guest.shield}</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">
                            Waiting...
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDuration(game.duration_minutes)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="space-y-1">
                          <div>Turn {game.turn_number}</div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Zap className="h-3 w-3" />
                            <span className="capitalize">
                              {game.current_turn}'s turn
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {game.deck_count} cards
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            handleForceComplete(game.game_id, game.room_code)
                          }
                          disabled={forceCompleteMutation.isPending}
                        >
                          {forceCompleteMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Force End"
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
