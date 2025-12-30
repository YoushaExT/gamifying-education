import { useQueryClient } from "@tanstack/react-query"
import { LogOut, Menu } from "lucide-react"
import { useState } from "react"

import type { UserPublic } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import useAuth from "@/hooks/useAuth"
import SidebarItems from "./SidebarItems"

const Sidebar = () => {
  const queryClient = useQueryClient()
  const currentUser = queryClient.getQueryData<UserPublic>(["currentUser"])
  const { logout } = useAuth()
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Mobile */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden absolute z-50 m-4"
            aria-label="Open Menu"
          >
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col justify-between h-full pt-4">
            <div>
              <SidebarItems onClose={() => setOpen(false)} />
              <button
                type="button"
                onClick={() => {
                  logout()
                }}
                className="flex items-center gap-4 px-4 py-2 w-full hover:bg-accent rounded-md"
              >
                <LogOut className="size-4" />
                <span>Log Out</span>
              </button>
            </div>
            {currentUser?.email && (
              <p className="text-sm p-2 truncate max-w-sm text-muted-foreground">
                Logged in as: {currentUser.email}
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop */}
      <div className="hidden md:flex sticky top-0 bg-muted min-w-72 h-screen p-4">
        <div className="w-full">
          <SidebarItems />
        </div>
      </div>
    </>
  )
}

export default Sidebar
