import { useEffect, useRef, useState } from 'react'
import {
  DndContext,
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
import { Copy, GripVertical, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RichTextEditor } from '@/components/RichTextEditor'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import { LessonInfoSection } from '@/components/sections/LessonInfoSection'
import { OverviewSection } from '@/components/sections/OverviewSection'
import { LearningOutcomesSection } from '@/components/sections/LearningOutcomesSection'
import { PreparationSection } from '@/components/sections/PreparationSection'
import { OutlineOverviewSection } from '@/components/sections/OutlineOverviewSection'
import { LessonProcedureSection } from '@/components/sections/LessonProcedureSection'
import { GlossarySection } from '@/components/sections/GlossarySection'
import { BonusActivitiesSection } from '@/components/sections/BonusActivitiesSection'
import { cn } from '@/lib/utils'
import {
  CUSTOM_SECTION_TYPES,
  CUSTOM_SECTION_TYPE_LABELS,
  createCustomSection,
  type CustomSection,
  type CustomSectionType,
} from '@/types'

interface Props {
  sections: CustomSection[]
  onChange: (sections: CustomSection[]) => void
  readOnly?: boolean
  forceOpen?: boolean
}

function labelForType(sectionType: CustomSectionType) {
  return CUSTOM_SECTION_TYPE_LABELS[sectionType] || 'Custom Section'
}

function isHtmlEmpty(html: string): boolean {
  return !html || !html.replace(/<[^>]+>/g, '').trim()
}

function isSectionEmpty(section: CustomSection): boolean {
  switch (section.sectionType) {
    case 'lessonInfo': {
      const { lessonName, gradeLevel, moduleLink, slidesLink } = section.lessonInfo
      return ![lessonName, gradeLevel, moduleLink, slidesLink].some((value) => value.trim())
    }
    case 'overview':
      return isHtmlEmpty(section.overview)
    case 'learningOutcomes':
      return section.learningOutcomes.every((item) => !item.trim())
    case 'preparation':
      return isHtmlEmpty(section.preparation)
    case 'outlineOverview':
      return section.outlineOverview.length === 0
    case 'lessonProcedure':
      return section.lessonProcedure.length === 0
    case 'glossary':
      return section.glossary.every((entry) => !entry.concept.trim() && !entry.definition.trim())
    case 'bonusActivities':
      return isHtmlEmpty(section.bonusActivities)
    case 'text':
    default:
      return isHtmlEmpty(section.text)
  }
}

function SectionBody({
  section,
  readOnly,
  onChange,
}: {
  section: CustomSection
  readOnly: boolean
  onChange: (updated: CustomSection) => void
}) {
  switch (section.sectionType) {
    case 'lessonInfo':
      return <LessonInfoSection data={section.lessonInfo} onChange={(lessonInfo) => onChange({ ...section, lessonInfo })} readOnly={readOnly} />
    case 'overview':
      return <OverviewSection content={section.overview} onChange={(overview) => onChange({ ...section, overview })} readOnly={readOnly} />
    case 'learningOutcomes':
      return <LearningOutcomesSection items={section.learningOutcomes} onChange={(learningOutcomes) => onChange({ ...section, learningOutcomes })} readOnly={readOnly} />
    case 'preparation':
      return <PreparationSection content={section.preparation} onChange={(preparation) => onChange({ ...section, preparation })} readOnly={readOnly} />
    case 'outlineOverview':
      return <OutlineOverviewSection rows={section.outlineOverview} onChange={(outlineOverview) => onChange({ ...section, outlineOverview })} readOnly={readOnly} />
    case 'lessonProcedure':
      return <LessonProcedureSection activities={section.lessonProcedure} onChange={(lessonProcedure) => onChange({ ...section, lessonProcedure })} readOnly={readOnly} />
    case 'glossary':
      return <GlossarySection entries={section.glossary} onChange={(glossary) => onChange({ ...section, glossary })} readOnly={readOnly} />
    case 'bonusActivities':
      return <BonusActivitiesSection content={section.bonusActivities} onChange={(bonusActivities) => onChange({ ...section, bonusActivities })} readOnly={readOnly} />
    case 'text':
    default:
      return readOnly ? (
        section.text ? <div className="prose prose-sm max-w-none text-sm" dangerouslySetInnerHTML={{ __html: section.text }} /> : <p className="text-sm text-muted-foreground">No text yet.</p>
      ) : (
        <RichTextEditor
          content={section.text}
          onChange={(text) => onChange({ ...section, text })}
          placeholder="Write your custom text block…"
        />
      )
  }
}

function SortableSectionCard({
  section,
  index,
  onChange,
  onRemove,
  onDuplicate,
  readOnly = false,
  forceOpen = false,
  isDragging = false,
  autoFocus = false,
  onAutoFocused,
}: {
  section: CustomSection
  index: number
  onChange: (updated: CustomSection) => void
  onRemove: () => void
  onDuplicate: () => void
  readOnly?: boolean
  forceOpen?: boolean
  isDragging?: boolean
  autoFocus?: boolean
  onAutoFocused?: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: sortableDragging } = useSortable({ id: section.id })
  const cardRef = useRef<HTMLDivElement | null>(null)
  const titleInputRef = useRef<HTMLInputElement | null>(null)
  const [deleteArmed, setDeleteArmed] = useState(false)
  const deleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updateType = (nextType: CustomSectionType) => {
    if (nextType === section.sectionType) return
    if (!isSectionEmpty(section)) {
      const confirmed = window.confirm('Changing the section type will clear the content currently in this section. Continue?')
      if (!confirmed) return
    }
    const next = createCustomSection(nextType)
    onChange({
      ...next,
      id: section.id,
      title: section.title?.trim() || next.title,
    })
  }

  const handleDeleteClick = () => {
    if (!deleteArmed) {
      setDeleteArmed(true)
      deleteTimeoutRef.current = setTimeout(() => setDeleteArmed(false), 4000)
      return
    }
    if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current)
    onRemove()
  }

  useEffect(() => {
    return () => {
      if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (!autoFocus) return
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const id = setTimeout(() => {
      titleInputRef.current?.focus()
      titleInputRef.current?.select()
    }, 250)
    onAutoFocused?.()
    return () => clearTimeout(id)
    // Intentionally run once on mount — this only ever fires for a section right after it is created or duplicated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const displayTitle = section.title.trim() || labelForType(section.sectionType)

  useEffect(() => {
    if (!cardRef.current) return

    const transformValue = transform ? CSS.Transform.toString(transform) : ''
    if (transformValue) {
      cardRef.current.style.transform = transformValue
    } else {
      cardRef.current.style.removeProperty('transform')
    }
    cardRef.current.style.transition = transition || ''
    cardRef.current.style.willChange = 'transform'
  }, [transform, transition])

  const headerContent = readOnly ? null : (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)] lg:grid-cols-[180px_minmax(0,1fr)_auto] lg:items-end">
      <div className="space-y-1.5 min-w-0">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Section Type</Label>
        <Select value={section.sectionType} onValueChange={(value) => updateType(value as CustomSectionType)}>
          <SelectTrigger className="h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CUSTOM_SECTION_TYPES.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5 min-w-0">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Section Name</Label>
        <Input
          ref={titleInputRef}
          value={section.title}
          onChange={(event) => onChange({ ...section, title: event.target.value })}
          placeholder="Enter section name"
          className="h-9 w-full"
        />
      </div>

      <div className="col-span-full flex items-center justify-end gap-2 sm:col-span-2 lg:col-span-1 lg:pb-[2px]">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={(event) => {
            event.stopPropagation()
            onDuplicate()
          }}
          className="h-10 w-10 text-muted-foreground hover:text-foreground shrink-0"
          title="Duplicate section"
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={deleteArmed ? 'destructive' : 'ghost'}
          size={deleteArmed ? 'sm' : 'icon'}
          onClick={(event) => {
            event.stopPropagation()
            handleDeleteClick()
          }}
          className={cn('shrink-0', deleteArmed ? 'h-10 gap-1.5 px-3' : 'h-10 w-10 text-destructive hover:text-destructive')}
          title={deleteArmed ? 'Click again to confirm delete' : 'Delete section'}
        >
          <Trash2 className="h-4 w-4" />
          {deleteArmed && <span className="text-xs font-medium">Confirm?</span>}
        </Button>
      </div>
    </div>
  )

  const leadingContent = !readOnly ? (
    <button
      {...attributes}
      {...listeners}
      className="drag-handle inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border text-muted-foreground hover:text-foreground hover:bg-accent touch-none select-none"
      aria-label="Drag to reorder"
      type="button"
      onClick={(event) => event.stopPropagation()}
    >
      <GripVertical className="h-5 w-5" />
    </button>
  ) : null

  return (
    <div
      ref={(element) => {
        cardRef.current = element
        setNodeRef(element)
      }}
      className={cn(
        'rounded-xl border bg-card shadow-sm will-change-transform transition-[box-shadow,opacity] duration-200 ease-out',
        (isDragging || sortableDragging) && 'z-20 scale-[1.015] opacity-90 shadow-xl ring-2 ring-primary/15',
      )}
    >
      <CollapsibleSection
        title={`${index + 1}. ${displayTitle}`}
        badge={labelForType(section.sectionType)}
        defaultOpen={!readOnly && (index === 0 || autoFocus)}
        leadingContent={leadingContent}
        headerContent={headerContent}
        forceOpen={forceOpen}
      >
        <SectionBody section={section} readOnly={readOnly} onChange={onChange} />
      </CollapsibleSection>
    </div>
  )
}

export function CustomSectionsSection({ sections, onChange, readOnly = false, forceOpen = false }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [newSectionType, setNewSectionType] = useState<CustomSectionType>('text')
  const [focusSectionId, setFocusSectionId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const addSection = () => {
    const section = createCustomSection(newSectionType)
    onChange([...sections, section])
    setFocusSectionId(section.id)
  }

  const updateSection = (id: string, updated: CustomSection) => {
    onChange(sections.map((section) => (section.id === id ? updated : section)))
  }

  const removeSection = (id: string) => onChange(sections.filter((section) => section.id !== id))

  const duplicateSection = (id: string) => {
    const index = sections.findIndex((section) => section.id === id)
    if (index < 0) return
    const clone: CustomSection = { ...structuredClone(sections[index]), id: crypto.randomUUID() }
    clone.title = clone.title.trim() ? `${clone.title.trim()} (Copy)` : clone.title
    const next = [...sections]
    next.splice(index + 1, 0, clone)
    onChange(next)
    setFocusSectionId(clone.id)
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    if (over && active.id !== over.id) {
      const from = sections.findIndex((section) => section.id === active.id)
      const to = sections.findIndex((section) => section.id === over.id)
      if (from >= 0 && to >= 0) {
        onChange(arrayMove(sections, from, to))
      }
    }
  }

  const headerContent = !readOnly ? (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
      <p className="text-sm text-muted-foreground max-w-2xl">
        Add custom menu blocks, choose the block type, rename it, and drag to reorder. The numbering updates automatically.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:flex-wrap">
        <div className="space-y-1.5 w-full sm:w-auto">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">New Section Type</Label>
          <Select value={newSectionType} onValueChange={(value) => setNewSectionType(value as CustomSectionType)}>
            <SelectTrigger className="h-9 w-full sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CUSTOM_SECTION_TYPES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button type="button" size="sm" onClick={addSection} className="h-9 w-full whitespace-nowrap sm:w-auto">
          <Plus className="mr-1.5 h-4 w-4" /> Add Section
        </Button>
      </div>
    </div>
  ) : null

  return (
    <CollapsibleSection
      title="9. Custom Sections"
      badge={sections.length}
      forceOpen={forceOpen}
      headerContent={headerContent}
    >
      {sections.length === 0 ? (
        <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground bg-muted/20">
          No custom sections yet. Use Add Section to create one.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={(event) => setActiveId(String(event.active.id))}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <SortableContext items={sections.map((section) => section.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {sections.map((section, index) => (
                <SortableSectionCard
                  key={section.id}
                  section={section}
                  index={index}
                  onChange={(updated) => updateSection(section.id, updated)}
                  onRemove={() => removeSection(section.id)}
                  onDuplicate={() => duplicateSection(section.id)}
                  readOnly={readOnly}
                  forceOpen={forceOpen}
                  isDragging={activeId === section.id}
                  autoFocus={focusSectionId === section.id}
                  onAutoFocused={() => setFocusSectionId(null)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </CollapsibleSection>
  )
}