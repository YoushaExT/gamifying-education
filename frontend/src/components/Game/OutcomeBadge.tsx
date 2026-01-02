import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface OutcomeBadgeProps {
  outcome: "won" | "lost" | "abandoned" | "forced_ended"
  className?: string
}

export function OutcomeBadge({ outcome, className }: OutcomeBadgeProps) {
  const config = {
    won: {
      label: "Victory",
      className: "bg-green-600 hover:bg-green-700 text-white",
    },
    lost: {
      label: "Defeat",
      className: "bg-red-600 hover:bg-red-700 text-white",
    },
    abandoned: {
      label: "Abandoned",
      className: "bg-gray-500 hover:bg-gray-600 text-white",
    },
    forced_ended: {
      label: "Admin Ended",
      className: "bg-orange-600 hover:bg-orange-700 text-white",
    },
  }

  const { label, className: badgeClassName } = config[outcome]

  return (
    <Badge className={cn(badgeClassName, className)} variant="default">
      {label}
    </Badge>
  )
}
