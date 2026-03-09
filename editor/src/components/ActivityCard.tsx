import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { RichTextEditor } from '@/components/RichTextEditor'
import { cn } from '@/lib/utils'
import { ACTIVITY_TYPES, type Activity } from '@/types'

// Color pill per activity type
const TYPE_COLOR: Record<string, string> = {
  Recap:          'bg-purple-100 text-purple-800 border-purple-200',
  'Task Review':  'bg-orange-100 text-orange-800 border-orange-200',
  Explore:        'bg-blue-100   text-blue-800   border-blue-200',
  Make:           'bg-green-100  text-green-800  border-green-200',
  Evaluate:       'bg-yellow-100 text-yellow-800 border-yellow-200',
  Share:          'bg-pink-100   text-pink-800   border-pink-200',
  'Task at Home': 'bg-teal-100   text-teal-800   border-teal-200',
}

interface ActivityCardProps {
  activity: Activity
  index: number
  onChange: (updated: Activity) => void
  onRemove: () => void
  isDragging?: boolean
  readOnly?: boolean
}

export function ActivityCard({
  activity,
  index,
  onChange,
  onRemove,
  isDragging = false,
  readOnly = false,
}: ActivityCardProps) {
  const [collapsed, setCollapsed] = useState(false)

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: activity.id })

  const style = { transform: CSS.Transform.toString(transform), transition }

  const set = <K extends keyof Activity>(key: K, value: Activity[K]) => onChange({ ...activity, [key]: value })

  const color = TYPE_COLOR[activity.activityType] ?? 'bg-gray-100 text-gray-700 border-gray-200'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('rounded-xl border bg-card shadow-sm transition-opacity', isDragging && 'opacity-40')}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-3">
        {!readOnly && (
          <button
            {...attributes}
            {...listeners}
            className="drag-handle p-1 -ml-1 rounded text-muted-foreground hover:text-foreground"
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}

        <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">{index + 1}</span>

        <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold', color)}>
          {activity.activityType || 'Activity'}
        </span>

        <span className="flex-1 truncate text-sm font-medium">
          {activity.activityTitle || <span className="italic text-muted-foreground">Untitled</span>}
        </span>

        {activity.duration > 0 && <Badge variant="secondary" className="shrink-0 text-xs">{activity.duration} min</Badge>}
        {activity.slideNumbers && <Badge variant="outline" className="shrink-0 text-xs">Slides {activity.slideNumbers}</Badge>}

        <button
          onClick={() => setCollapsed(c => !c)}
          className="p-1 rounded text-muted-foreground hover:text-foreground"
          aria-label={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>

        {!readOnly && (
          <Button type="button" variant="ghost" size="icon" onClick={onRemove} className="h-8 w-8 text-destructive hover:text-destructive shrink-0">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* ── Body ────────────────────────────────────────────────── */}
      {!collapsed && (
        <div className="border-t px-4 pb-5 pt-4 space-y-4">
          {readOnly ? (
            <>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-xs uppercase font-medium text-muted-foreground mb-0.5">Type</p>{activity.activityType}</div>
                <div><p className="text-xs uppercase font-medium text-muted-foreground mb-0.5">Duration</p>{activity.duration} min</div>
                <div><p className="text-xs uppercase font-medium text-muted-foreground mb-0.5">Slides</p>{activity.slideNumbers || '—'}</div>
              </div>
              {activity.instructions && (
                <div>
                  <p className="text-xs uppercase font-medium text-muted-foreground mb-1">Instructions</p>
                  <div className="prose prose-sm max-w-none text-sm" dangerouslySetInnerHTML={{ __html: activity.instructions }} />
                </div>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label>Activity Type</Label>
                  <Select value={activity.activityType} onValueChange={v => set('activityType', v)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{ACTIVITY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 lg:col-span-1">
                  <Label>Title</Label>
                  <Input value={activity.activityTitle} onChange={e => set('activityTitle', e.target.value)} placeholder="Activity title" className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label>Duration (min)</Label>
                  <Input type="number" min={0} value={activity.duration} onChange={e => set('duration', Number(e.target.value))} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label>Slide Numbers</Label>
                  <Input value={activity.slideNumbers} onChange={e => set('slideNumbers', e.target.value)} placeholder="e.g. 5–8" className="h-9" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Instructions</Label>
                <RichTextEditor
                  content={activity.instructions}
                  onChange={html => set('instructions', html)}
                  placeholder="Describe what happens in this activity…"
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
