import * as React from "react"
import { cn } from "@/lib/utils"

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
  indeterminate?: boolean
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, indeterminate = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative h-1.5 w-full overflow-hidden rounded-full bg-primary/20",
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "h-full bg-primary transition-all duration-300",
          indeterminate && "animate-progress-indeterminate"
        )}
        style={indeterminate ? undefined : { width: `${value}%` }}
      />
    </div>
  )
)
Progress.displayName = "Progress"

export { Progress }
