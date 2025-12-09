import { Progress } from "@/components/ui/progress"

interface LoadingBarProps {
  isLoading: boolean
}

export function LoadingBar({ isLoading }: LoadingBarProps) {
  if (!isLoading) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <Progress indeterminate className="h-0.5 rounded-none" />
    </div>
  )
}
