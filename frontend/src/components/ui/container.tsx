import * as React from "react"
import { cn } from "@/lib/utils"

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  maxW?: "sm" | "md" | "lg" | "xl" | "2xl" | "full"
  centerContent?: boolean
}

const maxWidthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  full: "max-w-full",
}

const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
  ({ className, maxW = "full", centerContent = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "mx-auto px-4 w-full",
          maxWidthClasses[maxW],
          centerContent && "flex flex-col items-center justify-center",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Container.displayName = "Container"

export { Container }

