import { useEffect, useRef, useState } from 'react'
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
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronsDown, ChevronsUp, Copy, GripVertical, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ActivityCard, TYPE_COLOR } from '@/components/ActivityCard'
import { cn } from '@/lib/utils'
import { createProcedureSubsection, type Activity, type ProcedureSubsection } from '@/types'

interface Props {
  subsections: ProcedureSubsection[]
  onChange: (subsections: ProcedureSubsection[]) => void
  readOnly?: boolean
}

function subsectionMinutes(subsection: ProcedureSubsection): number {
  return subsection.activities.reduce((s, a) => s + (Number(a.duration) || 0), 0)
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

function ActivityListEditor({
  activities,
  onChange,
  readOnly,
}: {
  activities: Activity[]
  onChange: (activities: Activity[]) => void
  readOnly: boolean
}) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  if (readOnly) {
    return (
      <div className="space-y-3">
        {activities.map((a, i) => (
          <ActivityCard key={a.id} activity={a} index={i} readOnly onChange={() => {}} onRemove={() => {}} />
        ))}
      </div>
    )
  }

  const update = (i: number, updated: Activity) => {
    const n = [...activities]; n[i] = updated; onChange(n)
  }
  const remove = (i: number) => onChange(activities.filter((_, j) => j !== i))
  const add = () => onChange([
    ...activities,
    { id: crypto.randomUUID(), activityType: 'Explore', activityTitle: '', duration: 10, instructions: '' },
  ])

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    if (over && active.id !== over.id) {
      const from = activities.findIndex(a => a.id === active.id)
      const to   = activities.findIndex(a => a.id === over.id)
      onChange(arrayMove(activities, from, to))
    }
  }

  const activeIndex = activeId ? activities.findIndex(a => a.id === activeId) : -1
  const activeActivity = activeIndex >= 0 ? activities[activeIndex] : null

  return (
    <div className="space-y-3">
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

      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="mr-2 h-4 w-4" /> Add Activity
      </Button>
    </div>
  )
}

// Floating "ghost" shown under the cursor while a subsection is being
// dragged (via DragOverlay), independent of the sortable list so it isn't
// clipped or reflowed by neighboring cards.
function SubsectionDragPreview({ subsection, index }: { subsection: ProcedureSubsection; index: number }) {
  const displayTitle = subsection.title.trim() || `Subsection ${index + 1}`
  const total = subsectionMinutes(subsection)
  return (
    <div className="flex items-center gap-2 rotate-1 cursor-grabbing rounded-lg border bg-card px-4 py-3 shadow-2xl ring-2 ring-primary/30">
      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{displayTitle}</span>
      {total > 0 && <span className="shrink-0 text-xs text-muted-foreground">{total} min</span>}
    </div>
  )
}

function SubsectionCard({
  subsection,
  index,
  onChange,
  onRemove,
  onDuplicate,
  onMoveToTop,
  onMoveToBottom,
  isFirst = false,
  isLast = false,
  readOnly,
  isDragging = false,
  scrollTo = false,
  onScrolledTo,
}: {
  subsection: ProcedureSubsection
  index: number
  onChange: (updated: ProcedureSubsection) => void
  onRemove: () => void
  onDuplicate: () => void
  onMoveToTop: () => void
  onMoveToBottom: () => void
  isFirst?: boolean
  isLast?: boolean
  readOnly: boolean
  isDragging?: boolean
  scrollTo?: boolean
  onScrolledTo?: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: sortableDragging } = useSortable({
    id: subsection.id,
    disabled: readOnly,
  })
  const cardRef = useRef<HTMLDivElement | null>(null)
  const [deleteArmed, setDeleteArmed] = useState(false)
  const deleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current)
  }, [])

  useEffect(() => {
    if (!scrollTo) return
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    onScrolledTo?.()
  }, [scrollTo, onScrolledTo])

  const handleDeleteClick = () => {
    if (!deleteArmed) {
      setDeleteArmed(true)
      deleteTimeoutRef.current = setTimeout(() => setDeleteArmed(false), 4000)
      return
    }
    if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current)
    onRemove()
  }

  const displayTitle = subsection.title.trim() || `Subsection ${index + 1}`
  const total = subsectionMinutes(subsection)

  if (readOnly) {
    return (
      <div className="rounded-lg border bg-muted/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{displayTitle}</p>
          {total > 0 && <span className="text-xs text-muted-foreground">{total} min</span>}
        </div>
        <ActivityListEditor activities={subsection.activities} onChange={() => {}} readOnly />
      </div>
    )
  }

  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={(element) => {
        cardRef.current = element
        setNodeRef(element)
      }}
      style={style}
      className={cn(
        'rounded-lg border bg-muted/10 p-4 space-y-3 will-change-transform transition-opacity duration-200 ease-out',
        (isDragging || sortableDragging) && 'opacity-40',
      )}
    >
      <div className="flex items-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isFirst}
          onClick={onMoveToTop}
          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
          title="Move to top"
        >
          <ChevronsUp className="h-4 w-4" />
        </Button>

        <button
          {...attributes}
          {...listeners}
          className="drag-handle inline-flex h-9 w-9 shrink-0 cursor-grab items-center justify-center rounded-md border text-muted-foreground hover:text-foreground hover:bg-accent active:cursor-grabbing touch-none select-none"
          aria-label="Drag to reorder subsection"
          type="button"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isLast}
          onClick={onMoveToBottom}
          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
          title="Move to bottom"
        >
          <ChevronsDown className="h-4 w-4" />
        </Button>

        <div className="flex-1 space-y-1.5 min-w-0">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Subsection Name</Label>
          <Input
            value={subsection.title}
            onChange={(e) => onChange({ ...subsection, title: e.target.value })}
            placeholder={`Subsection ${index + 1}`}
            className="h-9"
          />
        </div>

        {total > 0 && <span className="text-xs text-muted-foreground shrink-0 pb-2.5">{total} min</span>}

        <Button type="button" variant="ghost" size="icon" onClick={onDuplicate} className="h-9 w-9 text-muted-foreground hover:text-foreground shrink-0" title="Duplicate subsection">
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={deleteArmed ? 'destructive' : 'ghost'}
          size={deleteArmed ? 'sm' : 'icon'}
          onClick={handleDeleteClick}
          className={cn('shrink-0', deleteArmed ? 'h-9 gap-1.5 px-3' : 'h-9 w-9 text-destructive hover:text-destructive')}
          title={deleteArmed ? 'Click again to confirm delete' : 'Delete subsection'}
        >
          <Trash2 className="h-4 w-4" />
          {deleteArmed && <span className="text-xs font-medium">Confirm?</span>}
        </Button>
      </div>

      <ActivityListEditor
        activities={subsection.activities}
        onChange={(activities) => onChange({ ...subsection, activities })}
        readOnly={false}
      />
    </div>
  )
}

