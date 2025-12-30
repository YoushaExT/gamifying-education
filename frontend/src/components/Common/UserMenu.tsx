import { Link } from "@tanstack/react-router"
import { LogOut, User, UserCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import useAuth from "@/hooks/useAuth"

const UserMenu = () => {
  const { user, logout } = useAuth()

  const handleLogout = async () => {
    logout()
  }

  return (
    <div className="flex">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            data-testid="user-menu"
            variant="default"
            className="max-w-sm truncate"
          >
            <UserCircle className="size-5" />
            <span>{user?.full_name || "User"}</span>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <Link to="/settings">
            <DropdownMenuItem className="cursor-pointer gap-2">
              <User className="size-4" />
              <span>My Profile</span>
            </DropdownMenuItem>
          </Link>

          <DropdownMenuItem
            onClick={handleLogout}
            className="cursor-pointer gap-2"
          >
            <LogOut className="size-4" />
            <span>Log Out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export default UserMenu
