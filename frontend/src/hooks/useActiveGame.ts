import { useQuery } from "@tanstack/react-query"
import type { CardGameSessionWithPlayers } from "@/client"
import { MultiplayerGameService } from "@/client"

interface UseActiveGameReturn {
  activeGame: CardGameSessionWithPlayers | null | undefined
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

/**
 * Hook to fetch user's active game (in_progress status).
 * Polls every 10 seconds to detect when user starts/ends a game.
 * Used by RejoinGameBar to show rejoin prompt.
 */
export function useActiveGame(): UseActiveGameReturn {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["activeGame"],
    queryFn: async () => {
      try {
        const result = await MultiplayerGameService.getActiveGame()
        return result
      } catch (err) {
        // If endpoint returns error, treat as no active game
        console.error("Failed to fetch active game:", err)
        return null
      }
    },
    // Poll every 10 seconds to detect game status changes
    refetchInterval: 10000,
    // Keep previous data while refetching (prevents flicker)
    placeholderData: (previousData) => previousData,
    // Retry on failure but don't show error (silent failure)
    retry: 1,
    retryDelay: 2000,
  })

  return {
    activeGame: data,
    isLoading,
    error: error as Error | null,
    refetch,
  }
}
