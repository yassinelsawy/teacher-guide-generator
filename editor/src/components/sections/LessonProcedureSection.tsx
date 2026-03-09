import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
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
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ActivityCard } from '@/components/ActivityCard'
import type { Activity } from '@/types'

interface Props {
  activities: Activity[]
  onChange: (activities: Activity[]) => void
  readOnly?: boolean
}

export function LessonProcedureSection({ activities, onChange, readOnly = false }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
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
    { id: crypto.randomUUID(), activityType: 'Explore', activityTitle: '', duration: 10, slideNumbers: '', instructions: '' },
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
      </DndContext>

      <Button type="button" variant="outline" onClick={add}>
        <Plus className="mr-2 h-4 w-4" /> Add Activity
      </Button>
    </div>
  )
}
