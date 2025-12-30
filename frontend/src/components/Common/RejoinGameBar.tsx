import { useNavigate } from "@tanstack/react-router"
import { AlertCircle, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface RejoinGameBarProps {
  gameId: string
  roomCode: string
  hostName?: string | null
  guestName?: string | null
}

/**
 * Warning bar shown when user has an active game but is not on the play page.
 * Sticky at top of screen with high z-index (above navbar).
 */
export function RejoinGameBar({
  gameId,
  roomCode,
  hostName,
  guestName,
}: RejoinGameBarProps) {
  const navigate = useNavigate()

  const handleRejoin = () => {
    navigate({ to: `/game/play/${gameId}` })
  }

  return (
    <div className="sticky top-0 z-[60] w-full bg-yellow-500 text-yellow-950 px-4 py-3 shadow-md">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
            <span className="font-semibold">You have an active game!</span>
            <span className="text-sm">
              Room: {roomCode} • Players: {hostName || "Unknown"} vs{" "}
              {guestName || "Waiting"}
            </span>
          </div>
        </div>
        <Button
          onClick={handleRejoin}
          variant="secondary"
          size="sm"
          className="flex items-center gap-2 bg-yellow-950 text-yellow-50 hover:bg-yellow-900"
        >
          Rejoin Game
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
