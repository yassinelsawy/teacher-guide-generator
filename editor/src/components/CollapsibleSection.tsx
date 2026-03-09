import { useState, type ReactNode } from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CollapsibleSectionProps {
  title: string
  defaultOpen?: boolean
  badge?: string | number
  children: ReactNode
  className?: string
  forceOpen?: boolean
}

export function CollapsibleSection({
  title,
  defaultOpen = true,
  badge,
  children,
  className,
  forceOpen = false,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Collapsible.Root open={forceOpen || open} onOpenChange={setOpen} className={cn('w-full', className)}>
      <div className="rounded-xl border bg-card shadow-sm">
        <Collapsible.Trigger className="flex w-full items-center gap-3 px-6 py-4 text-left hover:bg-accent/40 transition-colors rounded-xl">
          {open
            ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
          <span className="font-semibold text-base flex-1">{title}</span>
          {badge !== undefined && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {badge}
            </span>
          )}
        </Collapsible.Trigger>

        <Collapsible.Content>
          <div className="border-t px-6 pb-6 pt-5">{children}</div>
        </Collapsible.Content>
      </div>
    </Collapsible.Root>
  )
}