export function LessonProcedureSection({ subsections, onChange, readOnly = false }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [scrollToId, setScrollToId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    if (over && active.id !== over.id) {
      const from = subsections.findIndex(s => s.id === active.id)
      const to   = subsections.findIndex(s => s.id === over.id)
      onChange(arrayMove(subsections, from, to))
    }
  }

  const updateSubsection = (id: string, updated: ProcedureSubsection) =>
    onChange(subsections.map(s => (s.id === id ? updated : s)))

  const removeSubsection = (id: string) => onChange(subsections.filter(s => s.id !== id))

  const duplicateSubsection = (id: string) => {
    const index = subsections.findIndex(s => s.id === id)
    if (index < 0) return
    const clone: ProcedureSubsection = { ...structuredClone(subsections[index]), id: crypto.randomUUID() }
    clone.activities = clone.activities.map(a => ({ ...a, id: crypto.randomUUID() }))
    clone.title = clone.title.trim() ? `${clone.title.trim()} (Copy)` : clone.title
    const next = [...subsections]
    next.splice(index + 1, 0, clone)
    onChange(next)
  }

  const moveSubsectionToTop = (id: string) => {
    const index = subsections.findIndex(s => s.id === id)
    if (index <= 0) return
    const next = [...subsections]
    const [item] = next.splice(index, 1)
    next.unshift(item)
    onChange(next)
    setScrollToId(id)
  }

  const moveSubsectionToBottom = (id: string) => {
    const index = subsections.findIndex(s => s.id === id)
    if (index < 0 || index === subsections.length - 1) return
    const next = [...subsections]
    const [item] = next.splice(index, 1)
    next.push(item)
    onChange(next)
    setScrollToId(id)
  }

  const addSubsection = () => onChange([...subsections, createProcedureSubsection()])

  const activeIndex = activeId ? subsections.findIndex(s => s.id === activeId) : -1
  const activeSubsection = activeIndex >= 0 ? subsections[activeIndex] : null

  const totalActivities = subsections.reduce((s, sub) => s + sub.activities.length, 0)
  const totalMinutes = subsections.reduce((s, sub) => s + subsectionMinutes(sub), 0)

  if (readOnly) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{totalActivities} {totalActivities === 1 ? 'activity' : 'activities'} · {totalMinutes} min total</p>
        {subsections.map((s, i) => (
          <SubsectionCard
            key={s.id}
            subsection={s}
            index={i}
            onChange={() => {}}
            onRemove={() => {}}
            onDuplicate={() => {}}
            onMoveToTop={() => {}}
            onMoveToBottom={() => {}}
            readOnly
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{totalActivities} {totalActivities === 1 ? 'activity' : 'activities'} · {totalMinutes} min total</p>
        <p className="text-xs text-muted-foreground">Drag subsections or activities to reorder</p>
      </div>

      {subsections.length === 0 ? (
        <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground bg-muted/20">
          No subsections yet. Use Add Subsection to create one.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={e => setActiveId(String(e.active.id))}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <SortableContext items={subsections.map(s => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {subsections.map((s, i) => (
                <SubsectionCard
                  key={s.id}
                  subsection={s}
                  index={i}
                  isDragging={activeId === s.id}
                  onChange={updated => updateSubsection(s.id, updated)}
                  onRemove={() => removeSubsection(s.id)}
                  onDuplicate={() => duplicateSubsection(s.id)}
                  onMoveToTop={() => moveSubsectionToTop(s.id)}
                  onMoveToBottom={() => moveSubsectionToBottom(s.id)}
                  isFirst={i === 0}
                  isLast={i === subsections.length - 1}
                  readOnly={false}
                  scrollTo={scrollToId === s.id}
                  onScrolledTo={() => setScrollToId(null)}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeSubsection ? <SubsectionDragPreview subsection={activeSubsection} index={activeIndex} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      <Button type="button" variant="outline" onClick={addSubsection}>
        <Plus className="mr-2 h-4 w-4" /> Add Subsection
      </Button>
    </div>
  )
}
