import { useQueryClient } from "@tanstack/react-query"
import { Link as RouterLink } from "@tanstack/react-router"
import type { LucideIcon } from "lucide-react"
import {
  ClipboardList,
  Gamepad2,
  HelpCircle,
  Home,
  Settings,
  Shield,
  Sparkles,
} from "lucide-react"

import type { UserPublic } from "@/client"
import { useFeatureFlag } from "@/contexts/FeatureFlagsContext"

const items = [
  { icon: Home, title: "Dashboard", path: "/" },
  { icon: Gamepad2, title: "Game", path: "/game" },
  { icon: Settings, title: "User Settings", path: "/settings" },
]

interface SidebarItemsProps {
  onClose?: () => void
}

interface Item {
  icon: LucideIcon
  title: string
  path: string
}

const SidebarItems = ({ onClose }: SidebarItemsProps) => {
  const queryClient = useQueryClient()
  const currentUser = queryClient.getQueryData<UserPublic>(["currentUser"])
  const aiGenerateEnabled = useFeatureFlag("ai_question_generation")
  const quizSystemEnabled = useFeatureFlag("quiz_system")

  // Add quiz link if feature is enabled
  const userItems = quizSystemEnabled
    ? [
        ...items,
        { icon: ClipboardList, title: "Take Quiz", path: "/quiz/start" },
      ]
    : items

  const finalItems: Item[] = userItems

  const adminItems: Item[] = []
  if (currentUser?.is_teacher || currentUser?.is_superuser) {
    adminItems.push({
      icon: HelpCircle,
      title: "Questions",
      path: "/admin/questions",
    })

    // Only show AI Generate if feature flag is enabled
    if (aiGenerateEnabled) {
      adminItems.push({
        icon: Sparkles,
        title: "AI Generate",
        path: "/admin/ai-generate",
      })
    }
  }

  // Feature Flags - only for superusers
  if (currentUser?.is_superuser) {
    adminItems.push({
      icon: Shield,
      title: "Feature Flags",
      path: "/admin/feature-flags",
    })
  }

  const listItems = finalItems.map(({ icon: Icon, title, path }) => (
    <RouterLink key={title} to={path} onClick={onClose}>
      <div className="flex gap-4 px-4 py-2 hover:bg-accent rounded-md items-center text-sm">
        <Icon className="size-4" />
        <span className="ml-2">{title}</span>
      </div>
    </RouterLink>
  ))

  const adminListItems = adminItems.map(({ icon: Icon, title, path }) => (
    <RouterLink key={title} to={path} onClick={onClose}>
      <div className="flex gap-4 px-4 py-2 hover:bg-accent rounded-md items-center text-sm">
        <Icon className="size-4" />
        <span className="ml-2">{title}</span>
      </div>
    </RouterLink>
  ))

  return (
    <>
      <p className="text-xs px-4 py-2 font-bold text-muted-foreground">Menu</p>
      <div>{listItems}</div>
      {adminItems.length > 0 && (
        <>
          <p className="text-xs px-4 py-2 font-bold text-muted-foreground mt-4">
            Admin
          </p>
          <div>{adminListItems}</div>
        </>
      )}
    </>
  )
}

export default SidebarItems
