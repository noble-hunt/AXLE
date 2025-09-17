import { Card } from "@/components/ui/card"
import { PrimaryButton } from "@/components/ui/primary-button"
import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className = ""
}: EmptyStateProps) {
  return (
    <div className={`text-center py-12 px-6 ${className}`} data-testid="empty-state">
      <Icon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">{description}</p>
      
      {(actionLabel || secondaryActionLabel) && (
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {actionLabel && onAction && (
            <PrimaryButton onClick={onAction} data-testid="empty-state-primary-action">
              {actionLabel}
            </PrimaryButton>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Button variant="outline" onClick={onSecondaryAction} data-testid="empty-state-secondary-action">
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export function EmptyStateCard({ 
  icon, 
  title, 
  description, 
  actionLabel, 
  onAction, 
  secondaryActionLabel, 
  onSecondaryAction,
  className = ""
}: EmptyStateProps) {
  return (
    <Card className={`card-shadow border border-border ${className}`}>
      <EmptyState
        icon={icon}
        title={title}
        description={description}
        actionLabel={actionLabel}
        onAction={onAction}
        secondaryActionLabel={secondaryActionLabel}
        onSecondaryAction={onSecondaryAction}
      />
    </Card>
  )
}