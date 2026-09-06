import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from '@dnd-kit/sortable'
import { GripVertical, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ActivityCard, TYPE_COLOR } from '@/components/ActivityCard'
import { cn } from '@/lib/utils'
import type { Activity } from '@/types'

interface Props {
  activities: Activity[]
  onChange: (activities: Activity[]) => void
  readOnly?: boolean
}

// Floating "ghost" shown under the cursor while an activity card is being
// dragged (via DragOverlay), independent of the sortable list so it isn't
// clipped or reflowed by neighboring cards.
function ActivityDragPreview({ activity, index }: { activity: Activity; index: number }) {
  const color = TYPE_COLOR[activity.activityType] ?? 'bg-gray-100 text-gray-700 border-gray-200'
  return (
    <div className="flex rotate-1 cursor-grabbing items-center gap-2 rounded-xl border bg-card px-4 py-3 shadow-2xl ring-2 ring-primary/30">
      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="w-5 shrink-0 text-xs font-mono text-muted-foreground">{index + 1}</span>
      <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold', color)}>
        {activity.activityType || 'Activity'}
      </span>
      <span className="flex-1 min-w-0 truncate text-sm font-medium">
        {activity.activityTitle || <span className="italic text-muted-foreground">Untitled</span>}
      </span>
      {activity.duration > 0 && (
        <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">{activity.duration} min</span>
      )}
    </div>
  )
}

export function LessonProcedureSection({ activities, onChange, readOnly = false }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    if (over && active.id !== over.id) {
      const from = activities.findIndex(a => a.id === active.id)
      const to   = activities.findIndex(a => a.id === over.id)
      onChange(arrayMove(activities, from, to))
    }
  }

  const update = (i: number, updated: Activity) => {
    const n = [...activities]; n[i] = updated; onChange(n)
  }
  const remove = (i: number) => onChange(activities.filter((_, j) => j !== i))
  const add = () => onChange([
    ...activities,
    { id: crypto.randomUUID(), activityType: 'Explore', activityTitle: '', duration: 10, instructions: '' },
  ])

  const total = activities.reduce((s, a) => s + (Number(a.duration) || 0), 0)

  if (readOnly) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{activities.length} {activities.length === 1 ? 'activity' : 'activities'} · {total} min total</p>
        {activities.map((a, i) => (
          <ActivityCard key={a.id} activity={a} index={i} readOnly onChange={() => {}} onRemove={() => {}} />
        ))}
      </div>
    )
  }

  const activeIndex = activeId ? activities.findIndex(a => a.id === activeId) : -1
  const activeActivity = activeIndex >= 0 ? activities[activeIndex] : null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{activities.length} {activities.length === 1 ? 'activity' : 'activities'} · {total} min total</p>
        <p className="text-xs text-muted-foreground">Drag cards to reorder</p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragStart={e => setActiveId(String(e.active.id))}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <SortableContext items={activities.map(a => a.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {activities.map((a, i) => (
              <ActivityCard
                key={a.id}
                activity={a}
                index={i}
                isDragging={activeId === a.id}
                onChange={updated => update(i, updated)}
                onRemove={() => remove(i)}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeActivity ? <ActivityDragPreview activity={activeActivity} index={activeIndex} /> : null}
        </DragOverlay>
      </DndContext>

      <Button type="button" variant="outline" onClick={add}>
        <Plus className="mr-2 h-4 w-4" /> Add Activity
      </Button>
    </div>
  )
}
