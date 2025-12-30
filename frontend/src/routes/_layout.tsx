import {
  createFileRoute,
  Outlet,
  redirect,
  useLocation,
} from "@tanstack/react-router"

import Navbar from "@/components/Common/Navbar"
import { RejoinGameBar } from "@/components/Common/RejoinGameBar"
import Sidebar from "@/components/Common/Sidebar"
import { Toaster } from "@/components/ui/sonner"
import { FeatureFlagsProvider } from "@/contexts/FeatureFlagsContext"
import { useActiveGame } from "@/hooks/useActiveGame"
import { isLoggedIn } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_layout")({
  component: Layout,
  beforeLoad: async () => {
    if (!isLoggedIn()) {
      throw redirect({
        to: "/login",
      })
    }
  },
})

function Layout() {
  const location = useLocation()
  const { activeGame } = useActiveGame()

  const isGamePlay = location.pathname.includes("/game/play/")
  const isOnActiveGamePlayPage =
    activeGame && location.pathname === `/game/play/${activeGame.id}`

  const showRejoinBar = activeGame && !isOnActiveGamePlayPage

  return (
    <FeatureFlagsProvider>
      <div className="flex flex-col h-screen">
        {showRejoinBar && (
          <RejoinGameBar
            gameId={activeGame.id}
            roomCode={activeGame.room_code}
            hostName={activeGame.host_name}
            guestName={activeGame.guest_name}
          />
        )}

        {!isGamePlay && <Navbar />}

        <div className="flex flex-1 overflow-hidden">
          {!isGamePlay && <Sidebar />}
          <div
            className={cn("flex-1 flex flex-col", {
              "p-4 overflow-y-auto": !isGamePlay,
            })}
          >
            <Outlet />
          </div>
        </div>

        <Toaster />
      </div>
    </FeatureFlagsProvider>
  )
}

export default Layout
